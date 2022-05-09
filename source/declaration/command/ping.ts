import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/ping").fetchData().invokes(async (interact) => {
	const delay = Date.now() - interact.createdTimestamp
	const embed = new Embed().title(`Pong! (${delay}ms)`)
	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})
