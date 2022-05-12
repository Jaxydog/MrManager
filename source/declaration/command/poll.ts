import { Client, CommandInteraction, Message, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { all, del, get, has, set } from "../../internal/data"
import { BotConfig } from "../../types"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "new" | "discard" | "add" | "remove" | "list" | "post" | "close"
export type Type = "choice" | "modal"
export type Output = "user" | "channel"
export interface Config {
	type: Type
	output: Output
	title: string
	description: string
	timeout: number
}
export interface Metadata {
	user: string
	guild: string
	channel: string
	message: string
}
export interface Option {
	name: string
	emoji: string
	required: boolean
}
export interface Response {
	user: string
	content: string
}
export interface Data {
	active: boolean
	config: Config
	metadata: Metadata
	options: Option[]
	responses: Response[]
}

export const modalButton = new MessageButton()
	.setCustomId(`poll-modal`)
	.setStyle(MessageButtonStyles.PRIMARY)
	.setLabel("Submit Response")
	.setEmoji("📩")

export const action = new Action<CommandInteraction>("command/poll").fetchData().invokes(async (interact, client) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed: Embed

	switch (subcommand) {
		case "new": {
			embed = await subNew(interact, new Embed())
			break
		}
		case "discard": {
			embed = await subDiscard(interact, new Embed())
			break
		}
		case "add": {
			embed = await subAdd(interact, new Embed())
			break
		}
		case "remove": {
			embed = await subRemove(interact, new Embed())
			break
		}
		case "list": {
			embed = await subList(interact, new Embed())
			break
		}
		case "post": {
			embed = await subPost(interact, client, new Embed())
			break
		}
		case "close": {
			embed = await subClose(interact, client, new Embed())
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export async function subNew(interact: CommandInteraction, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if ((await has(path, true)).result) return embed.title("Poll already created!")

	const type = interact.options.getString("type", true) as Type
	const output = interact.options.getString("send_results_to", true) as Output
	const title = interact.options.getString("title", true)
	const description = interact.options.getString("description", true)
	const afkTimeout = interact.options.getInteger("timeout") ?? 1440
	const timeout = afkTimeout !== -1 ? Math.abs(afkTimeout) : -1

	const config: Config = { type, output, title, description, timeout }
	const metadata: Metadata = { user: interact.user.id, guild: interact.guild!.id, channel: "", message: "" }
	const data: Data = { active: true, config, metadata, options: [], responses: [] }

	const { result } = await set(path, data, true)
	return embed.title(result ? "Created poll!" : "Error creating poll!")
}
export async function subDiscard(interact: CommandInteraction, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	const data = (await get<Data>(path, true))!

	if (data.metadata.message) return embed.title("You cannot discard a posted poll!")

	await del(path, true)
	return embed.title("Discarded poll!")
}
export async function subAdd(interact: CommandInteraction, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if (!(await has(path, true)).result) return embed.title("No active poll!")
	const data = (await get<Data>(path, true))!

	if (
		(data.config.type === "choice" && data.options.length >= 10) ||
		(data.config.type === "modal" && data.options.length >= 5)
	) {
		return embed.title("Maximum options added!")
	}

	const name = interact.options.getString("name", true)
	const emoji = interact.options.getString("emoji", true)
	const required = interact.options.getBoolean("required") ?? true
	const option: Option = { name, emoji, required }

	if (data.options.some((o) => o.name === name)) {
		return embed.title("Option already exists!")
	}

	data.options.push(option)
	const { result } = await set(path, data, true)
	return embed.title(result ? "Added option!" : "Error adding option!")
}
export async function subRemove(interact: CommandInteraction, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if (!(await has(path, true)).result) return embed.title("No active poll!")
	const data = (await get<Data>(path, true))!

	const name = interact.options.getString("name", true)
	const index = data.options.findIndex((o) => o.name === name)

	if (index !== -1) {
		data.options.splice(index)
		const { result } = await set(path, data, true)
		return embed.title(result ? "Removed option!" : "Error removing option!")
	} else {
		return embed.title("Option already removed!")
	}
}
export async function subList(interact: CommandInteraction, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if (!(await has(path, true)).result) return embed.title("No active poll!")
	const data = (await get<Data>(path, true))!
	if (data.metadata.message) return getResults(data)
	const description = data.options.map((o) => `${o.emoji} ${o.name}`).join("\n")
	return embed.title(data.config.title).description(description !== "" ? description : "*No options added*")
}
export async function subPost(interact: CommandInteraction, client: Client, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if (!(await has(path, true)).result) return embed.title("No active poll!")
	const data = (await get<Data>(path, true))!
	if (data.options.length === 0) return embed.title("No poll options!")
	const formEmbed = getFormEmbed(interact, data, new Embed())
	const formComponent =
		data.config.type === "choice" ? getFormChoice(data, new Component()) : getFormModal(new Component())

	if (data.metadata.message) return embed.title("Poll already exists!")

	const message = await interact.channel!.send({ embeds: [formEmbed.build()], components: formComponent.build() })
	data.metadata.channel = message.channel!.id
	data.metadata.message = message.id

	if (data.config.timeout !== -1) timeout(client, message, data)

	const { result } = await set(path, data, true)
	return embed.title(result ? "Posted poll!" : "Error posting poll!")
}
export async function subClose(interact: CommandInteraction, client: Client, embed: Embed) {
	const path = `poll/${interact.guild!.id}_${interact.user.id}`
	if (!(await has(path, true)).result) return embed.title("No active poll!")
	const data = (await get<Data>(path, true))!
	const channel = (await interact.guild!.channels.fetch(data.metadata.channel)) as TextChannel
	const message = await channel.messages.fetch(data.metadata.message)

	await closePoll(client, data)
	await sendResults(message, data)
	return embed.title("Closed poll!")
}

export function getFormEmbed(interact: CommandInteraction, data: Data, embed: Embed) {
	return embed
		.author(interact.user.tag, interact.user.avatarURL() ?? undefined)
		.title(data.config.title)
		.description(`${data.config.description}`)
		.fields({
			name: `Type`,
			value: `${data.config.type === "choice" ? "Multiple choice" : "Text input"}`,
			inline: true,
		})
		.fields({
			name: `Duration`,
			value:
				data.config.timeout !== -1
					? `${data.config.timeout} minutes (${(data.config.timeout / 60).toFixed(1)} hours)`
					: "Never",
			inline: true,
		})
		.fields({
			name: `Outputs to`,
			value: `${data.config.output === "channel" ? "This channel" : "The poll author"}`,
			inline: true,
		})
		.footer(`${data.metadata.guild}-${data.metadata.user}`)
}
export function getFormChoice(data: Data, component: Component) {
	for (const option of data.options) {
		component.add(
			new MessageButton()
				.setCustomId(`poll-option;${data.options.indexOf(option)}`)
				.setStyle(MessageButtonStyles.SECONDARY)
				.setLabel(option.name)
				.setEmoji(option.emoji)
		)
	}
	return component
}
export function getFormModal(component: Component) {
	component.add(modalButton)
	return component
}
export function getResults(data: Data) {
	const embed = new Embed()
		.title(`Results for poll "${data.config.title}"`)
		.description(`**Responses:** ${data.responses.length}`)

	if (data.config.type === "choice") {
		for (const option of data.options) {
			const responses = data.responses.filter(({ content }) => content === option.name)
			const percent = data.responses.length !== 0 ? responses.length / data.responses.length : 0

			embed.fields({
				name: option.name,
				value: `${(percent * 100).toFixed(2)}%`,
				inline: true,
			})
		}
	} else {
		for (const option of data.options) {
			const responses = data.responses.filter((response) => {
				const responseData = JSON.parse(response.content) as Record<string, string>
				return !!responseData[option.name]
			})
			const content = responses
				.map((response) => {
					const responseData = JSON.parse(response.content) as Record<string, string>
					return `- ${responseData[option.name]!}`
				})
				.join("\n")

			embed.fields({
				name: option.name,
				value: content !== "" ? content : "*No responses*",
			})
		}
	}

	return embed
}
export async function closePoll(client: Client, data: Data) {
	const path = `poll/${data.metadata.guild}_${data.metadata.user}`
	const guild = await client.guilds.fetch(data.metadata.guild)
	const channel = (await guild.channels.fetch(data.metadata.channel)) as TextChannel
	const message = await channel.messages.fetch(data.metadata.message)

	message.embeds[0]!.title += " (CLOSED)"
	data.active = false

	const embeds = message.embeds
	const components = message.components.map((row) => {
		row.components.map((component) => {
			component.setDisabled(true)
			return component
		})
		return row
	})

	await message.edit({ embeds, components })
	await del(path, true)
}
export async function sendResults(message: Message, data: Data) {
	const embed = getResults(data)

	if (data.config.output === "channel") {
		await message.reply({ embeds: [embed.build()] })
	} else {
		const user = await message.guild!.members.fetch(data.metadata.user)
		const dm = await user.createDM()
		await dm.send({ embeds: [embed.build()] })
	}
}
export async function timeout(client: Client, message: Message, data: Data) {
	const { refreshInterval } = (await get<BotConfig>("bot/config", true))!

	const interval = setInterval(async () => {
		if (!message) {
			clearInterval(interval)
			return
		}

		if (!(await get<Data>(`poll/${data.metadata.guild}_${data.metadata.user}`, true))?.active) {
			clearInterval(interval)
			return
		}

		const ms = data.config.timeout * 60 * 1000
		const diff = Date.now() - message.createdTimestamp

		if (diff >= ms) {
			await closePoll(client, data)
			await sendResults(message, data)
			clearInterval(interval)
		}
	}, refreshInterval)
}
export async function refresh(client: Client) {
	await all<Data>(
		"poll",
		async (data) => {
			if (!data.metadata.message || !data.active || data.config.timeout === -1) return
			const guild = await client.guilds.fetch(data.metadata.guild)
			const channel = (await guild.channels.fetch(data.metadata.channel)) as TextChannel
			const message = await channel.messages.fetch(data.metadata.message)
			timeout(client, message, data)
		},
		true
	)
}
