import { Client } from "@jaxydog/dibbs"
import { config } from "dotenv"

config()

export const client = new Client({
	commandGuildId: process.env["GUILD"]!,
	intents: [
		"DIRECT_MESSAGES",
		"GUILDS",
		"GUILD_EMOJIS_AND_STICKERS",
		"GUILD_MEMBERS",
		"GUILD_MESSAGES",
		"GUILD_MESSAGE_REACTIONS",
		"GUILD_PRESENCES",
		"GUILD_SCHEDULED_EVENTS",
	],
	token: process.env["TOKEN"]!,
	storeLogs: false,
	updateGlobalCommands: false,
	timerIntervalSeconds: 10,
})

client.setStatus("dnd")
client.setActivity({ type: "WATCHING", name: "my employees" })

require("./apply")
require("./embed")
require("./mail")
require("./offer")
require("./ping")
require("./poll")
require("./role")
require("./star")

client.connect().then(() => client.timer.invoke())
