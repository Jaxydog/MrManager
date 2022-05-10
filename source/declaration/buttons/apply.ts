import { Modal, showModal, TextInputComponent } from "discord-modals"
import { ButtonInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get } from "../../internal/data"
import { Data, timezoneInput } from "../command/apply"

export const modalButton = new Action<ButtonInteraction>("button/apply-modal").invokes(async (interact, client) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!

	const form = new Modal().setCustomId("apply-modal").setTitle(`Apply to ${interact.guild!.name}`)

	for (const question of data.questions) {
		form.addComponents(
			new TextInputComponent()
				.setCustomId(`${data.questions.indexOf(question)}`)
				.setStyle("LONG")
				.setLabel(question)
				.setRequired(true)
		)
	}

	form.addComponents(timezoneInput)
	await showModal(form, { client, interaction: interact })
})
