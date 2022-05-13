import {
	ButtonInteraction,
	Client,
	CommandInteraction,
	MessageAttachment,
	MessageButton,
	MessageEmbed,
	TextChannel,
} from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { all, get, has, set } from "../../internal/data"
import { BotConfig } from "../../types"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"
import { ApplyCommand } from "../declaration"

export type Subcommand = "setup" | "list" | "view"

export interface Data {
	guild: string
	channel: string
	message: string
	category: string
	timeout: number
	channels: {
		user: string
		channel: string
	}[]
}
export interface ArchiveUser {
	id: string
	tag: string
}
export interface Archive {
	user: ArchiveUser
	content: string
	attachments: MessageAttachment[]
	embeds: MessageEmbed[]
	edited: boolean
	mentions: ArchiveUser[]
	timestamp: string
}

export const action = new Action<CommandInteraction>("command/mail").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed = new Embed()

	switch (subcommand) {
		case "setup": {
			embed = await Commands.setupSub(interact, embed)
			break
		}
		case "list": {
			embed = await Commands.listSub(interact, embed)
			break
		}
		case "view": {
			embed = await Commands.viewSub(interact, embed)
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export module Predefined {
	export const newButton = new MessageButton()
		.setCustomId(`mail-new`)
		.setStyle(MessageButtonStyles.PRIMARY)
		.setLabel("Message")
		.setEmoji("📨")
	export const infoButton = new MessageButton()
		.setCustomId(`mail-info`)
		.setStyle(MessageButtonStyles.SECONDARY)
		.setLabel("About")
		.setEmoji("ℹ️")
	export const closeButton = new MessageButton()
		.setCustomId(`mail-close`)
		.setStyle(MessageButtonStyles.DANGER)
		.setLabel("Archive")
		.setEmoji("🔒")
	export const mailEmbed = new Embed()
		.title(`ModMail™️`)
		.description("*Your direct and private line of communication to your moderators!*")

	export const mailComponent = new Component()
	mailComponent.add(newButton)
	mailComponent.add(infoButton)

	export const channelComponent = new Component()
	channelComponent.add(closeButton)
	channelComponent.add(infoButton)

	export const channelEmbed = new Embed().title("An admin / moderator will be with you shortly!")
}
export module Commands {
	export async function setupSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id)

		const category = interact.options.getChannel("category", true)
		const timeout = interact.options.getInteger("timeout", true)

		if (category.type !== "GUILD_CATEGORY") {
			return embed.title("Invalid category type!")
		}

		if ((await has(path)).result) {
			const data = (await get<Data>(path))!
			const channel = (await interact.guild!.channels.fetch(data.channel)) as TextChannel | null

			if (channel) {
				const message = await channel.messages.fetch(data.message)
				if (message && message.deletable) await message.delete()
			}
		}

		const message = await interact.channel!.send({
			embeds: [Predefined.mailEmbed.build()],
			components: Predefined.mailComponent.build(),
		})

		const config: Data = {
			guild: interact.guild!.id,
			channel: interact.channel!.id,
			message: message.id,
			category: category.id,
			timeout: Math.abs(timeout),
			channels: [],
		}

		const { result } = await set(path, config)
		return embed.title(result ? "Set up mail!" : "Error setting up mail!")
	}
	export async function listSub(interact: CommandInteraction, embed: Embed) {
		const dir = Utility.archiveDir(interact.guild!.id)
		const list: string[] = []
		let total = 0

		await all<Archive[]>(dir, (data, path) => {
			if (list.includes(path)) return
			list.push(path)
			if (++total >= 25) return

			const memberSet = new Set(data.map((a) => `<@${a.user.id}>`))
			const members = [...memberSet.values()].join(", ")
			const id = path.replace(/(?:data\/mail\/archive\/\d+?\/)|(?:\.json)/gi, "")

			embed.fields({ name: id, value: members })
		})

		const missing = Math.max(0, total - 25)
		return embed.title("Archived channels").description(`${total} archives (${missing} not shown)`)
	}
	export async function viewSub(interact: CommandInteraction, embed: Embed) {
		const channelId = interact.options.getString("id", true)
		const path = Utility.archivePath(interact.guild!.id, channelId)

		if (!(await has(path)).result) {
			return embed.title("Invalid channel ID!")
		}

		const data = (await get<Archive[]>(path))!

		let desc = ""
		let lost = 0

		for (const message of data) {
			if (desc.length >= 4096) {
				lost++
				continue
			}

			let temp = ""
			const user = `<@${message.user.id}>`
			const time = message.timestamp
			const edited = message.edited ? "(edited)" : ""
			const content = message.content.length !== 0 ? message.content : "*No content*"
			const embeds = message.embeds.length !== 0 ? "[+embeds]" : ""
			const attachments = message.attachments.length !== 0 ? "[+attachments]" : ""
			const text = `${content} ${attachments} ${embeds}`.trim()

			temp += `${user} ${time} ${edited}\n> ${text}`

			if (message.mentions.length !== 0) {
				temp += "\n**Mentions:** "
				temp += message.mentions.map((u) => `<@${u.id}>`).join(", ")
			}

			temp += "\n\n"

			if (desc.length + temp.length >= 4096) {
				lost++
				continue
			}

			desc += temp
		}

		return embed.description(desc.trim()).footer(`${lost !== 0 ? `${lost} messages not shown` : ""}`)
	}
}
export module Buttons {
	export const infoBtn = new Action<ButtonInteraction>("button/mail-info").invokes(async (interact) => {
		const path = Utility.dataPath(interact.guild!.id)
		const { timeout } = (await get<Data>(path))!
		const hours = (timeout / 60).toPrecision(1)

		const embed = new Embed()
			.title("About ModMail™️")
			.description(
				"ModMail™️ is a system that allows users of a guild to create private channels in order to contact the guild's moderators directly."
			)
			.fields(
				{
					name: "Privacy",
					value: "Channels automatically created through this system are set to only include you and the guild's moderators.",
				},
				{
					name: "Archiving",
					value: "Channels are archived upon request or AFK timeout.\nAll messages sent within ModMail™️ channels **are saved** for moderation purposes.",
				},
				{
					name: "Inactivity",
					value: `Channels will archive automatically after ${timeout} minutes (${hours} hours).`,
				}
			)

		await interact.reply({ embeds: [embed.build()], ephemeral: true })
	})
	export const newBtn = new Action<ButtonInteraction>("button/mail-new").invokes(async (interact) => {
		const mailPath = Utility.dataPath(interact.guild!.id)
		const appsPath = ApplyCommand.Utility.dataPath(interact.guild!.id)

		if ((await has(appsPath)).result) {
			const appsData = (await get<ApplyCommand.Data>(appsPath))!

			if (!appsData.responses.some((r) => r.user === interact.user.id && r.accepted)) {
				return await interact.reply({
					embeds: [new Embed().title("You must be a member of this guild to use ModMail™️!").build()],
					components: ApplyCommand.Predefined.modalCmp.build(),
					ephemeral: true,
				})
			}
		}

		const mailData = (await get<Data>(mailPath))!

		if (mailData.channels.some((c) => c.user === interact.user.id)) {
			const { channel } = mailData.channels.find((c) => c.user === interact.user.id)!

			return await interact.reply({
				embeds: [new Embed().title("You already have an active channel!").description(`<#${channel}>`).build()],
				ephemeral: true,
			})
		}

		const channel = (await interact.guild!.channels.create(interact.user.username, {
			parent: mailData.category,
			type: 0,
		})) as TextChannel
		await channel.permissionOverwrites.create(interact.user, { SEND_MESSAGES: true, VIEW_CHANNEL: true })

		mailData.channels.push({ user: interact.user.id, channel: channel.id })

		const { result } = await set(mailPath, mailData)
		const embed = new Embed().title(result ? "Channel created!" : "Error creating channel!")
		if (result) embed.description(`<#${channel.id}>`)

		await channel.send({
			embeds: [Predefined.channelEmbed.build()],
			components: Predefined.channelComponent.build(),
		})

		return await interact.reply({
			embeds: [new Embed().title(result ? "Channel created!" : "Error creating channel!").build()],
			ephemeral: true,
		})
	})
	export const closeBtn = new Action<ButtonInteraction>("button/mail-close").invokes(async (interact) => {
		await Utility.storeChannel(interact.channel as TextChannel)
		await interact.deferUpdate()
	})
}
export module Utility {
	export function dataPath(guildId: string) {
		return `mail/${guildId}`
	}
	export function archivePath(guildId: string, channelId: string) {
		return `mail/archive/${guildId}/${channelId}`
	}
	export function archiveDir(guildId: string) {
		return `mail/archive/${guildId}`
	}
	export async function storeChannel(channel: TextChannel) {
		const path = dataPath(channel.guild.id)
		const data = (await get<Data>(path))!
		const messages = await channel.messages.fetch()

		if (messages.size > 1) {
			const archive: Archive[] = messages.reverse().map((m) => ({
				user: {
					id: m.author.id,
					tag: m.author.tag,
				},
				content: m.content,
				attachments: [...m.attachments.values()],
				embeds: m.embeds,
				edited: !!m.editedAt,
				mentions: [...(m.mentions.members?.values() ?? [])].map((m) => ({
					id: m.user.id,
					tag: m.user.tag,
				})),
				timestamp: m.createdAt.toUTCString(),
			}))
			await set(archivePath(channel.guild.id, channel.id), archive)
		}

		const idx = data.channels.findIndex((c) => c.channel === channel.id)
		data.channels.splice(idx)

		await set(path, data)
		await channel.delete()
	}
	export async function refresh(client: Client) {
		const { refreshInterval } = (await get<BotConfig>("bot/config"))!

		setInterval(async () => {
			await all<Data>("mail", async (data) => {
				if (!data.channels || data.channels.length === 0) return

				const ms = data.timeout * 60 * 1000

				try {
					const guild = await client.guilds.fetch(data.guild)

					for (const entry of data.channels) {
						const channel = (await guild.channels.fetch(entry.channel)) as TextChannel
						const messages = await channel.messages.fetch()

						const diff = Date.now() - (messages.first()?.createdTimestamp ?? channel.createdTimestamp)

						if (diff >= ms) await storeChannel(channel)
					}
				} catch {}
			})
		}, refreshInterval)
	}
}
