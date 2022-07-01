import {
	BaseStorage,
	ButtonBuilder,
	ComponentBuilder,
	EmbedBuilder,
	ModalBuilder,
	ModalFieldBuilder,
} from "@jaxydog/dibbs"
import { Guild, TextBasedChannel, User } from "discord.js"
import {
	ApplicationCommandOptionTypes,
	ChannelTypes,
	MessageButtonStyles,
	TextInputStyles,
} from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { client } from "./main"
import { defaultColor, getGuild, getMember, getMessage, getRole, getTextChannel, getUnix, toUTC } from "./common/util"

export type Status = "pending" | "accept" | "deny" | "resubmit"
export type Subcommand = "setup" | "view" | "timezones"

export interface Config {
	guild_id: string
	input_channel_id: string
	input_message_id: string
	output_channel_id: string
	accept_role_id: string
	questions: string[]
	entries: Entry[]
}
export interface Entry {
	output_message_id: string
	user_id: string
	created_unix: number
	status: Status
	reason?: string
	offset_utc?: number
	answers: string[]
}

export function getPath(guildId: string) {
	return `apply/${guildId}`
}
export async function getConfig(storage: BaseStorage, guildId: string) {
	const config = await storage.get<Config>(getPath(guildId))
	if (!config) throw Err.Apply.MissingConfig
	return config
}
export function getEntry(config: Config, id: string) {
	const entry = config.entries.find((e) => e.user_id === id)
	if (!entry) throw Err.Apply.MissingResponse
	return entry
}
export function getStatusText(status: Status) {
	switch (status) {
		case "pending":
			return Text.Apply.PendingStatus
		case "accept":
			return Text.Apply.AcceptStatus
		case "deny":
			return Text.Apply.DenyStatus
		case "resubmit":
			return Text.Apply.ResubmitStatus
	}
}
export function getInputEmbed(name: string, desc: string, brand: string) {
	return new EmbedBuilder()
		.color(defaultColor)
		.title(`Welcome to ${name}`)
		.description(desc.replace(/\\n/g, "\n"))
		.thumbnail(brand)
		.build()
}
export function getInputComponent() {
	const submit = new ButtonBuilder()
		.id(ID.Apply.Submit)
		.style(MessageButtonStyles.PRIMARY)
		.emoji(Text.Apply.SubmitEmoji)
		.label(Text.Apply.SubmitLabel)
		.build()
	const about = new ButtonBuilder()
		.id(ID.Apply.About)
		.style(MessageButtonStyles.SECONDARY)
		.emoji(Text.AboutEmoji)
		.label(Text.AboutLabel)
		.build()

	return new ComponentBuilder().component(submit).component(about).build()
}
export async function getEntryEmbed(user: User, config: Config) {
	const entry = getEntry(config, user.id)

	await user.fetch()

	const status = `**Status:** ${getStatusText(entry.status)}\n`
	const reason = entry.reason ? `**Reason:** ${entry.reason}\n` : ""
	const received = `**Received:** <t:${entry.created_unix}:R>\n`
	const timezone = entry.offset_utc ? `**Timezone:** ${toUTC(entry.offset_utc)}\n` : ""
	const answers = config.questions.map((name, i) => ({ name, value: `> ${entry.answers[i] ?? "*No response*"}` }))

	return new EmbedBuilder()
		.color(user.accentColor ?? defaultColor)
		.author(user.tag, user.avatarURL() ?? "")
		.description(`${status}${reason}${received}${timezone}`)
		.thumbnail(user.avatarURL() ?? "")
		.fields(...answers)
		.build()
}
export function getEntryComponent(user: User, config: Config) {
	const entry = getEntry(config, user.id)

	const accept = new ButtonBuilder()
		.dataId(ID.Apply.Accept, user.id)
		.style(MessageButtonStyles.SUCCESS)
		.emoji(Text.Apply.AcceptEmoji)
		.label(Text.Apply.AcceptLabel)
		.build()
	const deny = new ButtonBuilder()
		.dataId(ID.Apply.Deny, user.id)
		.style(MessageButtonStyles.SUCCESS)
		.emoji(Text.Apply.DenyEmoji)
		.label(Text.Apply.DenyLabel)
		.build()
	const resubmit = new ButtonBuilder()
		.dataId(ID.Apply.Resubmit, user.id)
		.style(MessageButtonStyles.SUCCESS)
		.emoji(Text.Apply.ResubmitEmoji)
		.label(Text.Apply.ResubmitLabel)
		.build()

	const component = new ComponentBuilder().component(accept).component(deny).component(resubmit).build()

	if (entry.status !== "pending") {
		component.forEach((r) => r.components.forEach((c) => c.setDisabled(true)))
	}

	return component
}
export function getSubmitModal(guild: Guild, user: User, config: Config) {
	const timezone = new ModalFieldBuilder()
		.id(ID.Timezone)
		.style(TextInputStyles.SHORT)
		.title(Text.TimezoneLabel)
		.placeholder(toUTC(0))
		.bounds(5, 6)
		.build()

	const title = `Apply to ${guild.name}`

	const modal = new ModalBuilder()
		.dataId(ID.Apply.Submit, user.id)
		.title(title.length <= 45 ? title : "Apply to guild")
		.field(timezone)

	config.questions.forEach((question, index) => {
		const field = new ModalFieldBuilder()
			.id(`${index}`)
			.style(TextInputStyles.PARAGRAPH)
			.title(question)
			.bounds(1, 1024)
			.required(true)
			.build()

		modal.field(field)
	})

	return modal.build()
}
export function getDenyModal(user: User) {
	const reason = new ModalFieldBuilder().id(ID.Reason).style(TextInputStyles.SHORT).title(Text.ReasonLabel).build()

	const title = `Deny ${user.tag}`

	return new ModalBuilder()
		.dataId(ID.Apply.Deny, user.id)
		.title(title.length <= 45 ? title : "Deny user")
		.field(reason)
		.build()
}
export function getResubmitModal(user: User) {
	const reason = new ModalFieldBuilder().id(ID.Reason).style(TextInputStyles.SHORT).title(Text.ReasonLabel).build()

	const title = `Request resubmit from ${user.tag}`

	return new ModalBuilder()
		.dataId(ID.Apply.Resubmit, user.id)
		.title(title.length <= 45 ? title : "Request resubmit from user")
		.field(reason)
		.build()
}
export async function closeEntry(user: User, config: Config, target: Status, reason?: string) {
	const index = config.entries.findIndex((e) => e.user_id === user.id)
	if (index === -1) throw Err.Apply.MissingResponse

	const entry = Object.assign({}, config.entries[index]!)
	if (entry.status !== "pending") throw Err.Apply.ExpectedPendingStatus

	const guild = await getGuild(client.client, config.guild_id)
	const channel = await getTextChannel(guild, config.output_channel_id)
	const message = await getMessage(channel, entry.output_message_id)

	config.entries[index]!.status = target
	config.entries[index]!.reason = reason

	const embeds = [await getEntryEmbed(user, config)]
	const components = getEntryComponent(user, config)
	await message.edit({ embeds, components })
}

