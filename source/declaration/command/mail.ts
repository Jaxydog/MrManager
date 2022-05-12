import { Client, CommandInteraction, MessageAttachment, MessageButton, MessageEmbed, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { all, get, has, set } from "../../internal/data"
import { BotConfig } from "../../types"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "setup" | "list" | "view"
export interface Config {
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

export const action = new Action<CommandInteraction>("command/mail").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed: Embed

	switch (subcommand) {
		case "setup": {
			embed = await subSetup(interact, new Embed())
			break
		}
		case "list": {
			embed = await subList(interact, new Embed())
			break
		}
		case "view": {
			embed = await subView(interact, new Embed())
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export async function subSetup(interact: CommandInteraction, embed: Embed) {
	const category = interact.options.getChannel("category", true)
	const afkTimeout = interact.options.getInteger("timeout", true)
	const path = `mail/${interact.guild!.id}`

	if (category.type !== "GUILD_CATEGORY") {
		return embed.title("Invalid category type!")
	}

	if ((await has(path, true)).result) {
		const data = (await get<Config>(path, true))!
		const channel = (await interact.guild!.channels.fetch(data.channel)) as TextChannel | null

		if (channel) {
			const message = await channel.messages.fetch(data.message)
			if (message && message.deletable) await message.delete()
		}
	}

	const message = await interact.channel!.send({
		embeds: [mailEmbed.build()],
		components: mailComponent.build(),
	})

	const config: Config = {
		guild: interact.guild!.id,
		channel: interact.channel!.id,
		message: message.id,
		category: category.id,
		timeout: Math.abs(afkTimeout ?? 720),
		channels: [],
	}

	await set(path, config, true)

	return embed.title("Setup successful!")
}
export async function subList(interact: CommandInteraction, embed: Embed) {
	const dir = `mail/archive/${interact.guild!.id}`

	embed.title("Archived mail channels")
	let count = 0

	await all<Archive[]>(
		dir,
		(data, path) => {
			const memberSet = new Set(data.map((a) => `<@${a.user.id}>`).sort())
			const list = [...memberSet.values()].join(", ")
			const id = path.replace("data/mail/archive//", "").replace(".json", "")

			if (++count >= 25) return

			embed.fields({
				name: id,
				value: list,
			})
		},
		true
	)

	embed.description(`${count} archives (${Math.max(0, count - 25)} not shown)`)

	return embed
}
export async function subView(interact: CommandInteraction, embed: Embed) {
	const id = interact.options.getString("id", true)
	const path = `mail/archive/${interact.guild!.id}/${id}`

	embed.title(`Archive ${id}`)

	if (!(await has(path, true)).result) {
		return embed.title("Invalid id!")
	}

	const data = (await get<Archive[]>(path, true))!
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

	return embed.description(desc.trim()).footer(`${lost !== 0 ? `Not displaying ${lost} messages` : ""}`)
}

export async function archive(channel: TextChannel) {
	const path = `mail/${channel.guild.id}`
	const data = (await get<Config>(path, true))!
	const message = await channel.messages.fetch()

	if (message.size > 1) {
		await set<Archive[]>(
			`mail/archive/${channel.guild.id}/${channel.id}`,
			message.reverse().map((message) => ({
				user: {
					id: message.author.id,
					tag: message.author.tag,
				},
				content: message.content,
				attachments: [...message.attachments.values()],
				embeds: message.embeds,
				edited: !!message.editedAt,
				mentions: [...(message.mentions.members?.values() ?? [])].map((m) => ({
					id: m.user.id,
					tag: m.user.tag,
				})),
				timestamp: message.createdAt.toUTCString(),
			})),
			true
		)
	}

	const index = data.channels.findIndex((c) => c.channel === channel.id)
	data.channels.splice(index)
	await set(path, data, true)
	await channel.delete()
}
export async function timeout(channel: TextChannel) {
	const { refreshInterval } = (await get<BotConfig>("bot/config", true))!
	const { timeout } = (await get<Config>(`mail/${channel.guild.id}`, true))!

	const interval = setInterval(async () => {
		if (!channel) {
			clearInterval(interval)
			return
		}

		try {
			const ms = timeout * 60 * 1000
			const messages = await channel.messages.fetch()
			const diff = Date.now() - (messages.first()?.createdTimestamp ?? channel.createdTimestamp)

			if (diff >= ms) {
				await archive(channel)
				clearInterval(interval)
			}
		} catch (error) {
			clearInterval(interval)
			return
		}
	}, refreshInterval)
}
export async function refresh(client: Client) {
	await all<Config>(
		"mail",
		async (data) => {
			for (const entry of data.channels) {
				const guild = await client.guilds.fetch(data.guild)
				const channel = await guild.channels.fetch(entry.channel)
				await timeout(channel as TextChannel)
			}
		},
		true
	)
}
