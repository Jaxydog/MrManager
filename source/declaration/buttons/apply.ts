import { Modal, showModal, TextInputComponent } from "discord-modals"
import { ButtonInteraction } from "discord.js"
import { Action } from "../../internal/action"
import { get } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { close, Data, reasonInput, timezoneInput } from "../command/apply"

export const modalButton = new Action<ButtonInteraction>("button/apply-modal").invokes(async (interact, client) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!

	if (data.responses.find((r) => r.user === interact.user.id)?.accepted) {
		return await interact.reply({
			embeds: [new Embed().title("You have already been accepted!").build()],
			ephemeral: true,
		})
	}

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
export const acceptButton = new Action<ButtonInteraction>("button/apply-accept").invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!
	const user = interact.message.embeds[0]!.footer!.text
	const response = data.responses.findIndex((r) => r.user === user)!
	const role = await interact.guild!.roles.fetch(data.role)
	const member = await interact.guild!.members.fetch(user)
	const embed = new Embed()

	if (!member) {
		embed.title("Invalid member!")
	} else if (!role) {
		embed.title("Invalid role!")
	} else {
		if (!member.roles.cache.some((r) => r.equals(role))) member.roles.add(role)
		data.responses[response]!.accepted = true

		const reply = new Embed()
			.title(`Your application to ${interact.guild!.name} has been accepted`)
			.description(
				"Thank you for submitting an application, after careful consideration it has been accepted by the guild's moderators!"
			)

		const dm = await member.createDM()
		await dm.send({ embeds: [reply.build()] })

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await close("accepted", message)
		embed.title("Application accepted!")
	}

	return await interact.reply({ embeds: [embed.build()], ephemeral: true })
})
export const denyButton = new Action<ButtonInteraction>("button/apply-deny").invokes(async (interact, client) => {
	const modal = new Modal().setCustomId("apply-deny").setTitle("Deny Application").setComponents(reasonInput)

	try {
		await showModal(modal, { client, interaction: interact })
	} catch {}
})
export const resubmitButton = new Action<ButtonInteraction>("button/apply-resubmit").invokes(
	async (interact, client) => {
		const modal = new Modal()
			.setCustomId("apply-resubmit")
			.setTitle("Request Application Resubmit")
			.setComponents(reasonInput)

		try {
			await showModal(modal, { client, interaction: interact })
		} catch {}
	}
)
