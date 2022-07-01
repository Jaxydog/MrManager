import { BaseStorage, ButtonBuilder, ComponentBuilder, EmbedBuilder } from "@jaxydog/dibbs"
import { Guild } from "discord.js"
import { ApplicationCommandOptionTypes, ChannelTypes, MessageButtonStyles } from "discord.js/typings/enums"
import { Err } from "./common/err"
import { ID } from "./common/id"
import { Text } from "./common/text"
import { defaultColor, getMember, getRole } from "./common/util"
import { client } from "./main"

export type Subcommand = "create" | "delete" | "view" | "send"

export interface Config {
	user_id: string
	roles: Entry[]
}
export interface Entry {
	role_id: string
	emoji?: string
}

export function getPath(guildId: string, userId: string) {
	return `role/${guildId}_${userId}`
}
export async function getConfig(storage: BaseStorage, guildId: string, userId: string) {
	return (await storage.get<Config>(getPath(guildId, userId))) ?? { roles: [], user_id: userId }
}
export async function getRoleComponent(guild: Guild, config: Config) {
	const builder = new ComponentBuilder()

	for (const { role_id, emoji } of config.roles.slice(0, 25)) {
		const role = await getRole(guild, role_id)
		const button = new ButtonBuilder()
			.dataId(ID.Role.Selector, role_id)
			.style(MessageButtonStyles.SECONDARY)
			.emoji(emoji ?? "")
			.label(role.name)
			.build()

		builder.component(button)
	}

	return builder.build()
}

client.buttons.create(ID.Role.Selector, async ({ interact, data }) => {
	try {
		if (!interact.guild) throw Err.MissingGuild
		if (!interact.channel) throw Err.MissingChannel
		if (!interact.channel.isText()) throw Err.MissingTextChannel
		if (!data || data.length === 0) throw Err.MissingIdData

		const roleId = data[0]
		if (!roleId) throw Err.MissingIdData

		const role = await getRole(interact.guild, roleId)
		const member = await getMember(interact.guild, interact.user.id)

		if (member.roles.cache.some((r) => r.equals(role))) {
			await member.roles.remove(role)
		} else {
			await member.roles.add(role)
		}

		await interact.update({ fetchReply: false })
	} catch (error) {
		const embed = new EmbedBuilder()
			.color(defaultColor)
			.title(Err.Role.FailedSelector)
			.description(`> ${error}`)
			.build()

		await interact.reply({ embeds: [embed], ephemeral: true })
	}
})

client.commands
	.define(ID.Role.Command, {
		name: ID.Role.Command,
		description: "Manage role selectors",
		dm_permission: false,
		default_member_permissions: "0",
		options: [
			{
				name: "create",
				description: "Create a selector",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "role",
						description: "Selector role",
						type: ApplicationCommandOptionTypes.ROLE,
						required: true,
					},
					{
						name: "emoji",
						description: "Selector emoji",
						type: ApplicationCommandOptionTypes.STRING,
					},
				],
			},
			{
				name: "delete",
				description: "Delete a selector",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "role",
						description: "Selector role",
						type: ApplicationCommandOptionTypes.ROLE,
						required: true,
					},
				],
			},
			{
				name: "view",
				description: "View selectors",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
			},
			{
				name: "send",
				description: "Post selectors",
				type: ApplicationCommandOptionTypes.SUB_COMMAND,
				options: [
					{
						name: "title",
						description: "Embed title",
						type: ApplicationCommandOptionTypes.STRING,
						required: true,
					},
				],
			},
		],
	})
	.create(ID.Role.Command, async ({ interact, storage }) => {
		await interact.deferReply({ ephemeral: true })

		try {
			if (!interact.guild) throw Err.MissingGuild
			if (!interact.channel) throw Err.MissingChannel
			if (!interact.channel.isText()) throw Err.MissingTextChannel

			const config = await getConfig(storage, interact.guild.id, interact.user.id)
			const subcommand = interact.options.getSubcommand(true) as Subcommand
			const embed = new EmbedBuilder().color(defaultColor)
			const path = getPath(interact.guild.id, interact.user.id)

			if (subcommand === "create") {
				const role = interact.options.getRole("role", true)
				const emoji = interact.options.getString("emoji")

				if (config.roles.some((r) => r.role_id === role.id)) throw Err.Role.UnexpectedRole

				config.roles.push({ role_id: role.id, emoji: emoji ?? undefined })

				if (!(await storage.set(path, config))) throw Err.FailedSave
				embed.title(Text.Role.CreateTitle)
			} else if (subcommand === "delete") {
				const role = interact.options.getRole("role", true)
				const index = config.roles.findIndex((r) => r.role_id === role.id)

				if (index === -1) throw Err.Role.MissingRole

				config.roles.splice(index, 1)

				if (!(await storage.set(path, config))) throw Err.FailedSave
				embed.title(Text.Role.DeleteTitle)
			} else if (subcommand === "view") {
				const embeds = [new EmbedBuilder().color(defaultColor).title(Text.Role.ViewTitle).build()]
				const components = await getRoleComponent(interact.guild, config)

				components.forEach((c) => c.components.forEach((c) => c.setDisabled(true)))

				await interact.followUp({ embeds, components })
				return
			} else if (subcommand === "send") {
				const title = interact.options.getString("title", true)
				if (title.length > 256) throw Err.InvalidTitleLength

				const embeds = [new EmbedBuilder().color(defaultColor).title(title).build()]
				const components = await getRoleComponent(interact.guild, config)

				if (!(await storage.del(path))) throw Err.FailedSave
				await interact.channel.send({ embeds, components })
				embed.title(Text.Role.SendTitle)
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
