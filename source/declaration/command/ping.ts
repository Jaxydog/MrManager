import { CommandInteraction, Message } from "discord.js"
import { Action } from "../../internal/action"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/ping").fetchData().invokes(async (interact) => {
	const embed = new Embed().title(`Pong! (...)`)
	await interact.reply({ embeds: [embed.build()], ephemeral: true })
	const reply = (await interact.fetchReply()) as Message
	const delay = reply.createdTimestamp - interact.createdTimestamp
	await interact.editReply({ embeds: [embed.title(`Pong! (${delay} ms)`).build()] })
})
