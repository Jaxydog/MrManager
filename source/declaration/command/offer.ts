import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/offer").fetchData().invokes(async (interact) => {
	const offering = interact.options.getString("offering", true)
	const wanting = interact.options.getString("wanting")
	const duration = interact.options.getInteger("duration") ?? -1

	const embed = new Embed()
		.author(interact.user.tag, interact.user.avatarURL() ?? undefined)
		.description(`**Duration:** ${duration !== -1 ? `${Math.abs(duration)} hours` : "Indefinite"}`)
		.fields({ name: "Offering", value: offering, inline: true })

	if (wanting) embed.fields({ name: "Wanting", value: wanting, inline: true })

	await interact.reply({ embeds: [embed.build()] })
})
