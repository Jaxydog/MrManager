import { Modal, showModal, TextInputComponent } from "discord-modals"
import { ButtonInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get, set } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { PollCommand } from "../declaration"

export const modalButton = new Action<ButtonInteraction>("button/poll-modal").invokes(async (interact, client) => {
	const path = `poll/${interact.message.embeds[0]!.footer!.text}`
	const data = (await get<PollCommand.Data>(path, true))!

	if (interact.user.id === data.metadata.user) {
		return await interact.reply({
			embeds: [new Embed().title("You can't respond to your own poll!").build()],
			ephemeral: true,
		})
	}
	if (data.responses.some((r) => r.user === interact.user.id)) {
		return await interact.reply({
			embeds: [new Embed().title("You've already submitted a response!").build()],
			ephemeral: true,
		})
	}

	const form = new Modal()
		.setCustomId(`poll-modal;${data.metadata.guild};${data.metadata.user}`)
		.setTitle(interact.message.embeds[0]!.title!)

	for (const option of data.options) {
		form.addComponents(
			new TextInputComponent()
				.setCustomId(`${option.name}`)
				.setStyle("LONG")
				.setLabel(`${option.icon} ${option.name} ${option.icon}`)
				.setRequired(option.required)
		)
	}

	await showModal(form, { client, interaction: interact })
})
export const optionButton = new Action<ButtonInteraction>("button/poll-option").invokes(async (interact) => {
	const path = `poll/${interact.message.embeds[0]!.footer!.text}`
	const data = (await get<PollCommand.Data>(path, true))!

	if (interact.user.id === data.metadata.user) {
		return await interact.reply({
			embeds: [new Embed().title("You can't respond to your own poll!").build()],
			ephemeral: true,
		})
	}
	if (data?.responses.some((r) => r.user === interact.user.id)) {
		return await interact.reply({
			embeds: [new Embed().title("You've already submitted a response!").build()],
			ephemeral: true,
		})
	}

	data.responses.push({
		user: interact.user.id,
		data: interact.component.label!,
	})
	await set(path, data, true)
	interact.deferUpdate()
})
