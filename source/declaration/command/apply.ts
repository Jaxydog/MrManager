import { Modal, ModalSubmitInteraction, showModal, TextInputComponent } from "discord-modals"
import { ButtonInteraction, CommandInteraction, Message, MessageButton, TextChannel, User } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { get, has, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "setup" | "view" | "timezone"
export type Timezone = `UTC${"+" | "-"}${number}`

export interface Entry {
	user: string
	active: boolean
	accepted: boolean
	resubmit: boolean
	received: string
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

export const action = new Action<CommandInteraction>("command/apply").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed = new Embed()

	switch (subcommand) {
		case "setup": {
			embed = await Commands.setupSub(interact, embed)
			break
		}
		case "view": {
			embed = await Commands.viewSub(interact, embed)
			break
		}
		case "timezone": {
			embed = await Commands.timezoneSub(interact, embed)
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export module Predefined {
	export const timezoneRegExp = /^UTC([+-][0-9]{1,2})$/i

	export const modalBtn = new MessageButton()
		.setCustomId("apply-modal")
		.setStyle(MessageButtonStyles.PRIMARY)
		.setLabel("Apply")
		.setEmoji("👋")
	export const acceptBtn = new MessageButton()
		.setCustomId("apply-accept")
		.setStyle(MessageButtonStyles.SUCCESS)
		.setLabel("Accept")
		.setEmoji("👍")
	export const denyBtn = new MessageButton()
		.setCustomId("apply-deny")
		.setStyle(MessageButtonStyles.DANGER)
		.setLabel("Deny")
		.setEmoji("👎")
	export const resubmitBtn = new MessageButton()
		.setCustomId("apply-resubmit")
		.setStyle(MessageButtonStyles.SECONDARY)
		.setLabel("Resubmit")
		.setEmoji("🤷")

	export const modalCmp = new Component()
	modalCmp.add(modalBtn)
	export const appCmp = new Component()
	appCmp.add(acceptBtn)
	appCmp.add(denyBtn)
	appCmp.add(resubmitBtn)

	export const timezoneInp = new TextInputComponent()
		.setCustomId("timezone")
		.setStyle("SHORT")
		.setLabel("Timezone (UTC offset)")
		.setRequired(true)
		.setPlaceholder("UTC+0")
		.setMinLength(5)
		.setMaxLength(6)
	export const reasonInp = new TextInputComponent()
		.setCustomId("reason")
		.setStyle("SHORT")
		.setLabel("Reason")
		.setRequired(false)
}
export module Commands {
	export async function setupSub(interact: CommandInteraction, embed: Embed) {
		const output = interact.options.getChannel("output", true)
		const role = interact.options.getRole("role", true)
		const description = interact.options.getString("description", true)
		const branding = interact.options.getString("branding", true)
		const question1 = interact.options.getString("question_1", true)
		const question2 = interact.options.getString("question_2")
		const question3 = interact.options.getString("question_3")
		const question4 = interact.options.getString("question_4")
		const path = Utility.dataPath(interact.guild!.id)

		if (output.type !== "GUILD_TEXT") {
			return embed.title("Invalid channel type!")
		}
		if (question1.length > 45) {
			return embed.title("Question 1 exceeds 45 characters!")
		}
		if (question2 && question2.length > 45) {
			return embed.title("Question 2 exceeds 45 characters!")
		}
		if (question3 && question3.length > 45) {
			return embed.title("Question 3 exceeds 45 characters!")
		}
		if (question4 && question4.length > 45) {
			return embed.title("Question 4 exceeds 45 characters!")
		}

		if ((await has(path)).result) {
			const data = (await get<Data>(path))!
			const channel = (await interact.guild!.channels.fetch(data.channel)) as TextChannel | null
			const message = await channel?.messages.fetch(data.message)
			if (message && message.deletable) await message.delete()
		}

		const form = new Embed().title(`Apply to ${interact.guild!.name}`).description(description).thumbnail(branding)

		const message = await interact.channel!.send({
			embeds: [form.build()],
			components: Predefined.modalCmp.build(),
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

		const { result } = await set(path, data)
		return embed.title(result ? "Set up applications!" : "Error setting up applications!")
	}
	export async function viewSub(interact: CommandInteraction, embed: Embed) {
		const user = interact.options.getUser("user", true)
		const path = Utility.dataPath(interact.guild!.id)

		if (!(await has(path)).result) {
			return embed.title("No application data stored!")
		}

		const data = (await get<Data>(path))!

		if (!data.responses.some((r) => r.user === user.id)) {
			return embed.title("User has not applied!")
		}

		return Utility.getEmbed(user, data)
	}
	export async function timezoneSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id)

		if (!(await has(path)).result) {
			return embed.title("No application data stored!")
		}

		const data = (await get<Data>(path))!
		const count: Map<Timezone, number> = new Map()

		data.responses
			.filter((r) => !!r.timezone)
			.map((r) => r.timezone!)
			.map((t) => {
				t = t.toUpperCase() as Timezone
				if (t === "UTC-0") t = "UTC+0"
				return t
			})
			.sort((a, b) => {
				const aOff = +a.replace("UTC", "")
				const bOff = +b.replace("UTC", "")
				return aOff - bOff
			})
			.forEach((t) => {
				let c = count.get(t) ?? 0
				count.set(t, ++c)
			})

		const total = count.size !== 0 ? +[...count.values()].reduce((p, c) => p + c) : 0

		if (total === 0) {
			return embed.title("No timezone data stored!")
		}

		const meanZones = [...count.keys()].filter((t, _, a) => {
			return a.every((o) => {
				const tCount = count.get(t)!
				const oCount = count.get(o)!
				return tCount >= oCount
			})
		})
		const mean = `**Mean:** ${meanZones.join(", ")}`

		for (const timezone of count.keys()) {
			const number = count.get(timezone)!
			const ratio = total !== 0 ? number / total : 0
			const percent = (ratio * 100).toFixed(2)
			const value = `${number} (${percent}%)`

			embed.fields({ name: timezone, value, inline: true })
		}

		return embed.title("Server timezones").description(mean)
	}
}
export module Buttons {
	export const modalBtn = new Action<ButtonInteraction>("button/apply-modal").invokes(async (interact, client) => {
		const path = Utility.dataPath(interact.guild!.id)
		const data = (await get<Data>(path))!

		const response = data.responses.find((r) => r.user === interact.user.id)

		if (response?.active) {
			return await interact.reply({
				embeds: [new Embed().title("You already have an active application!").build()],
				ephemeral: true,
			})
		}
		if (response?.accepted) {
			return await interact.reply({
				embeds: [new Embed().title("You have already been accepted!").build()],
				ephemeral: true,
			})
		}

		const form = new Modal().setCustomId("apply-submit").setTitle(`Apply to ${interact.guild!.name}`)

		for (const question of data.questions) {
			const index = data.questions.indexOf(question)
			const input = new TextInputComponent()
				.setCustomId(`${index}`)
				.setStyle("LONG")
				.setLabel(question)
				.setRequired(true)
			form.addComponents(input)
		}
		form.addComponents(Predefined.timezoneInp)

		await showModal(form, { client, interaction: interact })
	})
	export const acceptBtn = new Action<ButtonInteraction>("button/apply-accept").invokes(async (interact) => {
		const path = Utility.dataPath(interact.guild!.id)
		const data = (await get<Data>(path))!

		const userId = interact.message.embeds[0]!.footer!.text
		const member = await interact.guild!.members.fetch(userId)
		const role = await interact.guild!.roles.fetch(data.role)
		const responseIdx = data.responses.findIndex((r) => r.user === userId)

		if (!member) {
			return await interact.reply({
				embeds: [new Embed().title("Member not in guild!").build()],
				ephemeral: true,
			})
		}
		if (!role) {
			return await interact.reply({
				embeds: [new Embed().title("Invalid membership role!").build()],
				ephemeral: true,
			})
		}
		if (responseIdx === -1) {
			return await interact.reply({
				embeds: [new Embed().title("Can't find application response!").build()],
				ephemeral: true,
			})
		}

		if (member.roles.cache.every((r) => !r.equals(role))) {
			member.roles.add(role)
		}
		data.responses[responseIdx]!.accepted = true

		const dm = await member.createDM()
		await dm.send({
			embeds: [
				new Embed()
					.title(`Your application to ${interact.guild!.name} has been accepted!`)
					.description(
						"Thank you for submitting an application, after careful consideration it has been accepted by the guild's moderators!"
					)
					.build(),
			],
		})

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await Utility.closeApp(member.user, data, "accepted", message)
		return await interact.reply({
			embeds: [new Embed().title("Accepted application!").build()],
			ephemeral: true,
		})
	})
	export const denyBtn = new Action<ButtonInteraction>("button/apply-deny").invokes(async (interact, client) => {
		const form = new Modal()
			.setCustomId("apply-deny")
			.setTitle("Deny Application")
			.setComponents(Predefined.reasonInp)

		try {
			await showModal(form, { client, interaction: interact })
		} catch {}
	})
	export const resubmitBtn = new Action<ButtonInteraction>("button/apply-resubmit").invokes(
		async (interact, client) => {
			const form = new Modal()
				.setCustomId("apply-resubmit")
				.setTitle("Request Resubmit")
				.setComponents(Predefined.reasonInp)

			try {
				await showModal(form, { client, interaction: interact })
			} catch {}
		}
	)
}
export module Modals {
	export const modalMdl = new Action<ModalSubmitInteraction>("modal/apply-submit").invokes(async (interact) => {
		const path = Utility.dataPath(interact.guild!.id)
		const data = (await get<Data>(path))!

		const entry: Entry = {
			user: interact.user.id,
			active: true,
			accepted: false,
			received: interact.createdAt.toUTCString(),
			resubmit: data.responses.some((r) => r.user === interact.user.id),
			answers: [],
		}

		interact.fields.forEach(({ customId, value }) => {
			entry.answers[+customId] = value
		})

		if (Predefined.timezoneRegExp.test(interact.getTextInputValue("timezone"))) {
			entry.timezone = interact.getTextInputValue("timezone") as Timezone
		}

		if (data.responses.some((r) => r.user === interact.user.id)) {
			const idx = data.responses.findIndex((r) => r.user === interact.user.id)
			data.responses.splice(idx)
		}

		const channel = (await interact.guild!.channels.fetch(data.output)) as TextChannel
		data.responses.push(entry)

		await set(path, data)
		await channel.send({
			embeds: [(await Utility.getEmbed(interact.user, data)).build()],
			components: Predefined.appCmp.build(),
		})
		await interact.deferReply({ ephemeral: true })
		await interact.followUp({ embeds: [new Embed().title("Application submitted!").build()], ephemeral: true })
	})
	export const denyMdl = new Action<ModalSubmitInteraction>("modal/apply-deny").invokes(async (interact) => {
		const path = Utility.dataPath(interact.guild!.id)
		const data = (await get<Data>(path))!

		const userId = interact.message.embeds[0]!.footer!.text
		const member = await interact.guild!.members.fetch(userId)
		const responseIdx = data.responses.findIndex((r) => r.user === userId)

		if (!member) {
			return await interact.reply({
				embeds: [new Embed().title("Member not in guild!").build()],
				ephemeral: true,
			})
		}
		if (responseIdx === -1) {
			return await interact.reply({
				embeds: [new Embed().title("Can't find application response!").build()],
				ephemeral: true,
			})
		}

		const reason = `**Reason:** ${interact.getTextInputValue("reason") ?? "N/A"}`
		const dm = await member.createDM()
		await dm.send({
			embeds: [
				new Embed()
					.title(`Your application to ${interact.guild!.name} has been denied.`)
					.description(
						`Thank you for submitting an application, however it has unfortunately been denied by the guild's moderators.\n\n${reason}`
					)
					.build(),
			],
		})

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await Utility.closeApp(member.user, data, "denied", message)

		await interact.deferReply({ ephemeral: true })
		return await interact.followUp({
			embeds: [new Embed().title("Denied application!").build()],
			ephemeral: true,
		})
	})
	export const resubmitMdl = new Action<ModalSubmitInteraction>("modal/apply-resubmit").invokes(async (interact) => {
		const path = Utility.dataPath(interact.guild!.id)
		const data = (await get<Data>(path))!

		const userId = interact.message.embeds[0]!.footer!.text
		const member = await interact.guild!.members.fetch(userId)
		const responseIdx = data.responses.findIndex((r) => r.user === userId)

		if (!member) {
			return await interact.reply({
				embeds: [new Embed().title("Member not in guild!").build()],
				ephemeral: true,
			})
		}
		if (responseIdx === -1) {
			return await interact.reply({
				embeds: [new Embed().title("Can't find application response!").build()],
				ephemeral: true,
			})
		}

		const reason = `**Reason:** ${interact.getTextInputValue("reason") ?? "N/A"}`
		const dm = await member.createDM()
		await dm.send({
			embeds: [
				new Embed()
					.title(`Your application to ${interact.guild!.name} has been marked for resubmit.`)
					.description(
						`Thank you for submitting an application, however the guild's moderators have requested that you resubmit a form.\n\n${reason}`
					)
					.build(),
			],
		})

		const message = await interact.channel!.messages.fetch(interact.message.id)
		await Utility.closeApp(member.user, data, "resubmit", message)

		await interact.deferReply({ ephemeral: true })
		return await interact.followUp({
			embeds: [new Embed().title("Resubmit requested!").build()],
			ephemeral: true,
		})
	})
}
export module Utility {
	export function dataPath(guildId: string) {
		return `apps/${guildId}`
	}
	export async function getEmbed(user: User, data: Data) {
		const response = data.responses.find((r) => r.user === user.id)!
		const timezone = `**Timezone:** ${response.timezone ?? "N/A"}`
		const received = `**Received:** ${response.received}`
		const resubmit = `**Resubmit:** ${response.resubmit}`
		const accepted = `**Accepted:** ${response.accepted}`

		const embed = new Embed()
			.author(user.tag, user.avatarURL() ?? undefined)
			.description(`${received}\n${timezone}\n${resubmit}\n${accepted}`)
			.footer(`${response.user}`)

		if (!!user.accentColor) embed.color(user.accentColor)

		data.questions.forEach((q, i) =>
			embed.fields({
				name: q,
				value: response.answers[i] ?? "N/A",
			})
		)

		return embed
	}
	export async function closeApp(user: User, data: Data, type: string, message: Message, reason?: string) {
		const embed = (await getEmbed(user, data)).title(`(${type.toUpperCase()})`)
		const path = dataPath(message.guild!.id)
		const responseIdx = data.responses.findIndex((r) => r.user === user.id)
		data.responses[responseIdx]!.active = false

		if (reason) embed.description(`${embed.build().description}\n**Reason:** ${reason}`)

		const components = message.components.map((r) => {
			r.components.map((c) => c.setDisabled(true))
			return r
		})

		await message.edit({ embeds: [embed.build()], components })
		await set(path, data)
	}
}
