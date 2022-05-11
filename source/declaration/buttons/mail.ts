import { ButtonInteraction, TextChannel } from "discord.js"
import { Action } from "../../internal/action"
import { get, has, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"
import { ApplyCommand, MailCommand } from "../declaration"

export const infoButton = new Action<ButtonInteraction>("button/mail-info").invokes(async (interact) => {
	const { timeout } = (await get<MailCommand.Config>(`mail/${interact.guild!.id}`, true))!
	const hours = (timeout / 60).toPrecision(2)

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
				value: "Channels are archived upon request or AFK timeout.\nAll messages sent within ModMail™️ channels **are saved** for moderation purposes.",
			},
			{
				name: "Inactivity",
				value: `Channels will archive automatically after ${timeout} minutes (${hours} hours).`,
			}
		)

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})
export const newButton = new Action<ButtonInteraction>("button/mail-new").invokes(async (interact) => {
	const path = `mail/${interact.guild!.id}`
	const apps = `apps/${interact.guild!.id}`
	const appData = await get<ApplyCommand.Data>(apps, true)
	const config = (await get<MailCommand.Config>(path, true))!
	const embed = new Embed()

	if (appData && !appData.responses.some((r) => r.user === interact.user.id && r.accepted)) {
		embed.title("You must be a member of this guild to use ModMail™️!")
	} else if (config.channels.some(({ user }) => user === interact.user.id)) {
		const { channel } = config.channels.find(({ user }) => user === interact.user.id)!
		embed.title("You already have an active channel!").description(`<#${channel}>`)
	} else {
		const channel = (await interact.guild!.channels.create(interact.user.username, {
			parent: config.category,
			type: 0,
		})) as TextChannel
		await channel.permissionOverwrites.create(interact.user, { SEND_MESSAGES: true, VIEW_CHANNEL: true })

		config.channels.push({ user: interact.user.id, channel: channel.id })
		await set(path, config, true)

		const component = new Component()
		component.add(MailCommand.closeButton)
		component.add(MailCommand.infoButton)

		embed.title("Channel created!").description(`<#${channel.id}>`)
		await MailCommand.timeout(channel)
		await channel.send({
			embeds: [new Embed().title("An admin / moderator will be with you shortly!").build()],
			components: component.build(),
		})
	}
	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})
export const closeButton = new Action<ButtonInteraction>("button/mail-close").invokes(async (interact) => {
	await MailCommand.archive(interact.channel as TextChannel)
	await interact.deferUpdate()
})
