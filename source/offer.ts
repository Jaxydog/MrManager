import { EmbedBuilder } from "@jaxydog/dibbs"
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums"
import { client } from "./main"
import { defaultColor, getUnixIn } from "./common/util"

client.commands
	.define("offer", {
		name: "offer",
		description: "Posts a trade / service offer",
		dm_permission: false,
		options: [
			{
				name: "giving",
				description: "The item or service that you are offering",
				type: ApplicationCommandOptionTypes.STRING,
				required: true,
			},
			{
				name: "wanting",
				description: "The item or service that you want in return",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "duration",
				description: "The amount of time (hours) that this offer will be valid for",
				type: ApplicationCommandOptionTypes.INTEGER,
			},
		],
	})
	.create("offer", async ({ interact }) => {
		interact.deferReply({})

		const giving = interact.options.getString("giving", true)
		const wanting = interact.options.getString("wanting")
		const duration = interact.options.getInteger("duration") ?? -1

		await interact.user.fetch()

		const description = `**Offer ends:** ${
			duration !== -1 && duration !== 0
				? `${getUnixIn(duration * 60, interact.createdTimestamp)}`
				: "*Not provided*"
		}`
		const embed = new EmbedBuilder()
			.color(defaultColor)
			.author(interact.user.tag, interact.user.avatarURL() ?? undefined)
			.description(description)
			.fields({ name: "Offering", value: giving, inline: true })

		if (wanting) embed.fields({ name: "Wanting", value: wanting, inline: true })

		await interact.followUp({ embeds: [embed.build()] })
	})
