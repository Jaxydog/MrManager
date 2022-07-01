import { BaseStorage, ButtonBuilder, ComponentBuilder, EmbedBuilder } from "@jaxydog/dibbs"
import { Guild, MessageAttachment, TextChannel } from "discord.js"
import { ApplicationCommandOptionTypes, ChannelTypes, MessageButtonStyles } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { defaultColor, fromUnix, getGuild, getMessage, getTextChannel, getUnix } from "./common/util"
import { getConfig as getAppConfig } from "./apply"
import { client } from "./main"
import { RawMessageAttachmentData } from "discord.js/typings/rawDataTypes"

export type Subcommand = "setup" | "view" | "delete"

export interface Config {
	guild_id: string
	channel_id: string
	message_id: string
	category_id: string
	duration: number
	channels: Listing[]
}
export interface Listing {
	user_id: string
	channel_id: string
}
export interface Archive {
	id: string
	guild_id: string
	archived_unix: number
	created_unix: number
	messages: ArchiveMessage[]
}
export interface ArchiveUser {
	user_id: string
	user_tag: string
}
export interface ArchiveMessage {
	user: ArchiveUser
	content: string
	attachments: boolean
	embeds: boolean
	mentions: ArchiveUser[]
	created_unix: number
}

export function getPath(guildId: string) {
	return `mail/${guildId}`
}
export function getArchivePath(guildId: string, channelId: string) {
	return `mail/${guildId}/${channelId}`
}
export async function getConfig(storage: BaseStorage, guildId: string) {
	const config = await storage.get<Config>(getPath(guildId))
	if (!config) throw Err.Mail.MissingConfig
	return config
}
export async function getArchive(storage: BaseStorage, guildId: string, channelId: string) {
	const config = await storage.get<Archive>(getArchivePath(guildId, channelId))
	if (!config) throw Err.Mail.MissingArchive
	return config
}
export async function storeChannel(storage: BaseStorage, channel: TextChannel) {
	const messages = (await channel.messages.fetch()).reverse()

	if (messages.size > 1) {
		const archive: Archive = {
			id: channel.id,
			guild_id: channel.guild.id,
			archived_unix: getUnix(),
			created_unix: getUnix(channel.createdTimestamp),
			messages: [],
		}

		for (const [, message] of messages) {
			archive.messages.push({
				user: {
					user_id: message.author.id,
					user_tag: message.author.tag,
				},
				content: message.content,
				attachments: message.attachments.size > 0,
				embeds: message.embeds.length > 0,
				mentions:
					message.mentions.members?.map((m) => ({
						user_id: m.user.id,
						user_tag: m.user.tag,
					})) ?? [],
				created_unix: getUnix(message.createdTimestamp),
			})
		}

		if (!(await storage.set(getArchivePath(channel.guild.id, channel.id), archive))) throw Err.FailedSave
	}

	const config = await getConfig(storage, channel.guild.id)
	const index = config.channels.findIndex((c) => c.channel_id === channel.id)
	config.channels.splice(index, 1)

	if (!(await storage.set(getPath(channel.guild.id), config))) throw Err.FailedSave
	await channel.delete(Text.Mail.ArchiveReason)
}
export async function getArchiveInfoEmbed(guild: Guild, archive: Archive, index: number, count: number) {
	await guild.fetch()

	const userList = [...new Set(archive.messages.map((m) => `<@${m.user.user_id}>`)).values()].join(", ")
	const users = `**Users:** ${userList}\n`
	const messages = `**Messages:** ${archive.messages.length}\n`
	const created = `**Created:** <@${archive.created_unix}>\n`
	const archived = `**Archived:** <@${archive.archived_unix}>\n`

	return new EmbedBuilder()
		.color(defaultColor)
		.author(guild.name, guild.iconURL() ?? "")
		.title(Text.Mail.ArchiveTitle)
		.description(`${users}${messages}${created}${archived}`)
		.footer(`${index + 1}/${count} - ID: ${archive.id}`)
		.build()
}
export function getArchiveInfoComponent(index: number) {
	const last = new ButtonBuilder()
		.dataId(ID.Mail.Last, `${index}`)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.Mail.LastEmoji)
		.build()
	const view = new ButtonBuilder()
		.dataId(ID.Mail.View, `${index}`)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.Mail.ViewEmoji)
		.build()
	const next = new ButtonBuilder()
		.dataId(ID.Mail.Next, `${index}`)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.Mail.NextEmoji)
		.build()

	return new ComponentBuilder().component(last).component(view).component(next).build()
}
export function getArchiveFile(archive: Archive) {
	const userList = [...new Set(archive.messages.map((m) => `${m.user.user_tag} (<@${m.user.user_id}>)`)).values()]

	const header = `#${archive.guild_id}:${archive.id}\n\n`
	const created = `Created: ${fromUnix(archive.created_unix).toUTCString()}\n`
	const stored = `Stored: ${fromUnix(archive.archived_unix).toUTCString()}\n\n`
	const messages = `Messages: ${archive.messages.length}\n`
	const users = `Users: ${userList.length}\nUser List: ${userList.join(", ")}\n\n`
	const content = archive.messages
		.map((m) => {
			const user = `${m.user.user_tag} (<@${m.user.user_id}>) `
			const time = `${fromUnix(m.created_unix).toUTCString()}\n`
			const content = `> ${m.content.length > 0 ? m.content : "N/A"}\n`
			const mentions =
				m.mentions.length !== 0
					? `Mentions: ${m.mentions.map((u) => `${u.user_tag} (<@${u.user_id}>)`).join(", ")}\n`
					: ""
			const tags =
				m.embeds || m.attachments
					? `Tags: ${m.embeds ? "+embed" : ""}${m.attachments ? "+attachment" : ""}`
					: ""
			return `${user}${time}${content}${mentions}${tags}`.trim()
		})
		.join("\n\n")

	return `${header}${created}${stored}${messages}${users}${content}`
}
export function getEntryEmbed() {
	return new EmbedBuilder()
		.color(defaultColor)
		.title(Text.Mail.EntryTitle)
		.description(Text.Mail.EntryDescription)
		.build()
}
export function getEntryComponent() {
	const create = new ButtonBuilder()
		.id(ID.Mail.Create)
		.style(MessageButtonStyles.PRIMARY)
		.emoji(Text.Mail.CreateEmoji)
		.label(Text.Mail.CreateLabel)
		.build()
	const about = new ButtonBuilder()
		.id(ID.Mail.About)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.AboutEmoji)
		.label(Text.AboutLabel)
		.build()

	return new ComponentBuilder().component(create).component(about).build()
}
export function getWelcomeEmbed() {
	return new EmbedBuilder()
		.color(defaultColor)
		.title(Text.Mail.WelcomeTitle)
		.description(Text.Mail.WelcomeDescription)
		.build()
}
export function getWelcomeComponent() {
	const archive = new ButtonBuilder()
		.id(ID.Mail.Archive)
		.style(MessageButtonStyles.DANGER)
		.emoji(Text.Mail.ArchiveEmoji)
		.label(Text.Mail.ArchiveLabel)
		.build()
	const about = new ButtonBuilder()
		.id(ID.Mail.About)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.AboutEmoji)
		.label(Text.AboutLabel)
		.build()

	return new ComponentBuilder().component(archive).component(about).build()
}

