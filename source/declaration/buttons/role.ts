import { ButtonInteraction } from "discord.js"
import { Action } from "../../internal/action"

export const roleButton = new Action<ButtonInteraction>("button/role-add").invokes(async (interact) => {
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
})
