import { ModalSubmitInteraction } from "discord-modals"
import { Action } from "../../internal/action"
import { get, set } from "../../internal/data"
import { Embed } from "../../wrapper/embed"
import { PollCommand } from "../declaration"

export const modalModal = new Action<ModalSubmitInteraction>("modal/poll-modal").invokes(async (interact) => {
	const [, guild, user] = interact.customId.split(";") as [string, string, string]
	const path = `poll/${guild}_${user}`
	const data = await get<PollCommand.Data>(path, true)

	if (!data) return

	const content: Record<string, unknown> = {}
	interact.fields.forEach((f) => (content[f.customId] = f.value))
	data.responses.push({
		user: interact.user.id,
		data: JSON.stringify(content),
	})

	await set(path, data, true)
	await interact.followUp({ embeds: [new Embed().build()], ephemeral: true })
})
