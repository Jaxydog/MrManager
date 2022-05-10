import { ModalSubmitInteraction } from "discord-modals"
import { TextChannel } from "discord.js"
import { Action } from "../../internal/action"
import { get, set } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { applicationComponent, close, Data, Entry, Timezone, timezoneRegExp } from "../command/apply"

export const modalModal = new Action<ModalSubmitInteraction>("modal/apply-modal").invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!
	const channel = (await interact.guild!.channels.fetch(data.output)) as TextChannel

	const entry: Entry = { user: interact.user.id, accepted: false, answers: [] }
	if (timezoneRegExp.test(interact.getTextInputValue("timezone"))) {
		entry.timezone = interact.getTextInputValue("timezone") as Timezone
	}

	const embed = new Embed()
		.author(interact.user.tag, interact.user.avatarURL() ?? undefined)
		.description(
			`**Received:** ${interact.createdAt.toUTCString()}\n**Timezone:** ${
				entry.timezone ?? "N/A"
			}\n**Resubmit:** ${data.responses.some((r) => r.user === interact.user.id)}`
		)
		.footer(`${interact.user.id}`)

	if (!!interact.user.hexAccentColor) embed.color(interact.user.hexAccentColor)

	for (const field of interact.fields) {
		if (field.customId === "timezone") continue

		entry.answers[+field.customId] = field.value
		embed.fields({
			name: data.questions[+field.customId]!,
			value: field.value,
		})
	}

	if (data.responses.some((r) => r.user === interact.user.id)) {
		const index = data.responses.findIndex((r) => r.user === interact.user.id)
		data.responses.splice(index)
	}

	data.responses.push(entry)
	await set(path, data, true)
	await channel.send({ embeds: [embed.build()], components: applicationComponent.build() })
	await interact.update({})
})
export const denyModal = new Action<ModalSubmitInteraction>("modal/apply-deny").invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!
	const user = interact.message.embeds[0]!.footer!.text
	const response = data.responses.findIndex((r) => r.user === user)!
	const member = await interact.guild!.members.fetch(user)
	const embed = new Embed()

	if (!member) {
		embed.title("Invalid member!")
	} else {
		data.responses[response]!.accepted = false

		const reply = new Embed()
			.title(`Your application to ${interact.guild!.name} has been denied`)
			.description(
				"Thank you for submitting an application, however it has unfortunately been denied by the guild's moderators."
			)

		if (!!interact.getField("reason")) reply.fields({ name: "Reason", value: interact.getTextInputValue("reason") })

		const dm = await member.createDM()
		await dm.send({ embeds: [reply.build()] })

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await close("denied", message, interact.getTextInputValue("reason"))

		embed.title("Application denied!")
	}

	await interact.deferReply({ ephemeral: true })
	return await interact.followUp({ embeds: [embed.build()], ephemeral: true })
})
export const resubmitModal = new Action<ModalSubmitInteraction>("modal/apply-resubmit").invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!
	const user = interact.message.embeds[0]!.footer!.text
	const response = data.responses.findIndex((r) => r.user === user)!
	const member = await interact.guild!.members.fetch(user)
	const embed = new Embed()

	if (!member) {
		embed.title("Invalid member!")
	} else {
		data.responses[response]!.accepted = false

		const reply = new Embed()
			.title(`Your application to ${interact.guild!.name} has been marked for resubmit`)
			.description(
				"Thank you for submitting an application, however the guild's moderators have requested that you resubmit a form."
			)

		if (!!interact.getField("reason")) reply.fields({ name: "Reason", value: interact.getTextInputValue("reason") })

		const dm = await member.createDM()
		await dm.send({ embeds: [reply.build()] })

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await close("resubmit", message, interact.getTextInputValue("reason"))

		embed.title("Application resubmit requested!")
	}

	await interact.deferReply({ ephemeral: true })
	return await interact.followUp({ embeds: [embed.build()], ephemeral: true })
})
