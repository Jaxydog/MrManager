import { BitFieldResolvable, IntentsString, PresenceData } from "discord.js"

interface BotConfig {
	dev: boolean
	intents: BitFieldResolvable<IntentsString, number>
	presence: PresenceData
	mailInterval: number
}
interface MailConfig {
	guild: string
	channel: string
	message: string
	category: string
	timeout: number
	channels: {
		user: string
		channel: string
	}[]
}
