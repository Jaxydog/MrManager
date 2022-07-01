import { BaseStorage, ButtonBuilder, ComponentBuilder, EmbedBuilder } from "@jaxydog/dibbs"
import { Guild, User } from "discord.js"
import { ApplicationCommandOptionTypes, ChannelTypes, MessageButtonStyles } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { client } from "./main"
import { defaultColor, getGuild, getMember, getMessage, getTextChannel, getUnix, getUnixIn } from "./common/util"

export type Subcommand = "setup" | "create" | "delete" | "view" | "send" | "close"
export type ChoiceSubcommand = "create" | "delete"
export type Choice = [string, string?]
export type Answer = [string, number]

export interface Config {
	guild_id: string
	channel_id: string
	polls: Poll[]
}
export interface Poll {
	user_id: string
	title: string
	description: string
	duration: number
	choices: Choice[]
	answers: Answer[]
	message_id?: string
	closes_unix?: number
}

export function getPath(guildId: string) {
	return `poll/${guildId}`
}
export async function getConfig(storage: BaseStorage, guildId: string) {
	const config = await storage.get<Config>(getPath(guildId))
	if (!config) throw Err.Poll.MissingConfig
	return config
}
export function getPoll(userId: string, config: Config) {
	const poll = config.polls.find((p) => p.user_id === userId)
	if (!poll) throw Err.Poll.MissingPoll
	return poll
}
export function getPostedPoll(userId: string, config: Config) {
	const poll = getPoll(userId, config)
	if (!poll.message_id) throw Err.Poll.MissingOutputMessage
	if (!poll.closes_unix) throw Err.Poll.MissingClosesUnix
	return poll as Required<Poll>
}

export async function getPollEmbed(user: User, config: Config) {
	const poll = getPoll(user.id, config)
	await user.fetch()

	const unix = poll.closes_unix ?? getUnixIn(poll.duration * 60)
	const closes = `**Closes:** <t:${unix}:R>`

	return new EmbedBuilder()
		.color(user.accentColor ?? defaultColor)
		.author(user.tag, user.avatarURL() ?? "")
		.title(poll.title)
		.description(`${closes}\n\n>>> ${poll.description}`)
		.thumbnail(user.avatarURL() ?? "")
		.build()
}
export function getPollComponent(userId: string, config: Config) {
	const poll = getPoll(userId, config)
	const unix = getUnix()
	const builder = new ComponentBuilder()

	poll.choices
		.slice(0, 25)
		.map(([label, emoji], index) =>
			new ButtonBuilder()
				.dataId(ID.Poll.Choice, `${index};${poll.user_id}`)
				.style(MessageButtonStyles.SECONDARY)
				.emoji(emoji ?? "")
				.label(label)
				.build()
				.setDisabled(!poll.closes_unix || poll.closes_unix <= unix)
		)
		.forEach((b) => builder.component(b))

	return builder.build()
}
export async function getResultEmbed(user: User, config: Config) {
	const poll = getPoll(user.id, config)
	await user.fetch()

	const total = poll.answers.length
	const responses = `**Responses:** ${total}\n`

	return new EmbedBuilder()
		.color(user.accentColor ?? defaultColor)
		.author(user.tag, user.avatarURL() ?? "")
		.title(Text.Poll.ResultTitle)
		.description(responses)
		.fields(
			...poll.choices.slice(0, 25).map(([name], index) => {
				const count = poll.answers.filter((a) => a[1] === index).length
				const percent = (total !== 0 ? (count / total) * 100 : 0).toFixed(2)
				const value = `${count} (${percent}%)`

				return { name, value, inline: true }
			})
		)
		.build()
}
export async function closePoll(guild: Guild, user: User, config: Config) {
	const poll = getPostedPoll(user.id, config)
	const channel = await getTextChannel(guild, config.channel_id)
	const message = await getMessage(channel, poll.message_id)

	const embeds = [await getPollEmbed(user, config)]
	const components = getPollComponent(user.id, config)
	const result = await getResultEmbed(user, config)

	components.forEach((c) => c.components.forEach((c) => c.setDisabled(true)))

	await message.edit({ embeds, components })
	await message.reply({ embeds: [result] })

	const index = config.polls.findIndex((p) => p.user_id === user.id)
	config.polls.splice(index, 1)
}

