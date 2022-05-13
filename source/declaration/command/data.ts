import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { Cache, get } from "../../internal/data"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "view" | "dump" | "clear"

export const action = new Action<CommandInteraction>("command/data").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed = new Embed()

	if (interact.user.id !== process.env["OWNERID"]) {
		embed.title("Invalid permission level!")
	} else {
		switch (subcommand) {
			case "view": {
				embed = await Command.viewSub(interact, embed)
				break
			}
			case "dump": {
				embed = await Command.dumpSub(embed)
				break
			}
			case "clear": {
				embed = await Command.clearSub(embed)
				break
			}
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export module Command {
	export async function viewSub(interact: CommandInteraction, embed: Embed) {
		const id = interact.options.getString("id", true)
		const data = await get(id)
		const content = JSON.stringify(data ? data : { error: "Data not stored!" }, null, "\t")
		return embed.title(`ID: ${id}`).description(`\`\`\`json\n${content}\n\`\`\``)
	}
	export async function dumpSub(embed: Embed) {
		let desc = ""

		await Cache.all(
			"",
			(_, path) => {
				desc += `\`${path}\`\n`
			},
			true
		)

		return embed.title("Cache contents").description(desc)
	}
	export async function clearSub(embed: Embed) {
		Cache.clr(true)
		return embed.title("Cleared data cache!")
	}
}
