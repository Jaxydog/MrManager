import { ModalSubmitInteraction } from "discord-modals"
import { Action, ActionCallback, ActionResult } from "../internal/action"
import { newLogger } from "../logger"
import { Embed } from "../wrapper/embed"

export const list: Action<ModalSubmitInteraction>[] = []
const logger = newLogger("modal")

function register(modalName: string, callback: ActionCallback<ModalSubmitInteraction>) {
	const action = new Action<ModalSubmitInteraction>(`modal/${modalName}`).invokes(callback)
	list.push(action)
	logger.info(`Register (${modalName})`)
}
async function auto<A extends unknown[]>(
	callback: (...args: A) => void | Promise<void>,
	...args: A
): Promise<ActionResult> {
	try {
		await callback(...args)
		return { result: true }
	} catch (error) {
		return { result: false, reason: `${error}` }
	}
}

export function registerAll() {}
