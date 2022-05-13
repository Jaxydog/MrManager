import { REST } from "@discordjs/rest"
import { Routes } from "discord-api-types/v10"
import { Action } from "../internal/action"
import { newLogger } from "../logger"

export * as ApplyCommand from "./command/apply"
export * as DataCommand from "./command/data"
export * as EmbedCommand from "./command/embed"
export * as MailCommand from "./command/mail"
export * as OfferCommand from "./command/offer"
export * as PingCommand from "./command/ping"
export * as PollCommand from "./command/poll"
export * as RoleCommand from "./command/role"

export async function refreshCommands(clientId: string, guildId?: string) {
	const body = Action.getOfType("command")
		.filter((c) => !!c.data)
		.map((c) => c.data)
	const rest = new REST({ version: "10" }).setToken(process.env["TOKEN"]!)
	const path = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId)
	const logger = newLogger("command")

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
