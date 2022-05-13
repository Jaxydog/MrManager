import { Modal, ModalSubmitInteraction, showModal, TextInputComponent } from "discord-modals"
import { ButtonInteraction, Client, CommandInteraction, Message, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { all, del, get, has, set } from "../../internal/data"
import { BotConfig } from "../../types"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subgroup = "option" | null
export type Subcommand = "create" | "delete" | "view" | "send" | "close"
export type OptionSubcommand = "create" | "delete"
export type Type = "choice" | "modal"
export type Output = "user" | "channel"

export interface Config {
	type: Type
	name: string
	description: string
	output: Output
	timeout: number
}
export interface Metadata {
	user: string
	guild: string
	channel?: string
	message?: string
}
export interface Option {
	name: string
	icon: string
	required: boolean
}
export interface Response {
	user: string
	data: string
}
export interface Data {
	config: Config
	metadata: Metadata
	options: Option[]
	responses: Response[]
}

export const modalBtn = new MessageButton()
	.setCustomId("poll-modal")
	.setStyle(MessageButtonStyles.PRIMARY)
	.setLabel("Submit Response")
	.setEmoji("📩")

export const action = new Action<CommandInteraction>("command/poll").fetchData().invokes(async (interact, client) => {
	const subgroup = interact.options.getSubcommandGroup(false) as Subgroup
	const subcommand = interact.options.getSubcommand(true) as Subcommand | OptionSubcommand
	let embed = new Embed()

	switch (subgroup) {
		case "option": {
			switch (subcommand as OptionSubcommand) {
				case "create": {
					embed = await Commands.Option.createSub(interact, embed)
					break
				}
				case "delete": {
					embed = await Commands.Option.deleteSub(interact, embed)
					break
				}
			}
			break
		}
		default: {
			switch (subcommand) {
				case "create": {
					embed = await Commands.createSub(interact, embed)
					break
				}
				case "delete": {
					embed = await Commands.deleteSub(interact, embed)
					break
				}
				case "view": {
					embed = await Commands.viewSub(interact, embed)
					break
				}
				case "send": {
					embed = await Commands.sendSub(interact, client, embed)
					break
				}
				case "close": {
					embed = await Commands.closeSub(interact, client, embed)
					break
				}
			}
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export module Commands {
	export async function createSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)
		const type = interact.options.getString("type", true) as Type
		const name = interact.options.getString("name", true)
		const description = interact.options.getString("description", true)
		const output = (interact.options.getString("output") ?? "channel") as Output
		const afk = interact.options.getInteger("timeout") ?? -1
		const timeout = afk !== -1 ? Math.abs(afk) : -1

		if ((await has(path)).result) {
			return embed.title("Poll already created!")
		}

		const config: Config = { type, name, description, output, timeout }
		const metadata: Metadata = { user: interact.user.id, guild: interact.guild!.id }
		const data: Data = { config, metadata, options: [], responses: [] }

		const { result } = await set(path, data)
		return embed.title(result ? "Created poll!" : "Error creating poll!")
	}
	export async function deleteSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)

		if (!(await has(path)).result) {
			return embed.title("You don't have an active poll!")
		}

		const data = (await get<Data>(path))!

		if (!!data.metadata.message) {
			return embed.title("You can't discard a sent poll!")
		}

		const { result } = await del(path)
		return embed.title(result ? "Discarded poll!" : "Error discarding poll!")
	}
	export async function viewSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)

		if (!(await has(path)).result) {
			return embed.title("You don't have an active poll!")
		}

		const data = (await get<Data>(path))!

		if (!!data.metadata.message) {
			return Utility.getResult(data)
		} else {
			return Utility.getEmbed(interact, data).fields(
				...data.options.map((o) => ({
					name: `${o.icon} ${o.name}`,
					value: `Required: \`${o.required}\``,
					inline: true,
				}))
			)
		}
	}
	export async function sendSub(interact: CommandInteraction, client: Client, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)

		if (!(await has(path)).result) {
			return embed.title("You don't have an active poll!")
		}

		const data = (await get<Data>(path))!

		if (data.options.length === 0) {
			return embed.title("You don't have any options!")
		}
		if (!!data.metadata.message) {
			return embed.title("Poll already sent!")
		}

		const form = Utility.getEmbed(interact, data)
		const component = new Component()

		if (data.config.type === "choice") {
			for (const option of data.options) {
				const button = new MessageButton()
					.setCustomId(`poll-option;${data.options.indexOf(option)}`)
					.setStyle(MessageButtonStyles.SECONDARY)
					.setLabel(option.name)
					.setEmoji(option.icon)
				component.add(button)
			}
		} else {
			component.add(modalBtn)
		}

		const message = await interact.channel!.send({ embeds: [form.build()], components: component.build() })
		data.metadata.channel = message.channel!.id
		data.metadata.message = message.id

		const { result } = await set(path, data)
		return embed.title(result ? "Sent poll!" : "Error sending poll!")
	}
	export async function closeSub(interact: CommandInteraction, client: Client, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)

		if (!(await has(path)).result) {
			return embed.title("You don't have an active poll!")
		}

		const data = (await get<Data>(path))!

		if (!data.metadata.message) {
			return embed.title("Poll has not been sent!")
		}

		const channel = (await interact.guild!.channels.fetch(data.metadata.channel!)) as TextChannel
		const message = await channel.messages.fetch(data.metadata.message!)

		if (!message) {
			return embed.title("Error finding poll message!")
		}

		await Utility.closePoll(message, data)
		await Utility.sendResult(message, data)
		return embed.title("Closed poll!")
	}

	export module Option {
		export async function createSub(interact: CommandInteraction, embed: Embed) {
			const path = Utility.dataPath(interact.guild!.id, interact.user.id)
			const name = interact.options.getString("name", true)
			const icon = interact.options.getString("icon", true)
			const required = interact.options.getBoolean("required") ?? true

			if (!(await has(path)).result) {
				return embed.title("You don't have an active poll!")
			}

			const data = (await get<Data>(path))!
			const choiceMax = data.config.type === "choice" && data.options.length >= 10
			const modalMax = data.config.type === "modal" && data.options.length >= 5

			if (!!data.metadata.message) {
				return embed.title("You can't modify a sent poll!")
			}
			if (data.options.some((o) => o.name === name)) {
				return embed.title(`Option "${name}" already exists!`)
			}
			if (choiceMax || modalMax) {
				return embed.title("Maximum number of options reached!")
			}

			data.options.push({ name, icon, required })
			const { result } = await set(path, data)
			return embed.title(result ? "Created new option!" : "Error creating option!")
		}
		export async function deleteSub(interact: CommandInteraction, embed: Embed) {
			const path = Utility.dataPath(interact.guild!.id, interact.user.id)
			const name = interact.options.getString("name", true)

			if (!(await has(path)).result) {
				return embed.title("You don't have an active poll!")
			}

			const data = (await get<Data>(path))!

			if (!!data.metadata.message) {
				return embed.title("You can't modify a sent poll!")
			}
			if (!data.options.some((o) => o.name === name)) {
				return embed.title(`Option "${name}" does not exist!`)
			}

			const index = data.options.findIndex((o) => o.name === name)
			data.options.splice(index)

			const { result } = await set(path, data)
			return embed.title(result ? "Removed option!" : "Error removing option!")
		}
	}
}
export module Buttons {
	export const modalBtn = new Action<ButtonInteraction>(`button/poll-modal`).invokes(async (interact, client) => {
		const [guildId, userId] = interact.message.embeds[0]!.footer!.text.split("_") as [string, string]
		const path = Utility.dataPath(guildId, userId)
		const data = (await get<Data>(path))!

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

		await showModal(Utility.getModal(data, interact.message.embeds[0]!.title!), {
			client,
			interaction: interact,
		})
	})
	export const optionBtn = new Action<ButtonInteraction>(`button/poll-option`).invokes(async (interact) => {
		const [guildId, userId] = interact.message.embeds[0]!.footer!.text.split("_") as [string, string]
		const path = Utility.dataPath(guildId, userId)
		const data = (await get<Data>(path))!

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

		data.responses.push({ user: interact.user.id, data: interact.component.label! })
		const { result } = await set(path, data)
		if (result) interact.reply({ embeds: [new Embed().title("Response recorded!").build()], ephemeral: true })
	})
}
export module Modals {
	export const modalMdl = new Action<ModalSubmitInteraction>("modal/poll-modal").invokes(async (interact) => {
		const [, guildId, userId] = interact.customId.split(";") as [string, string, string]
		const path = Utility.dataPath(guildId, userId)
		const data = (await get<Data>(path))!

		const content: Record<string, string> = {}
		interact.fields.forEach((f) => (content[f.customId] = f.value))
		data.responses.push({
			user: interact.user.id,
			data: JSON.stringify(content),
		})

		const { result } = await set(path, data, true)

		if (result) {
			await interact.deferReply({ ephemeral: true })
			await interact.followUp({ embeds: [new Embed().title("Response recorded!").build()], ephemeral: true })
		}
	})
}
export module Utility {
	export function dataPath(guildId: string, userId: string) {
		return `poll/${guildId}_${userId}`
	}
	export function getEmbed(interact: CommandInteraction, data: Data) {
		const type = data.config.type === "choice" ? "Multiple choice" : "Text input"
		const output = data.config.output === "channel" ? "This channel" : "Poll author"
		const duration =
			data.config.timeout === -1
				? "Indefinite"
				: `${data.config.timeout} minutes (${(data.config.timeout / 60).toFixed(1)} hours)`

		return new Embed()
			.author(interact.user.tag, interact.user.avatarURL() ?? undefined)
			.title(data.config.name)
			.description(data.config.description)
			.fields(
				{
					name: "Poll Type",
					value: type,
				},
				{
					name: "Result Output",
					value: output,
				},
				{
					name: "Poll Duration",
					value: duration,
				}
			)
			.footer(`${data.metadata.guild}_${data.metadata.user}`)
	}
	export function getModal(data: Data, title?: string) {
		const modal = new Modal()
			.setCustomId(`poll-modal;${data.metadata.guild};${data.metadata.user}`)
			.setTitle(title ?? "Poll Submission")

		for (const option of data.options) {
			const input = new TextInputComponent()
				.setCustomId(option.name)
				.setStyle("LONG")
				.setLabel(`${option.icon} ${option.name} ${option.icon}`)
				.setRequired(option.required)
			modal.addComponents(input)
		}

		return modal
	}
	export function getResult(data: Data) {
		const total = data.responses.length
		const embed = new Embed()
			.title(`Results for "${data.config.name}"`)
			.description(`**Total Responses:** ${total}`)

		if (data.config.type === "choice") {
			for (const option of data.options) {
				const chosen = data.responses.filter((r) => r.data === option.name).length
				const ratio = total !== 0 ? chosen / total : 0
				const percent = `${(ratio * 100).toFixed(2)}%`
				const value = `${chosen} (${percent})`

				embed.fields({ name: option.name, value, inline: true })
			}
		} else {
			for (const option of data.options) {
				const content = data.responses
					.map((r) => JSON.parse(r.data) as Record<string, string>)
					.filter((r) => r[option.name])
					.map((r) => `- ${r[option.name]!}`)
					.join("\n")

				embed.fields({
					name: option.name,
					value: content !== "" ? content : "*No responses*",
				})
			}
		}
		return embed
	}
	export async function closePoll(message: Message, data: Data) {
		const path = dataPath(data.metadata.guild, data.metadata.user)

		message.embeds[0]!.title = `(CLOSED) ${message.embeds[0]!.title}`

		const embeds = message.embeds
		const components = message.components.map((r) => {
			r.components.map((c) => c.setDisabled(true))
			return r
		})

		await message.edit({ embeds, components })
		const { result } = await del(path)
		return result
	}
	export async function sendResult(message: Message, data: Data) {
		const embed = getResult(data)

		if (data.config.output === "channel") {
			await message.reply({ embeds: [embed.build()] })
		} else {
			const user = await message.guild!.members.fetch(data.metadata.user)
			const dm = await user.createDM()
			await dm.send({ embeds: [embed.build()] })
		}
	}
	export async function refresh(client: Client) {
		const { refreshInterval } = (await get<BotConfig>("bot/config"))!

		setInterval(async () => {
			await all<Data>("poll", async (data) => {
				if (!data.metadata.channel || !data.metadata.message || data.config.timeout === -1) return

				try {
					const guild = await client.guilds.fetch(data.metadata.guild)
					const channel = (await guild.channels.fetch(data.metadata.channel)) as TextChannel
					const message = await channel.messages.fetch(data.metadata.message)

					const ms = data.config.timeout * 60 * 1000
					const diff = Date.now() - message.createdTimestamp

					if (diff >= ms) {
						await closePoll(message, data)
						await sendResult(message, data)
					}
				} catch {}
			})
		}, refreshInterval)
	}
}
