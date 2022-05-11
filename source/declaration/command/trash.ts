import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { clr } from "../../internal/data"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/trash").fetchData().invokes(async (interact) => {
	const embed = new Embed()

	if (interact.user.id === process.env["OWNERID"]) {
		clr(true)
		embed.title("Cleared data cache!")
	} else {
		embed.title("Invalid permission level!")
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})
