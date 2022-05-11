import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { ApplyCommand } from "../declaration"

export const action = new Action<CommandInteraction>("command/timezone").fetchData().invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = await get<ApplyCommand.Data>(path, true)
	const embed = new Embed().title("Server timezones")
	const display = interact.options.getBoolean("display") ?? false

	if (!data) {
		embed.description("*No data*")
	} else {
		const count = new Map()
		const zones = data.responses
			.filter((r) => !!r.timezone)
			.map((r) => r.timezone!.toUpperCase())
			.map((r) => {
				if (r === "UTC-0") r = "UTC+0"
				return r
			})
			.sort((a, b) => {
				const aoffset = +a.replace("UTC", "")
				const boffset = +b.replace("UTC", "")
				return aoffset - boffset
			})

		for (const zone of zones) {
			let number = count.get(zone) ?? 0
			count.set(zone, ++number)
		}

		const total = +[...count.values()].reduce((p, c) => p + c)
		const mean = [...count.keys()].find((zone, _, arr) => {
			return arr.every((other) => {
				const zoneVal = count.get(zone)!
				const otherVal = count.get(other)!
				return zoneVal >= otherVal
			})
		})!

		embed.description(`**Most common zone:** ${mean}`)

		for (const timezone of count.keys()) {
			const number = count.get(timezone)!
			const percent = total !== 0 ? number / total : 0

			embed.fields({
				name: timezone,
				value: `${(percent * 100).toFixed(2)}%`,
				inline: true,
			})
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: !display })
})
