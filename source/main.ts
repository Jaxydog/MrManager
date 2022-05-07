import DotEnv from "dotenv"
DotEnv.config()

import { Client } from "discord.js"
import { newLogger } from "./logger"
import { get } from "./internal/data"
import { BotConfig } from "./types"
import { list as buttonList, registerAll as registerButtons } from "./declaration/buttons"
import {
	list as commandList,
	refresh as refreshCommands,
	registerAll as registerCommands,
} from "./declaration/commands"
import { refresh as refreshMail } from "./internal/mail"
import initModals from "discord-modals"
import { list as modalList, registerAll as registerModals } from "./declaration/modals"

const client = new Client({ intents: [] })
const logger = newLogger("client")
initModals(client)

async function loadConfig() {
	const config = await get<BotConfig>("bot/config", true)
	if (!config) throw logger.error("Missing config")
	return config
}

client.on("ready", async (client) => {
	const config = await loadConfig()
	client.user.setPresence(config.presence)

	registerModals()
	registerButtons()
	await registerCommands()
	await refreshCommands(client.user.id, config.dev ? process.env["DEVGUILDID"] : undefined)
	await refreshMail(client)
})
client.on("interactionCreate", async (interact) => {
	if (interact.user.bot) return
	logger.info(`Interact (${interact.id})`)

	if (interact.isCommand()) {
		const entry = commandList.find(({ data: { name } }) => name === interact.commandName)

		if (!!entry) {
			await entry.action.invoke(interact, client)
		} else {
			logger.error(`Interact (${interact.commandName})`)
		}
	} else if (interact.isButton()) {
		const entry = buttonList.find(({ name }) => name === `button/${interact.customId.split(";")[0]!}`)

		if (!!entry) {
			await entry.invoke(interact, client)
		} else {
			logger.error(`Interact (${interact.customId})`)
		}
	}
})
client.on("modalSubmit", async (modal) => {
	const entry = modalList.find(({ name }) => name === `modal/${modal.customId.split(";")[0]!}`)

	if (!!entry) {
		await entry.invoke(modal, client)
	} else {
		logger.error(`Modal (${modal.customId})`)
	}
})

loadConfig().then(async (config) => {
	client.options.intents = config.intents

	try {
		await client.login(process.env["TOKEN"])
		logger.info(`Connect (${client.user!.tag})`)
	} catch (error) {
		logger.error(`Connect (${client.user!.tag})`)
		logger.error(error)
	}
})
