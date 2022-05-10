import { ModalSubmitInteraction } from "discord-modals"
import { Action } from "../../internal/action"
import { get, set } from "../../internal/data"
import { Data, Entry, Timezone, timezoneRegExp } from "../command/apply"

export const modalModal = new Action<ModalSubmitInteraction>("modal/apply-modal").invokes(async (interact) => {
	const path = `apps/${interact.guild!.id}`
	const data = (await get<Data>(path, true))!

	const entry: Entry = { user: interact.user.id, answers: [] }

	if (timezoneRegExp.test(interact.getTextInputValue("timezone"))) {
		entry.timezone = interact.getTextInputValue("timezone") as Timezone
	}

	interact.fields.forEach((field) => {
		if (field.customId !== "timezone") entry.answers[+field.customId] = field.value
	})

	if (data.responses.some((r) => r.user === interact.user.id)) {
		const index = data.responses.findIndex((r) => r.user === interact.user.id)
		data.responses.splice(index)
	}

	data.responses.push(entry)
	await set(path, data, true)
	await interact.update({})
})