client.buttons
	.create(ID.Apply.About, async ({ interact }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			await interact.guild.fetch()

			const embed = new EmbedBuilder()
				.color(defaultColor)
				.author(interact.guild.name, interact.guild.iconURL() ?? "")
				.title(Text.Apply.AboutTitle)
				.description(Text.Apply.AboutDesc)
				.build()

			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedAbout)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
	.create(ID.Apply.Submit, async ({ interact, storage }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const config = await getConfig(storage, interact.guild.id)
			const entry = config.entries.find((e) => e.user_id === interact.user.id)
			if (entry && entry.status !== "resubmit") throw Err.Apply.UnexpectedResponse

			await interact.showModal(getSubmitModal(interact.guild, interact.user, config))
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedSubmit)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Apply.Accept, async ({ interact, storage, data }) => {
		try {
			await interact.deferReply({ ephemeral: true })

			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!data || data.length === 0) throw Err.MissingIdData

			const userId = data[0]
			if (!userId) throw Err.MissingIdData

			const member = await getMember(interact.guild, userId)
			const config = await getConfig(storage, interact.guild.id)

			await closeEntry(member.user, config, "accept")

			if (!member.roles.cache.some((r) => r.id === config.accept_role_id)) {
				const role = await getRole(interact.guild, config.accept_role_id)
				await member.roles.add(role)
			}

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

			const title = `Your application for ${interact.guild.name} has been accepted!`
			const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.AcceptTitle).build()
			const notif = new EmbedBuilder()
				.color(defaultColor)
				.title(title.length <= 256 ? title : "Your application has been accepted!")
				.description(
					`Thank you for applying; after careful consideration, the moderators of ${interact.guild.name} have accepted your application!`
				)
				.build()

			await member.send({ embeds: [notif] })
			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedAccept)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
	.create(ID.Apply.Deny, async ({ interact, data }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!data || data.length === 0) throw Err.MissingIdData

			const userId = data[0]
			if (!userId) throw Err.MissingIdData

			const member = await getMember(interact.guild, userId)
			await interact.showModal(getDenyModal(member.user))
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedDeny)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})
	.create(ID.Apply.Resubmit, async ({ interact, data }) => {
		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!data || data.length === 0) throw Err.MissingIdData

			const userId = data[0]
			if (!userId) throw Err.MissingIdData

			const member = await getMember(interact.guild, userId)
			await interact.showModal(getResubmitModal(member.user))
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedResubmit)
				.description(`> ${error}`)
				.build()

			await interact.reply({ embeds: [embed], ephemeral: true })
		}
	})

