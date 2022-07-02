import { EmbedBuilder } from "@jaxydog/dibbs"
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { client } from "./main"
import { defaultColor } from "./common/util"
import { ID } from "./common/id"
import { Text } from "./common/text"

client.commands
	.define(ID.Embed.Command, {
		name: ID.Embed.Command,
		description: Text.Embed.Command,
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				name: ID.Embed.Options.AuthorIcon,
				description: Text.Embed.Options.AuthorIcon,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.AuthorName,
				description: Text.Embed.Options.AuthorName,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.AuthorUrl,
				description: Text.Embed.Options.AuthorUrl,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.Color,
				description: Text.Embed.Options.Color,
				type: ApplicationCommandOptionTypes.INTEGER,
			},
			{
				name: ID.Embed.Options.Description,
				description: Text.Embed.Options.Description,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.FooterIcon,
				description: Text.Embed.Options.FooterIcon,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.FooterText,
				description: Text.Embed.Options.FooterText,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.Image,
				description: Text.Embed.Options.Image,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.Preview,
				description: Text.Embed.Options.Preview,
				type: ApplicationCommandOptionTypes.BOOLEAN,
			},
			{
				name: ID.Embed.Options.Thumbnail,
				description: Text.Embed.Options.Thumbnail,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.Title,
				description: Text.Embed.Options.Title,
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: ID.Embed.Options.Url,
				description: Text.Embed.Options.Url,
				type: ApplicationCommandOptionTypes.STRING,
			},
		],
	})
	.create(ID.Embed.Command, async ({ interact }) => {
		const authorIcon = interact.options.getString(ID.Embed.Options.AuthorIcon) ?? ""
		const authorName = interact.options.getString(ID.Embed.Options.AuthorName) ?? ""
		const authorUrl = interact.options.getString(ID.Embed.Options.AuthorUrl) ?? ""
		const color_ = interact.options.getInteger(ID.Embed.Options.Color) ?? defaultColor
		const description = interact.options.getString(ID.Embed.Options.Description) ?? ""
		const footerIcon = interact.options.getString(ID.Embed.Options.FooterIcon) ?? ""
		const footerText = interact.options.getString(ID.Embed.Options.FooterText) ?? ""
		const image = interact.options.getString(ID.Embed.Options.Image) ?? ""
		const preview = interact.options.getBoolean(ID.Embed.Options.Preview) ?? false
		const thumbnail = interact.options.getString(ID.Embed.Options.Thumbnail) ?? ""
		const title = interact.options.getString(ID.Embed.Options.Title) ?? ""
		const url = interact.options.getString(ID.Embed.Options.Url) ?? ""

		const embed = new EmbedBuilder()
			.author(authorName, authorIcon, authorUrl)
			.title(title)
			.description(description.replace(/\\n/g, "\n"))
			.image(image)
			.thumbnail(thumbnail)
			.footer(footerText, footerIcon)
			.color(color_)
			.url(url)
			.build()

		try {
			await interact.reply({ embeds: [embed], ephemeral: preview })
		} catch (error) {
			const reply = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.FailedExecute)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [reply], ephemeral: true })
		}
	})
