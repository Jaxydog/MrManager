import { BitFieldResolvable, IntentsString, PresenceData } from "discord.js"

interface BotConfig {
	dev: boolean
	intents: BitFieldResolvable<IntentsString, number>
	presence: PresenceData
	refreshInterval: number
}
