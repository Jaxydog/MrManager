import { REST } from "@discordjs/rest"
import { Routes } from "discord-api-types/v10"
import { Modal, showModal, TextInputComponent } from "discord-modals"
import { ApplicationCommandDataResolvable, CommandInteraction, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action, ActionCallback, ActionResult } from "../internal/action"
import { get, has, set } from "../internal/data"
import { newLogger } from "../logger"
import { MailConfig } from "../types"
import { Component } from "../wrapper/component"
import { Embed } from "../wrapper/embed"

export const list: { action: Action<CommandInteraction>; data: ApplicationCommandDataResolvable }[] = []
const logger = newLogger("command")

const roleMap: Map<string, Map<string, Component>> = new Map()
const roleIdMap: Map<string, Map<string, Map<string, symbol>>> = new Map()

async function register(commandName: string, callback: ActionCallback<CommandInteraction>) {
	const action = new Action<CommandInteraction>(`command/${commandName}`).invokes(callback)
	const data = await get<ApplicationCommandDataResolvable>(action.name, true)

	if (!!data) {
		list.push({ action, data })
		logger.info(`Register (${commandName})`)
	} else {
		logger.error(`Register (${commandName})`)
		logger.error(`Missing command data!`)
	}
}
async function auto<A extends unknown[]>(
	callback: (...args: A) => void | Promise<void>,
	...args: A
): Promise<ActionResult> {
	try {
		await callback(...args)
		return { result: true }
	} catch (error) {
		return { result: false, reason: `${error}` }
	}
}

