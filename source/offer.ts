import { EmbedBuilder } from "@jaxydog/dibbs"
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums"
import { client } from "./main"
import { defaultColor, getUnixIn } from "./common/util"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { Err } from "./common/err"

client.commands
	.define(ID.Offer.Command, {
		name: ID.Offer.Command,
		description: Text.Offer.Command,
		dm_permission: false,
		options: [
			{
				name: ID.Offer.Option.Giving,
				description: Text.Offer.Option.Giving,
				type: ApplicationCommandOptionTypes.STRING,
				required: true,
			},
			{
				name: ID.Offer.Option.Wanting,
				description: Text.Offer.Option.Wanting,
				type: ApplicationCommandOptionTypes.STRING,
				required: true,
			},
			{
				name: ID.Offer.Option.Duration,
				description: Text.Offer.Option.Duration,
				type: ApplicationCommandOptionTypes.INTEGER,
				required: true,
			},
		],
	})
	.create(ID.Offer.Command, async ({ interact }) => {
		await interact.deferReply({})

		try {
			await interact.user.fetch()

			const giving = interact.options.getString(ID.Offer.Option.Giving, true)
			const wanting = interact.options.getString(ID.Offer.Option.Wanting, true)
			const duration = interact.options.getInteger(ID.Offer.Option.Duration, true)

			const description = `**Offer ends:** ${
				duration !== -1 && duration !== 0
					? `<t:${getUnixIn(Math.abs(duration * 60), interact.createdTimestamp)}:R>`
					: "*Not provided*"
			}`
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.author(interact.user.tag, interact.user.avatarURL() ?? "")
				.description(description)
				.thumbnail(interact.user.avatarURL() ?? "")
				.fields({ name: Text.Offer.OfferingName, value: giving, inline: true })
				.fields({ name: Text.Offer.WantingName, value: wanting, inline: true })
				.build()

			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.FailedExecute)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
