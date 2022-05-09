import { Client, CommandInteraction, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { all, get, has, set } from "../../internal/data"
import { BotConfig } from "../../types"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

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
	const channel = interact.options.getChannel("channel", true)
	const category = interact.options.getChannel("category", true)
	const afkTimeout = interact.options.getInteger("timeout", true)

	const embed = new Embed()

	if (channel.type !== "GUILD_TEXT") {
		embed.title("Invalid channel type!")
	} else if (category.type !== "GUILD_CATEGORY") {
		embed.title("Invalid category type!")
	} else {
		const path = `mail/${interact.guild!.id}`
		const hasPrevious = await has(path, true)

		if (hasPrevious.result) {
			const data = (await get<Config>(path, true))!
			const channel = (await interact.guild!.channels.fetch(data.channel)) as TextChannel
			const message = await channel.messages.fetch(data.message)
			if (message && message.deletable) await message.delete()
		}

		const message = await interact.channel!.send({
			embeds: [mailEmbed.build()],
			components: mailComponent.build(),
		})
		const config: Config = {
			guild: interact.guild!.id,
			channel: channel.id,
			message: message.id,
			category: category.id,
			timeout: Math.abs(afkTimeout ?? 720),
			channels: [],
		}

		await set(path, config, true)
		timeout(channel)
		embed.title("Setup successful!")
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export async function archive(channel: TextChannel) {
	const path = `mail/${channel.guild.id}`
	const data = (await get<Config>(path, true))!
	const message = await channel.messages.fetch()

	if (message.size > 1) {
		await set(
			`mail/archive/${channel.id}`,
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

		const ms = timeout * 60 * 1000
		const messages = await channel.messages.fetch()
		const diff = Date.now() - (messages.first()?.createdTimestamp ?? channel.createdTimestamp)

		if (diff >= ms) {
			await archive(channel)
			clearInterval(interval)
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