export async function registerAll() {
	await register("ping", (interact) =>
		auto(async (interact) => {
			const delay = Date.now() - interact.createdTimestamp
			const embed = new Embed().title(`Pong! (${delay}ms)`)
			await interact.reply({ embeds: [embed.build()], ephemeral: true })
		}, interact)
	)
	await register("data", (interact) =>
		auto(async (interact) => {
			const path = interact.options.getString("path", true)
			const embed = new Embed()

			if (interact.user.id === process.env["OWNERID"]) {
				const data = await get(path)
				const content = JSON.stringify(data ? data : { error: "Data not stored" }, null, "\t")
				embed.title(`ID: ${path}`).description(`\`\`\`json\n${content}\n\`\`\``)
			} else {
				embed.title("Invalid permission level")
			}

			await interact.reply({ embeds: [embed.build()], ephemeral: true })
		}, interact)
	)
	await register("mail", (interact) =>
		auto(async (interact) => {
			const channel = interact.options.getChannel("channel", true)
			const category = interact.options.getChannel("category", true)
			const timeout = interact.options.getInteger("timeout") ?? 720
			const embed = new Embed()
			let failed = false

			if (channel.type !== "GUILD_TEXT") {
				embed.fields({ name: "Invalid channel", value: "Channel must be a text channel" })
				failed = true
			}
			if (category.type !== "GUILD_CATEGORY") {
				embed.fields({ name: "Invalid category", value: "Category must be a category channel" })
				failed = true
			}

			if (!failed) {
				const path = `mail/${interact.guild!.id}`

				if ((await has(path, true)).result) {
					const { channel: cid, message: mid } = (await get<MailConfig>(path, true))!
					const channel = (await interact.guild?.channels.fetch(cid)) as TextChannel
					const message = await channel?.messages.fetch(mid)
					if (message && message.deletable) await message.delete()
				}

				const mComp = new Component()
				const mEmbed = new Embed()
					.title(`ModMail™️`)
					.description("*Your direct and private line of communication to your moderators!*")

				mComp.add(
					new MessageButton()
						.setCustomId("mail-new")
						.setStyle(MessageButtonStyles.PRIMARY)
						.setLabel("Message")
						.setEmoji("📨")
				)
				mComp.add(
					new MessageButton()
						.setCustomId("mail-info")
						.setStyle(MessageButtonStyles.SECONDARY)
						.setLabel("About")
						.setEmoji("ℹ️")
				)

				const message = await interact.channel!.send({ embeds: [mEmbed.build()], components: mComp.build() })

				await set<MailConfig>(
					path,
					{
						guild: interact.guild!.id,
						channel: channel.id,
						message: message.id,
						category: category.id,
						timeout,
						channels: [],
					},
					true
				)

				embed.title(`Setup successful`)
			} else {
				embed.title(`Setup failed`)
			}

			await interact.reply({ embeds: [embed.build()], ephemeral: true })
		}, interact)
	)
	await register("role", (interact) =>
		auto(async (interact) => {
			const subcommand = interact.options.getSubcommand(true) as "add" | "remove" | "list" | "post"
			const guildIdMap: Map<string, Map<string, symbol>> = roleIdMap.get(interact.guild!.id) ?? new Map()
			const idMap: Map<string, symbol> = guildIdMap.get(interact.user.id) ?? new Map()
			const guildMap: Map<string, Component> = roleMap.get(interact.guild!.id) ?? new Map()
			let component = guildMap.get(interact.user.id) ?? new Component()

			const embed = new Embed()

			switch (subcommand) {
				case "add": {
					const role = interact.options.getRole("role", true)
					const icon = interact.options.getString("icon") ?? ""

					if (!idMap.has(role.id)) {
						idMap.set(
							role.id,
							component.add(
								new MessageButton()
									.setCustomId(`role-add;${role.id}`)
									.setStyle(MessageButtonStyles.SECONDARY)
									.setLabel(role.name)
									.setEmoji(icon)
							)
						)
						embed.title("Added role!").description(`${icon} ${role.name}`.trim())
					} else {
						embed.title("Role already added!").description("Use `/role remove` to delete a role")
					}
					break
				}
				case "remove": {
					const role = interact.options.getRole("role", true)
					const id = idMap.get(role.id)

					if (id && component.del(id)) {
						embed.title("Removed role!").description(`<@&${role.id}>`.trim())
					} else {
						embed.title("Unable to remove role!").description("Use `/role list` for a list of roles")
					}
					break
				}
				case "list": {
					const components = component.build().flatMap((r) => r.components) as MessageButton[]
					const list = components.map((c) =>
						`${c.emoji ? c.emoji.name ?? `\\:${c.emoji.id}:` : ""} ${c.label}`.trim()
					)
					embed.description(
						list.length !== 0
							? list.join("\n")
							: "*No existing role selectors*\n\nUse `/role add` to add a role"
					)
					break
				}
				case "post": {
					const title = interact.options.getString("title", true)
					const channel = interact.options.getChannel("channel", true)

					if (channel.type !== "GUILD_TEXT") {
						embed.title("Invalid channel!").description("Argument `channel` must be a text channel")
					} else {
						const selectorEmbed = new Embed().title(title.length !== 0 ? title : "Roles")
						await channel.send({ embeds: [selectorEmbed.build()], components: component.build() })
						component = new Component()
						embed.title("Posted selection!").description(`See it in <#${channel.id}>`)
					}
					break
				}
			}

			guildMap.set(interact.user.id, component)
			roleMap.set(interact.guild!.id, guildMap)
			guildIdMap.set(interact.user.id, idMap)
			roleIdMap.set(interact.guild!.id, guildIdMap)

			await interact.reply({ embeds: [embed.build()], ephemeral: true })
		}, interact)
	)
	await register("embed", (interact) =>
		auto(async (interact) => {
			const authorName = interact.options.getString("author_name") ?? ""
			const authorIcon = interact.options.getString("author_icon") ?? ""
			const authorURL = interact.options.getString("author_url") ?? ""
			const title = interact.options.getString("title") ?? ""
			const description = interact.options.getString("description") ?? ""
			const image = interact.options.getString("image") ?? ""
			const thumbnail = interact.options.getString("thumbnail") ?? ""
			const footerText = interact.options.getString("footer_text") ?? ""
			const footerIcon = interact.options.getString("footer_icon") ?? ""
			const color = interact.options.getString("color") ?? "0xaa586c"
			const url = interact.options.getString("url") ?? ""
			const preview = interact.options.getBoolean("preview") ?? false

			const embed = new Embed()

			embed
				.author(authorName, authorIcon, authorURL)
				.title(title)
				.description(description)
				.image(image)
				.thumbnail(thumbnail)
				.footer(footerText, footerIcon)
				.color(+color)
				.url(url)

			try {
				await interact.reply({ embeds: [embed.build()], ephemeral: preview })
			} catch (error) {
				await interact.reply({
					embeds: [
						new Embed().title("Error creating embed!").description(`\`\`\`\n${error}\n\`\`\``).build(),
					],
					ephemeral: true,
				})
			}
		}, interact)
	)
}
export async function refresh(clientId: string, guildId?: string) {
	const body = list.map((c) => c.data)
	const rest = new REST({ version: "10" }).setToken(process.env["TOKEN"]!)
	const path = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId)

	try {
		await rest.put(path, { body })
		logger.info(`Refresh (${body.length} commands)`)
		return true
	} catch (error) {
		logger.error(`Refresh (${body.length} commands)`)
		logger.error(error)
		return false
	}
}
