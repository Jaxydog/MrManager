import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get } from "../../internal/data"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/data").fetchData().invokes(async (interact) => {
	const id = interact.options.getString("id", true)
	const embed = new Embed()
	let hide = interact.options.getBoolean("hide") ?? true

	if (interact.user.id === process.env["OWNERID"]) {
		const data = await get(id)
		const content = JSON.stringify(data ? data : { error: "Data not stored!" }, null, "\t")
		embed.title(`ID: ${id}`).description(`\`\`\`json\n${content}\n\`\`\``)
	} else {
		embed.title("Invalid permission level!")
		hide = true
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: hide })
})