client.buttons
	.create(ID.Mail.About, async ({ interact, storage }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const config = await getConfig(storage, interact.guild.id)
			const hours = (config.duration / 60).toFixed(2)
			await interact.guild!.fetch()

			const embed = new EmbedBuilder()
				.color(defaultColor)
				.author(interact.guild.name, interact.guild.iconURL() ?? "")
				.title(Text.Mail.AboutTitle)
				.description(Text.Mail.AboutDescription + `${config.duration} minutes (${hours} hours)`)
				.build()

			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedAbout)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
	.create(ID.Mail.Archive, async ({ interact, storage }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			await storeChannel(storage, interact.channel as TextChannel)
			await interact.update({})
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedCreate)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Mail.Create, async ({ interact, storage }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			let accepted = true
			try {
				const config = await getAppConfig(storage, interact.guild.id)
				const response = config.entries.find((e) => e.user_id === interact.user.id)
				if (response) accepted &&= response.status === "accept"
			} catch {}
			if (!accepted) throw Err.Mail.InvalidStatus

			const config = await getConfig(storage, interact.guild.id)
			if (config.channels.some((c) => c.user_id === interact.user.id)) throw Err.Mail.UnexpectedChannel

			const channel = await interact.guild.channels.create(interact.user.username, {
				parent: config.category_id,
				reason: Text.Mail.CreateReason,
				type: ChannelTypes.GUILD_TEXT,
			})
			await channel.permissionOverwrites.create(interact.user, {
				SEND_MESSAGES: true,
				READ_MESSAGE_HISTORY: true,
				USE_APPLICATION_COMMANDS: false,
				VIEW_CHANNEL: true,
			})
			await channel.send({
				embeds: [getWelcomeEmbed()],
				components: [...getWelcomeComponent()],
			})

			config.channels.push({
				channel_id: channel.id,
				user_id: interact.user.id,
			})

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

			await interact.update({})
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedCreate)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Mail.Next, async ({ interact, storage, data }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!interact.message) throw Err.MissingMessage
			if (!data || !data[0] || isNaN(+data[0])) throw Err.MissingIdData

			const dir = await storage.dir(getArchivePath(interact.guild.id, ""))
			const count = dir.length

			let index = +data[0] + 1
			if (index >= dir.length) index -= dir.length

			const path = dir[index]
			if (!path) throw Err.Mail.MissingArchive

			const archive = await storage.get<Archive>(path)
			if (!archive) throw Err.Mail.MissingArchive

			const embeds = [await getArchiveInfoEmbed(interact.guild, archive, index, count)]
			const components = getArchiveInfoComponent(index)

			const message = await getMessage(interact.channel, interact.message.id)
			await message.edit({ embeds, components })
			await interact.update({})
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedInfo)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Mail.Last, async ({ interact, storage, data }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!interact.message) throw Err.MissingMessage
			if (!data || !data[0] || isNaN(+data[0])) throw Err.MissingIdData

			const dir = await storage.dir(getArchivePath(interact.guild.id, ""))
			const count = dir.length

			let index = +data[0] - 1
			if (index < 0) index += dir.length

			const path = dir[index]
			if (!path) throw Err.Mail.MissingArchive

			const archive = await storage.get<Archive>(path)
			if (!archive) throw Err.Mail.MissingArchive

			const embeds = [await getArchiveInfoEmbed(interact.guild, archive, index, count)]
			const components = getArchiveInfoComponent(index)

			const message = await getMessage(interact.channel, interact.message.id)
			await message.edit({ embeds, components })
			await interact.update({})
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedInfo)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Mail.View, async ({ interact, storage, data }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!interact.message) throw Err.MissingMessage
			if (!data || !data[0] || isNaN(+data[0])) throw Err.MissingIdData

			const dir = await storage.dir(getArchivePath(interact.guild.id, ""))
			const index = +data[0]
			const path = dir[index]
			if (!path) throw Err.Mail.MissingArchive

			const archive = await storage.get<Archive>(path)
			if (!archive) throw Err.Mail.MissingArchive

			const id = `temp/${interact.user.id}`
			const file = getArchiveFile(archive).replace(/\\n/g, "\u000A")

			if (!(await storage.set(id, file, "txt"))) throw Err.FailedSave

			await interact.followUp({ files: [`data/${id}.txt`] })
			await storage.del(id, "txt")
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Mail.FailedView)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})

