import { EmbedBuilder } from "@jaxydog/dibbs"
import { Message } from "discord.js"
import { client } from "./main"
import { defaultColor } from "./common/util"
import { ID } from "./common/id"
import { Text } from "./common/text"

client.commands
	.define(ID.Ping.Command, {
		name: ID.Ping.Command,
		description: Text.Ping.Command,
	})
	.create(ID.Ping.Command, async ({ interact }) => {
		const embed = new EmbedBuilder().color(defaultColor)
		const reply = (await interact.reply({
			embeds: [embed.clone().title("Pong! (...)").build()],
			ephemeral: true,
			fetchReply: true,
		})) as Message

		const delay = reply.createdTimestamp - interact.createdTimestamp
		await interact.editReply({ embeds: [embed.title(`Pong! (${delay}ms)`).build()] })
	})