client.modals
	.create(ID.Apply.Submit, async ({ interact, storage }) => {
		try {
			await interact.deferReply({ ephemeral: true })

			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const config = await getConfig(storage, interact.guild.id)
			const utc = interact.fields.getTextInputValue(ID.Timezone) ?? ""
			const entry: Entry = {
				user_id: interact.user.id,
				created_unix: getUnix(interact.createdTimestamp),
				status: "pending",
				answers: config.questions.map((_, i) => interact.fields.getTextInputValue(`${i}`)),
				output_message_id: "",
				offset_utc: /^UTC([+-][0-9]{1,2})$/i.test(utc) ? +utc.slice(3) : undefined,
			}

			if (config.entries.some((e) => e.user_id === entry.user_id)) {
				const index = config.entries.findIndex((e) => e.user_id === entry.user_id)!
				config.entries.splice(index, 1, entry)
			} else {
				config.entries.push(entry)
			}

			const channel = await getTextChannel(interact.guild, config.output_channel_id)
			const embeds = [await getEntryEmbed(interact.user, config)]
			const components = getEntryComponent(interact.user, config)
			const message = await channel.send({ embeds, components })

			entry.output_message_id = message.id

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

			const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.SubmitTitle).build()
			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedSubmit)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
	.create(ID.Apply.Deny, async ({ interact, storage, data }) => {
		try {
			await interact.deferReply({ ephemeral: true })

			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!data || data.length === 0) throw Err.MissingIdData

			const userId = data[0]
			if (!userId) throw Err.MissingIdData

			const member = await getMember(interact.guild, userId)
			const config = await getConfig(storage, interact.guild.id)
			const reason = interact.fields.getTextInputValue("reason") ?? "*No reason provided*"
			await closeEntry(member.user, config, "deny", reason)

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

			const title = `Your application for ${interact.guild.name} has been denied`
			const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.AcceptTitle).build()
			const notif = new EmbedBuilder()
				.color(defaultColor)
				.title(title.length <= 256 ? title : "Your application has been denied")
				.description(
					`Thank you for applying; after careful consideration, the moderators of ${interact.guild.name} have denied your application.\n\n> ${reason}`
				)
				.build()

			await member.send({ embeds: [notif] })
			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedDeny)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
	.create(ID.Apply.Resubmit, async ({ interact, storage, data }) => {
		try {
			await interact.deferReply({ ephemeral: true })

			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel
			if (!data || data.length === 0) throw Err.MissingIdData

			const userId = data[0]
			if (!userId) throw Err.MissingIdData

			const member = await getMember(interact.guild, userId)
			const config = await getConfig(storage, interact.guild.id)
			const reason = interact.fields.getTextInputValue("reason") ?? "*No reason provided*"
			await closeEntry(member.user, config, "resubmit", reason)

			if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

			const title = `Your application for ${interact.guild.name} has been marked for resubmit`
			const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.AcceptTitle).build()
			const notif = new EmbedBuilder()
				.color(defaultColor)
				.title(title.length <= 256 ? title : "Your application has been marked for resubmit")
				.description(
					`Thank you for applying; after careful consideration, the moderators of ${interact.guild.name} have requested that you submit a new application.\n\n> ${reason}`
				)
				.build()

			await member.send({ embeds: [notif] })
			await interact.followUp({ embeds: [embed] })
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.Apply.FailedResubmit)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})

