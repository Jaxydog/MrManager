import { BaseStorage, EmbedBuilder } from "@jaxydog/dibbs"
import { ApplicationCommandOptionTypes, ChannelTypes } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { defaultColor } from "./common/util"
import { client } from "./main"

export interface Config {
	guild_id: string
	entries: Entry[]
}
export interface Entry {
	input_channel_id: string
	output_channel_id: string
	min_stars: number
	sent: string[]
}

export function getPath(guildId: string) {
	return `star/${guildId}`
}
export async function getConfig(storage: BaseStorage, guildId: string): Promise<Config> {
	const config = await storage.get<Config>(getPath(guildId))
	return config ? config : { guild_id: guildId, entries: [] }
}

client.commands
	.define(ID.Star.Command, {
		name: ID.Star.Command,
		description: Text.Star.CommandDescription,
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				name: ID.Star.Subcommand.Create,
				description: Text.Star.Subcommand.Create,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: ID.Star.Option.Input,
						description: Text.Star.Option.Input,
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
					{
						name: ID.Star.Option.Output,
						description: Text.Star.Option.Output,
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
					{
						name: ID.Star.Option.Count,
						description: Text.Star.Option.Count,
						type: ApplicationCommandOptionTypes.INTEGER,
						min_value: 1,
					},
				],
			},
			{
				name: ID.Star.Subcommand.Delete,
				description: Text.Star.Subcommand.Delete,
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: ID.Star.Option.Input,
						description: Text.Star.Option.Input,
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
				],
			},
		],
	})
	.create(ID.Star.Command, async ({ interact, storage }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const subcommand = interact.options.getSubcommand(true) as ID.Star.Subcommand
			const config = await getConfig(storage, interact.guild.id)
			const embed = new EmbedBuilder().color(defaultColor)

			if (subcommand === ID.Star.Subcommand.Create) {
				const input = interact.options.getChannel(ID.Star.Option.Input, true)
				const output = interact.options.getChannel(ID.Star.Option.Output, true)
				const count = interact.options.getInteger(ID.Star.Option.Count) ?? 1

				if (input.id === output.id) throw Err.Star.UnexpectedChannel

				const entry: Entry = {
					input_channel_id: input.id,
					output_channel_id: output.id,
					min_stars: count,
					sent: [],
				}

				config.entries.push(entry)
				embed.title(Text.Star.CreateTitle)
			} else {
				const input = interact.options.getChannel(ID.Star.Option.Input, true)
				const index = config.entries.findIndex((e) => e.input_channel_id === input.id)
				if (index === -1) throw Err.Star.InvalidChannelId

				config.entries.splice(index)
				embed.title(Text.Star.DeleteTitle)
			}

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave
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

client.client.on("messageReactionAdd", async (reaction, user) => {
	if (!reaction.message.guild) return
	if (!reaction.message.channel) return
	if (!reaction.message.author) return
	if (reaction.message.author.bot) return
	if (reaction.message.author.id === user.id) return
	if (!reaction.message.content && reaction.message.attachments.size === 0) return

	const config = await getConfig(client.storage, reaction.message.guild.id)
	if (!config.entries.some((e) => e.input_channel_id === reaction.message.channel.id)) return

	const entry = config.entries.find((e) => e.input_channel_id === reaction.message.channel.id)!
	if (reaction.message.reactions.cache.filter((r) => !r.users.cache.has(user.id)).size < entry.min_stars) return

	try {
		await reaction.message.fetch()
		let total = 0

		for (const react of reaction.message.reactions.cache.values()) {
			await react.fetch()
			const mod = react.users.cache.has(reaction.message.author.id) ? -1 : 0
			total += react.count + mod
		}

		if (total < entry.min_stars) return

		const output = await reaction.message.guild.channels.fetch(entry.output_channel_id)
		if (!output) throw Err.InvalidChannelId
		if (!output.isText()) throw Err.InvalidChannelType

		await reaction.message.author.fetch()

		const embed = new EmbedBuilder()
			.color(reaction.message.author.accentColor ?? defaultColor)
			.author(reaction.message.author.tag, reaction.message.author.avatarURL() ?? "")
			.description(`[Original message](${reaction.message.url})\n> ${reaction.message.content ?? ""}`)
			.image(reaction.message.attachments.at(0)?.url ?? "")
			.timestamp(reaction.message.createdAt)
			.build()

		await output.send({ embeds: [embed] })
	} catch {}
})
