import { ButtonInteraction, Collection, MessageButton, TextChannel } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action, ActionCallback, ActionResult } from "../internal/action"
import { get, set } from "../internal/data"
import { archive, timeAFK } from "../internal/mail"
import { newLogger } from "../logger"
import { MailConfig } from "../types"
import { Component } from "../wrapper/component"
import { Embed } from "../wrapper/embed"

export const list: Action<ButtonInteraction>[] = []
const logger = newLogger("button")

function register(buttonName: string, callback: ActionCallback<ButtonInteraction>) {
	const action = new Action<ButtonInteraction>(`button/${buttonName}`).invokes(callback)
	list.push(action)
	logger.info(`Register (${buttonName})`)
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

export function registerAll() {
	register("mail-info", (interact) =>
		auto(async (interact) => {
			const { timeout } = (await get<MailConfig>(`mail/${interact.guild!.id}`, true))!

			const embed = new Embed()
				.title("About ModMail™️")
				.description(
					"ModMail™️ is a system that allows users of a guild to create private channels in order to contact the guild's moderators directly."
				)
				.fields(
					{
						name: "Privacy",
						value: "Channels automatically created through this system are set to only include you and the guild's moderators.",
					},
					{
						name: "Archiving",
						value: "Channels are archived upon request or AFK timeout.\nAll messages send within ModMail™️ channels **are saved** for moderation purposes.",
					},
					{
						name: "Inactivity",
						value: `Channels will archive automatically after ${timeout} minutes (${(
							timeout / 60
						).toPrecision(2)} hours).`,
					}
				)

			await interact.reply({ embeds: [embed.build()], ephemeral: true })
		}, interact)
	)
	register("mail-new", (interact) =>
		auto(async (interact) => {
			const path = `mail/${interact.guild!.id}`
			const { channels, category } = (await get<MailConfig>(path, true))!

			if (channels.some(({ user }) => user === interact.user.id)) {
				const { channel } = channels.find(({ user }) => user === interact.user.id)!
				const embed = new Embed()
					.title(`You already have an active channel`)
					.description(`Channel: <#${channel}>`)
				await interact.reply({ embeds: [embed.build()], ephemeral: true })
			} else {
				const channel = (await interact.guild!.channels.create(interact.user.username, {
					parent: category,
					type: 0,
				})) as TextChannel

				await channel.permissionOverwrites.create(interact.user, { VIEW_CHANNEL: true, SEND_MESSAGES: true })

				const data = (await get<MailConfig>(path, true))!
				data.channels.push({ user: interact.user.id, channel: channel.id })
				await set(path, data, true)

				const component = new Component()
				const embed = new Embed().title("An admin or moderator will be with you shortly!")

				component.add(
					new MessageButton()
						.setCustomId("mail-close")
						.setStyle(MessageButtonStyles.DANGER)
						.setLabel("Archive")
						.setEmoji("🔒")
				)
				component.add(
					new MessageButton()
						.setCustomId("mail-info")
						.setStyle(MessageButtonStyles.SECONDARY)
						.setLabel("About")
						.setEmoji("ℹ️")
				)

				timeAFK(channel)

				await channel.send({ embeds: [embed.build()], components: component.build() })
				await interact.reply({
					embeds: [new Embed().title("Channel created!").description(`<#${channel.id}>`).build()],
					ephemeral: true,
				})
			}
		}, interact)
	)
	register("mail-close", (interact) =>
		auto(async (interact) => {
			await archive(interact.channel as TextChannel)
			await interact.deferUpdate()
		}, interact)
	)
	register("role-add", (interact) =>
		auto(async (interact) => {
			const [, snowflake] = interact.customId.split(";") as [string, string]
			const role = await interact.guild!.roles.fetch(snowflake)
			const user = await interact.guild!.members.fetch(interact.user.id)

			if (!role) throw "Invalid role snowflake"

			if (user.roles.cache.some((r) => r.equals(role))) {
				await user.roles.remove(role)
			} else {
				await user.roles.add(role)
			}

			await interact.deferUpdate()
		}, interact)
	)
}
