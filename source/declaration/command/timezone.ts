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
		const zones: Map<string, number> = new Map()

		for (let { timezone } of data.responses) {
			if (!timezone) continue
			timezone = timezone.toUpperCase() as ApplyCommand.Timezone
			if (timezone === "UTC-0") timezone = "UTC+0"

			let count = zones.get(timezone) ?? 0
			zones.set(timezone, ++count)
		}

		const total = [...zones.values()].reduce((p, c) => p + c)
		const mean = [...zones.keys()].find((zone, _, arr) => {
			return arr.every((other) => {
				const zoneVal = zones.get(zone)!
				const otherVal = zones.get(other)!
				return zoneVal >= otherVal
			})
		})!

		embed.description(`**Most common zone:** ${mean}`)

		for (const timezone of zones.keys()) {
			const count = zones.get(timezone)!
			const percent = total !== 0 ? count / total : 0

			embed.fields({
				name: timezone,
				value: `${(percent * 100).toFixed(2)}%`,
				inline: true,
			})
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: !display })
})