client.commands
	.define(ID.Mail.Command, {
		name: ID.Mail.Command,
		description: "Manage ModMail",
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				name: "setup",
				description: "Set up ModMail",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "category",
						description: "Category to create ModMail channels under",
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_CATEGORY],
						required: true,
					},
					{
						name: "afk_timeout",
						description: "Duration in minutes before a ModMail channel is closed due to inactivity",
						type: ApplicationCommandOptionTypes.INTEGER,
						min_value: 0,
						required: true,
					},
				],
			},
			{
				name: "view",
				description: "View an archived channel",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "id",
						description: "Archive identifier",
						type: ApplicationCommandOptionTypes.STRING,
					},
				],
			},
			{
				name: "delete",
				description: "Delete an archived channel",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "id",
						description: "Archive identifier",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
				],
			},
		],
	})
	.create(ID.Mail.Command, async ({ interact, storage }) => {
		const subcommand = interact.options.getSubcommand(true) as Subcommand
		await interact.deferReply({ ephemeral: subcommand !== "view" })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const embed = new EmbedBuilder().color(defaultColor)

			if (subcommand === "setup") {
				const timeout = interact.options.getInteger("afk_timeout", true)
				const category = interact.options.getChannel("category", true)
				if (category.type !== "GUILD_CATEGORY") throw Err.Mail.InvalidCategory

				try {
					const config = await getConfig(storage, interact.guild.id)
					const channel = await getTextChannel(interact.guild, config.channel_id)
					const message = await getMessage(channel, config.message_id)

					if (message && message.deletable) await message.delete()
				} catch {}

				const embeds = [getEntryEmbed()]
				const components = getEntryComponent()
				const message = await interact.channel.send({ embeds, components })
				const config: Config = {
					guild_id: interact.guild.id,
					channel_id: interact.channel.id,
					message_id: message.id,
					category_id: category.id,
					duration: timeout,
					channels: [],
				}

				if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave
				embed.title(Text.Mail.SetupTitle)
			} else if (subcommand === "view") {
				const id = interact.options.getString("id", false)

				const path = getArchivePath(interact.guild.id, "")
				const dir = await storage.dir(path)
				if (dir.length === 0) throw Err.Mail.MissingArchives

				const archive = await (id ? getArchive(storage, interact.guild.id, id) : storage.get<Archive>(dir[0]!))
				if (!archive) throw Err.Mail.MissingArchive

				const embeds = [await getArchiveInfoEmbed(interact.guild, archive, 0, dir.length)]
				const components = getArchiveInfoComponent(0)

				await interact.followUp({ embeds, components })
				return
			} else if (subcommand === "delete") {
				const id = interact.options.getString("id", true)
				if (!(await storage.del(getArchivePath(interact.guild.id, id)))) throw Err.Mail.MissingArchive
				embed.title(Text.Mail.DeleteTitle)
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
		"mail",
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
	await storage.modifyAll<Config>("mail", async (config) => {
		const guild = await getGuild(client, config.guild_id)
		const timeout = config.duration * 60 * 1000

		for (const listing of config.channels) {
			try {
				const channel = await getTextChannel(guild, listing.channel_id)

				try {
					const messages = await channel.messages.fetch()
					const delay = Date.now() - (messages.first()?.createdTimestamp ?? channel.createdTimestamp)

					if (delay >= timeout) {
						await storeChannel(storage, channel as TextChannel)
						const index = config.channels.findIndex((c) => c.channel_id === channel.id)
						config.channels.splice(index, 1)
					}
				} catch (error) {
					logger.warn(error)
				}
			} catch (error) {
				logger.warn(error)
				const index = config.channels.findIndex((c) => c.channel_id === listing.channel_id)
				config.channels.splice(index, 1)
			}
		}

		return config
	})
})
