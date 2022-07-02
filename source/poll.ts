import { BaseStorage, ButtonBuilder, ComponentBuilder, EmbedBuilder } from "@jaxydog/dibbs"
import { Guild, User } from "discord.js"
import { ApplicationCommandOptionTypes, ChannelTypes, MessageButtonStyles } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { client } from "./main"
import { defaultColor, getGuild, getMember, getMessage, getTextChannel, getUnix, getUnixIn } from "./common/util"

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
		description: Text.Poll.Command,
		dm_permission: false,
		options: [
			{
				name: ID.Poll.Subcommand.Setup,
				description: Text.Poll.Subcommand.Setup,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: ID.Poll.Option.Output,
						description: Text.Poll.Option.Output,
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
				],
			},
			{
				name: ID.Poll.Subcommand.Create,
				description: ID.Poll.Subcommand.Create,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: ID.Poll.Option.Title,
						description: Text.Poll.Option.Title,
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: ID.Poll.Option.Description,
						description: Text.Poll.Option.Description,
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: ID.Poll.Option.Duration,
						description: Text.Poll.Option.Duration,
						type: ApplicationCommandOptionTypes.NUMBER,
						required: true,
					},
				],
			},
			{
				name: ID.Poll.Subcommand.Delete,
				description: ID.Poll.Subcommand.Delete,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: ID.Poll.Subcommand.View,
				description: ID.Poll.Subcommand.View,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: ID.Poll.Subcommand.Send,
				description: ID.Poll.Subcommand.Send,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: ID.Poll.Subcommand.Close,
				description: ID.Poll.Subcommand.Close,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: ID.Poll.Subcommand.Choice.Group,
				description: Text.Poll.Subcommand.Choice.Group,
				type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
				options: [
					{
						name: ID.Poll.Subcommand.Choice.Create,
						description: Text.Poll.Subcommand.Choice.Create,
						type: ApplicationCommandOptionTypes.SUB_COMMAND,
						options: [
							{
								name: ID.Poll.Option.Choice.Title,
								description: Text.Poll.Option.Choice.Title,
								type: ApplicationCommandOptionTypes.STRING,
								required: true,
							},
							{
								name: ID.Poll.Option.Choice.Emoji,
								description: Text.Poll.Option.Choice.Emoji,
								type: ApplicationCommandOptionTypes.STRING,
							},
						],
					},
					{
						name: ID.Poll.Subcommand.Choice.Delete,
						description: Text.Poll.Subcommand.Choice.Delete,
						type: ApplicationCommandOptionTypes.SUB_COMMAND,
						options: [
							{
								name: ID.Poll.Option.Choice.Title,
								description: Text.Poll.Option.Choice.Title,
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
				const subcommand = interact.options.getSubcommand(true) as ID.Poll.Subcommand.Choice

				if (subcommand === ID.Poll.Subcommand.Choice.Create) {
					if (poll.choices.length >= 10) throw Err.Poll.InvalidChoiceCount

					const title = interact.options.getString(ID.Poll.Option.Choice.Title, true)
					const emoji = interact.options.getString(ID.Poll.Option.Choice.Emoji)

					if (poll.choices.some((c) => c[0] === title)) throw Err.Poll.UnexpectedChoice

					poll.choices.push([title, emoji ?? undefined])
					embed.title(Text.Poll.ChoiceCreateTitle)
				} else {
					const title = interact.options.getString(ID.Poll.Option.Choice.Title, true)
					const index = poll.choices.findIndex(([t]) => t === title)
					if (index === -1) throw Err.Poll.MissingChoice

					poll.choices.splice(index, 1)
					embed.title(Text.Poll.ChoiceDeleteTitle)
				}

				const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
				config.polls.splice(index, 1, poll)
				if (!(await storage.set(path, config))) throw Err.FailedSave
			} else {
				const subcommand = interact.options.getSubcommand(true) as ID.Poll.Subcommand

				if (subcommand === ID.Poll.Subcommand.Setup) {
					const member = await getMember(interact.guild, interact.user.id)
					if (!member.permissions.has("ADMINISTRATOR")) throw Err.InvalidPermissions

					const output = interact.options.getChannel(ID.Poll.Option.Output, true)
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

					if (subcommand === ID.Poll.Subcommand.Create) {
						if (config.polls.some((p) => p.user_id === interact.user.id)) throw Err.Poll.UnexpectedPoll

						const title = interact.options.getString(ID.Poll.Option.Title, true)
						const description = interact.options.getString(ID.Poll.Option.Description, true)
						const duration = interact.options.getNumber(ID.Poll.Option.Duration, true)

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
					} else if (subcommand === ID.Poll.Subcommand.Delete) {
						const poll = getPoll(interact.user.id, config)
						if (!!poll.message_id) throw Err.Poll.UnexpectedOutputMessageDelete

						const index = config.polls.findIndex((p) => p.user_id === poll.user_id)
						config.polls.splice(index, 1)
						embed.title(Text.Poll.DeleteTitle)
					} else if (subcommand === ID.Poll.Subcommand.View) {
						const embeds = [await getPollEmbed(interact.user, config)]
						const components = getPollComponent(interact.user.id, config)

						await interact.followUp({ embeds, components })
						return
					} else if (subcommand === ID.Poll.Subcommand.Send) {
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
					} else if (subcommand === ID.Poll.Subcommand.Close) {
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
