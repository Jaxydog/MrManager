import { Client, TextChannel } from "discord.js"
import { BotConfig, MailConfig } from "../types"
import { all, get, set } from "./data"

export async function archive(channel: TextChannel) {
	if (!channel) return
	const messages = await channel.messages.fetch()

	if (messages.size > 1) {
		await set(
			`mail/archive/${channel.id}`,
			messages.reverse().map((message) => ({
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

	const path = `mail/${channel.guild.id}`
	const data = (await get<MailConfig>(path, true))!
	data.channels.splice(data.channels.findIndex((c) => c.channel === channel.id))
	await set(path, data, true)

	await channel.delete()
}
export async function timeAFK(channel: TextChannel) {
	const { mailInterval } = (await get<BotConfig>("bot/config", true))!
	const interval = setInterval(
		async (channel) => {
			if (!channel) {
				clearInterval(interval)
				return
			}

			try {
				const messages = (await channel!.messages.fetch())!
				const latest = messages.first()?.createdTimestamp ?? channel.createdTimestamp
				const { timeout } = (await get<MailConfig>(`mail/${channel.guild.id}`, true))!

				if (Date.now() - latest >= timeout * 60 * 1000) {
					await archive(channel)
					clearInterval(interval)
				}
			} catch {}
		},
		mailInterval,
		channel
	)
}
export async function refresh(client: Client) {
	await all<MailConfig>(
		"mail",
		async (data) => {
			for (const { channel } of data.channels) {
				const guild = await client.guilds.fetch(data.guild)
				const textChannel = await guild.channels.fetch(channel)
				await timeAFK(textChannel as TextChannel)
			}
		},
		true
	)
}