client.commands
	.define(ID.Apply.Command, {
		name: ID.Apply.Command,
		description: "Manage guild applications",
		default_member_permissions: "0",
		dm_permission: false,
		options: [
			{
				name: "setup",
				description: "Sets up guild applications",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "branding_url",
						description: "Guild branding image URL",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: "description",
						description: "Application embed description",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: "send_forms_to",
						description: "Text channel to output forms into",
						type: ApplicationCommandOptionTypes.CHANNEL,
						channel_types: [ChannelTypes.GUILD_TEXT],
						required: true,
					},
					{
						name: "accept_role",
						description: "Role to give to accepted members",
						type: ApplicationCommandOptionTypes.ROLE,
						required: true,
					},
					{
						name: "question_1",
						description: "Application form question",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
					{
						name: "question_2",
						description: "Application form question",
						type: ApplicationCommandOptionTypes.STRING,
					},
					{
						name: "question_3",
						description: "Application form question",
						type: ApplicationCommandOptionTypes.STRING,
					},
					{
						name: "question_4",
						description: "Application form question",
						type: ApplicationCommandOptionTypes.STRING,
					},
				],
			},
			{
				name: "view",
				description: "Displays the specified user's form submission",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "user",
						description: "Target user",
						type: ApplicationCommandOptionTypes.USER,
						required: true,
					},
				],
			},
			{
				name: "timezones",
				description: "Displays the guild's submitted timezones",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
		],
	})
	.create(ID.Apply.Command, async ({ interact, storage }) => {
		try {
			await interact.deferReply({ ephemeral: true })

			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const subcommand = interact.options.getSubcommand(true) as Subcommand

			if (subcommand === "setup") {
				const description = interact.options.getString("description", true)
				if (description.length > 4096) throw Err.InvalidDescriptionLength

				const outputId = interact.options.getChannel("send_forms_to", true).id
				await getTextChannel(interact.guild, outputId)

				const q1 = interact.options.getString("question_1", true)
				if (q1.length > 45) throw Err.InvalidLabelLength
				const q2 = interact.options.getString("question_2")
				if (q2 && q2.length > 45) throw Err.InvalidLabelLength
				const q3 = interact.options.getString("question_3")
				if (q3 && q3.length > 45) throw Err.InvalidLabelLength
				const q4 = interact.options.getString("question_4")
				if (q4 && q4.length > 45) throw Err.InvalidLabelLength

				const old = await storage.get<Config>(getPath(interact.guild.id))
				if (old) {
					const channel = (await interact.guild.channels.fetch(
						old.input_channel_id
					)) as TextBasedChannel | null
					const message = await channel?.messages.fetch(old.input_message_id)
					if (message && message.deletable) await message.delete()
				}

				const brand = interact.options.getString("branding_url", true)
				const embeds = [getInputEmbed(interact.guild.name, description, brand)]
				const components = getInputComponent()
				const message = await interact.channel.send({ embeds, components })

				const config: Config = {
					guild_id: interact.guild.id,
					input_channel_id: message.channel.id,
					input_message_id: message.id,
					output_channel_id: outputId,
					accept_role_id: interact.options.getRole("accept_role", true).id,
					questions: [q1, q2, q3, q4].filter((q) => !!q) as string[],
					entries: [],
				}

				if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave

				const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.SetupTitle).build()
				await interact.followUp({ embeds: [embed] })
				return
			}

			const config = await getConfig(storage, interact.guild.id)

			if (subcommand === "view") {
				const user = interact.options.getUser("user", true)
				const index = config.entries.findIndex((e) => e.user_id === user.id)
				const embeds = [await getEntryEmbed(user, config)]
				const components = getEntryComponent(user, config)
				const message = await interact.channel.send({ embeds, components })

				config.entries[index]!.output_message_id = message.id

				if (!(await storage.set(getPath(interact.guild.id), config))) throw Err.FailedSave
				const embed = new EmbedBuilder().color(defaultColor).title(Text.Apply.ViewTitle).build()
				await interact.followUp({ embeds: [embed] })
				return
			}
			if (subcommand === "timezones") {
				const total = config.entries.filter((e) => !!e.offset_utc).length
				if (total === 0) throw Err.Apply.MissingTimezones

				const zones = new Map<string, number>()

				config.entries
					.filter((e) => !!e.offset_utc)
					.map((e) => e.offset_utc!)
					.sort((a, b) => a - b)
					.map(toUTC)
					.forEach((z) => zones.set(z, (zones.get(z) ?? 0) + 1))

				const mean = [...zones.keys()].filter((z1, _, a) => {
					a.every((z2) => {
						const c1 = zones.get(z1)!
						const c2 = zones.get(z2)!
						return c1 > c2
					}) || a.length === 1
				})
				const offsets = [...zones.entries()].map(([name, count]) => {
					const percent = ((count / total) * 100).toFixed(2)
					const value = `${count} (${percent}%)`
					return { name, value, inline: true }
				})

				const common = `**Most common:** ${mean.join(", ")}`
				const embed = new EmbedBuilder()
					.color(defaultColor)
					.title(Text.Apply.TimezonesTitle)
					.description(common)
					.fields(...offsets)
					.build()

				await interact.followUp({ embeds: [embed] })
				return
			}
		} catch (error) {
			const embed = new EmbedBuilder()
				.color(defaultColor)
				.title(Err.FailedExecute)
				.description(`> ${error}`)
				.build()

			await interact.followUp({ embeds: [embed] })
		}
	})
