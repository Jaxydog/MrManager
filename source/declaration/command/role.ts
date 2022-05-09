import { CommandInteraction, MessageButton } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { del, get, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "add" | "remove" | "list" | "post"
export type List = Entry[]
export interface Entry {
	role: string
	name: string
	icon: string
}

export const action = new Action<CommandInteraction>("command/role").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed: Embed

	switch (subcommand) {
		case "add": {
			embed = await subAdd(interact, new Embed())
			break
		}
		case "remove": {
			embed = await subRemove(interact, new Embed())
			break
		}
		case "list": {
			embed = await subList(interact, new Embed())
			break
		}
		case "post": {
			embed = await subPost(interact, new Embed())
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export async function subAdd(interact: CommandInteraction, embed: Embed) {
	const path = `role/${interact.guild!.id}/${interact.user.id}`
	const role = interact.options.getRole("role", true)
	const icon = interact.options.getString("icon", true)
	const list = (await get<List>(path, true)) ?? []

	if (!list.some((i) => i.role === role.id)) {
		list.push({ role: role.id, name: role.name, icon })
		await set(path, list, true)
		embed.title("Added role!").description(`${icon} ${role.name}`.trim())
	} else {
		embed.title("Role already added!").description("Use `/role remove <role>` to delete a role listing")
	}

	return embed
}
export async function subRemove(interact: CommandInteraction, embed: Embed) {
	const path = `role/${interact.guild!.id}/${interact.user.id}`
	const role = interact.options.getRole("role", true)
	const list = (await get<List>(path, true)) ?? []

	if (list.some((i) => i.role === role.id)) {
		list.splice(list.findIndex((i) => i.role === role.id))
		await set(path, list, true)
		embed.title("Removed role!").description(`<@&${role.id}>`)
	} else {
		embed.title("Role already removed!").description("Use `/role list` to view role listings")
	}

	return embed
}
export async function subList(interact: CommandInteraction, embed: Embed) {
	const path = `role/${interact.guild!.id}/${interact.user.id}`
	const list = (await get<List>(path, true)) ?? []

	for (const item of list) {
		const name = `${item.icon} ${item.name}`
		const value = `<@&${item.role}>`
		embed.fields({ name, value })
	}

	if (list.length === 0) {
		embed.title("No roles added!").description("Use `/role add <role>` to add a role listing")
	}

	return embed
}
export async function subPost(interact: CommandInteraction, embed: Embed) {
	const path = `role/${interact.guild!.id}/${interact.user.id}`
	const title = interact.options.getString("title", true)
	const list = (await get<List>(path, true)) ?? []
	const listing = new Embed().title(title)
	const component = new Component()

	for (const item of list) {
		component.add(
			new MessageButton()
				.setCustomId(`role-add;${item.role}`)
				.setStyle(MessageButtonStyles.SECONDARY)
				.setLabel(item.name)
				.setEmoji(item.icon)
		)
	}

	await interact.channel!.send({ embeds: [listing.build()], components: component.build() })
	await del(path, true)
	embed.title("Selection finalized!")
	return embed
}
