import { EmbedBuilder } from "@jaxydog/dibbs"
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { client } from "./main"
import { defaultColor } from "./common/util"

client.commands
	.define("embed", {
		name: "embed",
		description: "Create a rich embed",
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				name: "author_name",
				description: "Embed author name (text)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "author_icon",
				description: "Embed author icon (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "author_url",
				description: "Embed author URL (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "title",
				description: "Embed title (text)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "description",
				description: "Embed description (text / markdown)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "image",
				description: "Embed image (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "thumbnail",
				description: "Embed thumbnail (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "footer_text",
				description: "Embed footer text (text)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "footer_icon",
				description: "Embed footer icon (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "color",
				description: "Embed color (hex)",
				type: ApplicationCommandOptionTypes.INTEGER,
			},
			{
				name: "url",
				description: "Embed url (URL)",
				type: ApplicationCommandOptionTypes.STRING,
			},
			{
				name: "preview",
				description: "Whether to view a preview of the embed",
				type: ApplicationCommandOptionTypes.BOOLEAN,
			},
		],
	})
	.create("embed", async ({ interact }) => {
		const authorName = interact.options.getString("author_name") ?? ""
		const authorIcon = interact.options.getString("author_icon") ?? ""
		const authorUrl = interact.options.getString("author_url") ?? ""
		const title = interact.options.getString("title") ?? ""
		const description = interact.options.getString("description") ?? ""
		const image = interact.options.getString("image") ?? ""
		const thumbnail = interact.options.getString("thumbnail") ?? ""
		const footerText = interact.options.getString("footer_text") ?? ""
		const footerIcon = interact.options.getString("footer_icon") ?? ""
		const color_ = interact.options.getInteger("color") ?? defaultColor
		const url = interact.options.getString("url") ?? ""
		const preview = interact.options.getBoolean("preview") ?? false

		const embed = new EmbedBuilder()
			.author(authorName, authorIcon, authorUrl)
			.title(title)
			.description(description)
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
