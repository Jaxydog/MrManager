import { TextInputComponent } from "discord-modals"
import { CommandInteraction, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { get, has, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Timezone = `UTC${"+" | "-"}${number}`
export interface Entry {
	user: string
	timezone?: Timezone
	answers: string[]
}
export interface Data {
	channel: string
	message: string
	questions: string[]
	responses: Entry[]
}

export const modalButton = new MessageButton()
	.setCustomId("apply-modal")
	.setStyle(MessageButtonStyles.PRIMARY)
	.setLabel("Apply")
	.setEmoji("👋")

export const timezoneInput = new TextInputComponent()
	.setCustomId("timezone")
	.setStyle("SHORT")
	.setLabel("Timezone (UTC offset)")
	.setRequired(true)
	.setPlaceholder("UTC+0")
	.setMinLength(5)
	.setMaxLength(6)

export const timezoneRegExp = /^UTC([+-][0-9]{1,2})$/i

export const action = new Action<CommandInteraction>("command/apply").fetchData().invokes(async (interact) => {
	const description = interact.options.getString("description", true)
	const branding = interact.options.getString("branding", true)
	const question1 = interact.options.getString("question_1", true)
	const question2 = interact.options.getString("question_2")
	const question3 = interact.options.getString("question_3")
	const question4 = interact.options.getString("question_4")
	const path = `apps/${interact.guild!.id}`

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
		questions: [question1],
		responses: [],
	}
	if (question2) data.questions.push(question2)
	if (question3) data.questions.push(question3)
	if (question4) data.questions.push(question4)

	await set(`apps/${interact.guild!.id}`, data, true)
	interact.reply({
		embeds: [new Embed().title("Set up applications!").build()],
		ephemeral: true,
	})
})
