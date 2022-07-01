import { Client, Guild, TextBasedChannel } from "discord.js"
import { Err } from "./err"

export const defaultColor = 0xaa586c

export function getUnix(time?: number) {
	time ??= Date.now()
	return +`${time}`.slice(0, -3)
}
export function getUnixIn(minutes: number, time?: number) {
	const date = new Date((time ?? Date.now()) + minutes * 60 * 1000)
	return getUnix(date.getTime())
}
export function fromUnix(unix: number) {
	return new Date(unix * 1000)
}
export function toUTC(offset: number) {
	return `UTC${offset >= 0 ? "+" : ""}${offset}`
}

export async function getGuild(client: Client, id: string) {
	const guild = await client.guilds.fetch(id)
	if (!guild) throw Err.InvalidGuildId
	return guild
}
export async function getChannel(guild: Guild, id: string) {
	const channel = await guild.channels.fetch(id)
	if (!channel) throw Err.InvalidChannelId
	return channel
}
export async function getTextChannel(guild: Guild, id: string) {
	const channel = await getChannel(guild, id)
	if (!channel.isText()) throw Err.InvalidChannelType
	return channel
}
export async function getMessage(channel: TextBasedChannel, id: string) {
	const message = await channel.messages.fetch(id)
	if (!message) throw Err.InvalidMessageId
	return message
}
export async function getMember(guild: Guild, id: string) {
	const member = await guild.members.fetch(id)
	if (!member) throw Err.InvalidUserId
	return member
}
export async function getRole(guild: Guild, id: string) {
	const role = await guild.roles.fetch(id)
	if (!role) throw Err.InvalidRoleId
	return role
}