client.buttons.create(ID.Poll.Choice, async ({ interact, storage, data }) => {
	await interact.deferReply({ ephemeral: true })

	try {
		if (!interact.guild) throw Err.MissingGuild
		if (!interact.channel) throw Err.MissingChannel
		if (!interact.channel.isText()) throw Err.MissingTextChannel
		if (!data || data.length === 0) throw Err.MissingIdData

		const [rawIndex, userId] = data
		if (!rawIndex || !userId) throw Err.MissingIdData
		if (userId === interact.user.id) throw Err.Poll.InvalidUser
		const index = +rawIndex

		const config = await getConfig(storage, interact.guild.id)
		const poll = getPostedPoll(userId, config)
		if (poll.closes_unix <= getUnix()) throw Err.Poll.UnexpectedResponseClosed
		if (poll.answers.some(([id]) => id === interact.user.id)) throw Err.Poll.UnexpectedResponse
		poll.answers.push([userId, index])

		const pollIndex = config.polls.findIndex((p) => p.user_id === poll.user_id)
		config.polls.splice(pollIndex, 1, poll)

		if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

		const embed = new EmbedBuilder().color(defaultColor).title(Text.Poll.SubmitTitle).build()
		await interact.followUp({ embeds: [embed] })
	} catch (error) {
		const embed = new EmbedBuilder()
			.color(defaultColor)
			.title(Err.Poll.FailedSubmit)
			.description(`> ${error}`)
			.build()

		await interact.followUp({ embeds: [embed] })
	}
})

