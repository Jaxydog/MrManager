import { ButtonInteraction, CommandInteraction, MessageButton } from "discord.js"
import { MessageButtonStyles } from "discord.js/typings/enums"
import { Action } from "../../internal/action"
import { del, get, set } from "../../internal/data"
import { Component } from "../../wrapper/component"
import { Embed } from "../../wrapper/embed"

export type Subcommand = "add" | "remove" | "list" | "post"

export interface Entry {
	role: string
	name: string
	icon: string
}

export const action = new Action<CommandInteraction>("command/role").fetchData().invokes(async (interact) => {
	const subcommand = interact.options.getSubcommand(true) as Subcommand
	let embed = new Embed()

	switch (subcommand) {
		case "add": {
			embed = await Commands.addSub(interact, embed)
			break
		}
		case "remove": {
			embed = await Commands.removeSub(interact, embed)
			break
		}
		case "list": {
			embed = await Commands.listSub(interact, embed)
			break
		}
		case "post": {
			embed = await Commands.postSub(interact, embed)
			break
		}
	}

	await interact.reply({ embeds: [embed.build()], ephemeral: true })
})

export module Commands {
	export async function addSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)
		const list = (await get<Entry[]>(path, true)) ?? []

		const role = interact.options.getRole("role", true)
		const icon = interact.options.getString("icon", true)

		if (list.some((e) => e.role === role.id)) {
			return embed.title("Role alread added!")
		}

		list.push({ role: role.id, name: role.name, icon })

		const { result } = await set(path, list, true)
		return embed.title(result ? "Added role!" : "Error adding role!")
	}
	export async function removeSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)
		const list = (await get<Entry[]>(path, true)) ?? []

		const role = interact.options.getRole("role", true)

		if (!list.some((e) => e.role === role.id)) {
			return embed.title("Role already removed!")
		}

		list.splice(list.findIndex((i) => i.role === role.id))

		const { result } = await set(path, list, true)
		return embed.title(result ? "Removed role!" : "Error removing role!")
	}
	export async function listSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)
		const list = (await get<Entry[]>(path, true)) ?? []

		if (list.length === 0) {
			return embed.title("No added roles!")
		}

		for (const item of list) {
			const name = `${item.icon} ${item.name}`
			const value = `<@&${item.role}>`
			embed.fields({ name, value })
		}

		return embed.title("Role list")
	}
	export async function postSub(interact: CommandInteraction, embed: Embed) {
		const path = Utility.dataPath(interact.guild!.id, interact.user.id)
		const list = (await get<Entry[]>(path, true)) ?? []

		const title = interact.options.getString("title", true)
		const listing = new Embed().title(title)
		const component = new Component()

		for (const item of list) {
			const button = new MessageButton()
				.setCustomId(`role-add;${item.role}`)
				.setStyle(MessageButtonStyles.SECONDARY)
				.setLabel(item.name)
				.setEmoji(item.icon)
			component.add(button)
		}

		await interact.channel!.send({ embeds: [listing.build()], components: component.build() })
		const { result } = await del(path, true)
		return embed.title(result ? "Selection finalized!" : "Error finalizing selection!")
	}
}
export module Buttons {
	export const roleBtn = new Action<ButtonInteraction>("button/role-add").invokes(async (interact) => {
		const [, snowflake] = interact.customId.split(";") as [string, string]
		const role = await interact.guild!.roles.fetch(snowflake)
		const user = await interact.guild!.members.fetch(interact.user.id)

		if (!role) throw "Invalid role snowflake"

		if (user.roles.cache.some((r) => r.equals(role))) await user.roles.remove(role)
		else await user.roles.add(role)

		await interact.deferUpdate()
	})
}
export module Utility {
	export function dataPath(guildId: string, userId: string) {
		return `role/${guildId}/${userId}`
	}
}
