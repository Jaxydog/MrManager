import { Modal, TextInputComponent } from "discord-modals"
import { CommandInteraction, Message, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { get, has, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Timezone = `UTC${"+" | "-"}${number}`
export interface Entry {
	user: string
	accepted: boolean
	timezone?: Timezone
	answers: string[]
}
export interface Data {
	channel: string
	message: string
	output: string
	role: string
	questions: string[]
	responses: Entry[]
}

export const modalButton = new MessageButton()
	.setCustomId("apply-modal")
	.setStyle(MessageButtonStyles.PRIMARY)
	.setLabel("Apply")
	.setEmoji("👋")
export const acceptButton = new MessageButton()
	.setCustomId("apply-accept")
	.setStyle(MessageButtonStyles.SUCCESS)
	.setLabel("Accept")
	.setEmoji("👍")
export const denyButton = new MessageButton()
	.setCustomId("apply-deny")
	.setStyle(MessageButtonStyles.DANGER)
	.setLabel("Deny")
	.setEmoji("👎")
export const resubmitButton = new MessageButton()
	.setCustomId("apply-resubmit")
	.setStyle(MessageButtonStyles.SECONDARY)
	.setLabel("Resubmit")
	.setEmoji("🤷")
export const applicationComponent = new Component()
applicationComponent.add(acceptButton)
applicationComponent.add(denyButton)
applicationComponent.add(resubmitButton)

export const timezoneInput = new TextInputComponent()
	.setCustomId("timezone")
	.setStyle("SHORT")
	.setLabel("Timezone (UTC offset)")
	.setRequired(true)
	.setPlaceholder("UTC+0")
	.setMinLength(5)
	.setMaxLength(6)
export const reasonInput = new TextInputComponent()
	.setCustomId("reason")
	.setStyle("SHORT")
	.setLabel("Reason")
	.setRequired(false)

export const timezoneRegExp = /^UTC([+-][0-9]{1,2})$/i

export const action = new Action<CommandInteraction>("command/apply").fetchData().invokes(async (interact) => {
	const output = interact.options.getChannel("output", true)
	const role = interact.options.getRole("role", true)
	const description = interact.options.getString("description", true)
	const branding = interact.options.getString("branding", true)
	const question1 = interact.options.getString("question_1", true)
	const question2 = interact.options.getString("question_2")
	const question3 = interact.options.getString("question_3")
	const question4 = interact.options.getString("question_4")
	const path = `apps/${interact.guild!.id}`

	if (output.type !== "GUILD_TEXT") {
		return await interact.reply({
			embeds: [new Embed().title("Invalid channel!").build()],
			ephemeral: true,
		})
	}

	if ((await has(path, true)).result) {
		const data = (await get<Data>(path, true))!
		const channel = (await interact.guild!.channels.fetch(data.channel)) as TextChannel
		const message = await channel.messages.fetch(data.message)
		await message.delete()
	}

	const embed = new Embed().title(`Apply to ${interact.guild!.name}`).description(description).thumbnail(branding)
	const component = new Component()
	component.add(modalButton)
	const message = await interact.channel!.send({
		embeds: [embed.build()],
		components: component.build(),
	})

	const data: Data = {
		channel: message.channel.id,
		message: message.id,
		output: output.id,
		role: role.id,
		questions: [question1],
		responses: [],
	}
	if (question2) data.questions.push(question2)
	if (question3) data.questions.push(question3)
	if (question4) data.questions.push(question4)

	await set(`apps/${interact.guild!.id}`, data, true)
	await interact.reply({
		embeds: [new Embed().title("Set up applications!").build()],
		ephemeral: true,
	})
})

export async function close(type: string, message: Message) {
	message.embeds[0]!.title = `(${type.toUpperCase()})`

	const components = message.components.map((row) => {
		row.components.map((component) => {
			component.setDisabled(true)
			return component
		})
		return row
	})

	await message.edit({ embeds: message.embeds, components })
}