client.commands
	.define(ID.Poll.Command, {
		name: ID.Poll.Command,
		description: "Manage polls",
		dm_permission: false,
		options: [
			{
				name: "setup",
				description: "Set up polls",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "output_channel",
						description: "Poll output channel",
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
				],
			},
			{
				name: "create",
				description: "Create a poll",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "title",
						description: "Poll title",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: "description",
						description: "Poll description",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: "duration",
						description: "Poll duration (hours)",
						type: ApplicationCommandOptionTypes.NUMBER,
						required: true,
					},
				],
			},
			{
				name: "delete",
				description: "Delete a poll",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: "view",
				description: "View a poll",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: "send",
				description: "Send a poll",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: "close",
				description: "Close a poll",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: "choice",
				description: "Manage choices",
				type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
				options: [
					{
						name: "create",
						description: "Create a choice",
						type: ApplicationCommandOptionTypes.SUB_COMMAND,
						options: [
							{
								name: "title",
								description: "Choice title",
								type: ApplicationCommandOptionTypes.STRING,
								required: true,
							},
							{
								name: "emoji",
								description: "Choice emoji",
								type: ApplicationCommandOptionTypes.STRING,
							},
						],
					},
					{
						name: "delete",
						description: "Delete a choice",
						type: ApplicationCommandOptionTypes.SUB_COMMAND,
						options: [
							{
								name: "title",
								description: "Choice title",
								type: ApplicationCommandOptionTypes.STRING,
								required: true,
							},
						],
					},
				],
			},
		],
	})
	.create(ID.Poll.Command, async ({ interact, storage }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const embed = new EmbedBuilder().color(defaultColor)
			const path = getPath(interact.guild.id)

			if (interact.options.getSubcommandGroup(false)) {
				const config = await getConfig(storage, interact.guild.id)
				const poll = getPoll(interact.user.id, config)
				const subcommand = interact.options.getSubcommand(true) as ChoiceSubcommand

				if (subcommand === "create") {
					if (poll.choices.length >= 10) throw Err.Poll.InvalidChoiceCount

					const title = interact.options.getString("title", true)
					const emoji = interact.options.getString("emoji")

					if (poll.choices.some((c) => c[0] === title)) throw Err.Poll.UnexpectedChoice

					poll.choices.push([title, emoji ?? undefined])
					embed.title(Text.Poll.ChoiceCreateTitle)
				} else {
					const title = interact.options.getString("title", true)
					const index = poll.choices.findIndex(([t]) => t === title)
					if (index === -1) throw Err.Poll.MissingChoice

					poll.choices.splice(index, 1)
					embed.title(Text.Poll.ChoiceDeleteTitle)
				}

				const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
				config.polls.splice(index, 1, poll)
				if (!(await storage.set(path, config))) throw Err.FailedSave
			} else {
				const subcommand = interact.options.getSubcommand(true) as Subcommand

				if (subcommand === "setup") {
					const member = await getMember(interact.guild, interact.user.id)
					if (!member.permissions.has("ADMINISTRATOR")) throw Err.InvalidPermissions

					const output = interact.options.getChannel("output_channel", true)
					const channel = await getTextChannel(interact.guild, output.id)

					const config: Config = {
						guild_id: interact.guild.id,
						channel_id: channel.id,
						polls: [],
					}

					if (!(await storage.set(path, config))) throw Err.FailedSave
					embed.title(Text.Poll.SetupTitle)
				} else {
					const config = await getConfig(storage, interact.guild.id)

					if (subcommand === "create") {
						if (config.polls.some((p) => p.user_id === interact.user.id)) throw Err.Poll.UnexpectedPoll

						const title = interact.options.getString("title", true)
						const description = interact.options.getString("description", true)
						const duration = interact.options.getNumber("duration", true)

						if (title.length > 256) throw Err.InvalidTitleLength
						if (description.length > 2048) throw Err.Poll.InvalidDescriptionLength
						if (duration <= 0 || duration > 72) throw Err.Poll.InvalidDuration

						const poll: Poll = {
							user_id: interact.user.id,
							title,
							description,
							duration,
							choices: [],
							answers: [],
						}

						config.polls.push(poll)
						embed.title(Text.Poll.CreateTitle)
					} else if (subcommand === "delete") {
						const poll = getPoll(interact.user.id, config)
						if (!!poll.message_id) throw Err.Poll.UnexpectedOutputMessageDelete

						const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
						config.polls.splice(index, 1)
						embed.title(Text.Poll.DeleteTitle)
					} else if (subcommand === "view") {
						const embeds = [await getPollEmbed(interact.user, config)]
						const components = getPollComponent(interact.user.id, config)

						await interact.followUp({ embeds, components })
						return
					} else if (subcommand === "send") {
						const poll = getPoll(interact.user.id, config)
						if (!!poll.message_id) throw Err.Poll.UnexpectedOutputMessageSend
						if (poll.choices.length <= 1) throw Err.Poll.MissingChoices

						const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
						poll.closes_unix = getUnixIn(poll.duration * 60)
						config.polls.splice(index, 1, poll)

						const embeds = [await getPollEmbed(interact.user, config)]
						const components = getPollComponent(interact.user.id, config)

						let message

						if (interact.channel.id !== config.channel_id) {
							const channel = await getTextChannel(interact.guild, config.channel_id)
							message = await channel.send({ embeds, components })
						} else {
							message = await interact.channel.send({ embeds, components })
						}

						poll.message_id = message.id
						config.polls.splice(index, 1, poll)
						embed.title(Text.Poll.SendTitle)
					} else if (subcommand === "close") {
						await closePoll(interact.guild, interact.user, config)
						embed.title(Text.Poll.CloseTitle)
					}

					if (!(await storage.set(path, config))) throw Err.FailedSave
				}
			}

			await interact.followUp({ embeds: [embed.build()] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.FailedExecute)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})

client.timer.queue(async ({ client, logger, storage }) => {
	await storage.actionAllIf<Config>(
		"poll",
		async (config) => {
			try {
				await getGuild(client, config.guild_id)
				return false
			} catch (error) {
				logger.warn(error)
				return true
			}
		},
		async (_, id, __, storage) => {
			await storage.del(id)
		}
	)
	await storage.modifyAll<Config>("poll", async (config) => {
		try {
			const guild = await getGuild(client, config.guild_id)

			for (const poll of config.polls) {
				if (!poll.message_id) continue
				if (!poll.closes_unix) continue
				if (poll.closes_unix > getUnix()) continue

				let member
				try {
					member = await getMember(guild, poll.user_id)
				} catch (error) {
					const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
					config.polls.splice(index)
					continue
				}

				await closePoll(guild, member.user, config)
			}
		} catch (error) {
			logger.warn(error)
		}

		return config
	})
})
