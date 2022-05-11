import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { ApplyCommand } from "../declaration"
import { Timezone } from "./apply"

export const action = new Action<CommandInteraction>("command/timezone").fetchData().invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = await get<ApplyCommand.Data>(path, true)
	const embed = new Embed().title("Server timezones")
	const display = interact.options.getBoolean("display") ?? false

	if (!data) {
		embed.description("*No data*")
	} else {
		const count: Map<Timezone, number> = new Map()

		data.responses
			.filter((r) => !!r.timezone)
			.map((r) => {
				r.timezone = r.timezone!.toUpperCase() as Timezone
				if (r.timezone === "UTC-0") r.timezone = "UTC+0"
				return r.timezone
			})
			.sort((a, b) => {
				const aoffset = +a.replace("UTC", "")
				const boffset = +b.replace("UTC", "")
				return aoffset - boffset
			})
			.forEach((z) => {
				let c = count.get(z) ?? 0
				count.set(z, ++c)
			})

		const total = count.size !== 0 ? +[...count.values()].reduce((p, c) => p + c) : 0

		if (total !== 0) {
			const mean = [...count.keys()].find((zone, _, arr) => {
				return arr.every((other) => {
					const zoneVal = count.get(zone)!
					const otherVal = count.get(other)!
					return zoneVal >= otherVal
				})
			})

			embed.description(`**Mean:** ${mean ?? "N/A"}`)

			for (const timezone of count.keys()) {
				const number = count.get(timezone)!
				const percent = total !== 0 ? number / total : 0

				embed.fields({
					name: timezone,
					value: `${(percent * 100).toFixed(2)}%`,
					inline: true,
				})
			}
		} else {
			embed.description("*No timezone data provided*")
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: !display })
})
