import { CommandInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { Embed } from "../../wrapper/embed"

export const action = new Action<CommandInteraction>("command/embed").fetchData().invokes(async (interact) => {
	const authorName = interact.options.getString("author_name") ?? ""
	const authorIcon = interact.options.getString("author_icon") ?? ""
	const authorUrl = interact.options.getString("author_url") ?? ""
	const title = interact.options.getString("title") ?? ""
	const description = interact.options.getString("description") ?? ""
	const image = interact.options.getString("image") ?? ""
	const thumbnail = interact.options.getString("thumbnail") ?? ""
	const footerText = interact.options.getString("footer_text") ?? ""
	const footerIcon = interact.options.getString("footer_icon") ?? ""
	const color = interact.options.getString("color") ?? "0xaa586c"
	const url = interact.options.getString("url") ?? ""
	const preview = interact.options.getBoolean("preview") ?? false

	const embed = new Embed()
		.author(authorName, authorIcon, authorUrl)
		.title(title)
		.description(description)
		.image(image)
		.thumbnail(thumbnail)
		.footer(footerText, footerIcon)
		.color(+color)
		.url(url)

	try {
		await interact.reply({ embeds: [embed.build()], ephemeral: preview })
	} catch (error) {
		await interact.reply({
			embeds: [new Embed().title("Error creating embed!").description(`\`\`\`\n${error}\n\`\`\``).build()],
			ephemeral: true,
		})
	}
})
