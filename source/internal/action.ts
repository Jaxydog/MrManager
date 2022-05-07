import { Awaitable, Client, Interaction } from "discord.js"
import { newLogger } from "../logger.js"

export type ActionCallback<I extends Interaction> = (interact: I, client: Client) => Awaitable<ActionResult>
export type ActionResult = { result: true; reason?: never } | { result: false; reason: string }

const logger = newLogger("action")

export class Action<I extends Interaction = Interaction> {
	private static __list: Action<any>[] = []
	public readonly name: string
	private __callback: ActionCallback<I> = () => ({ result: true })

	public constructor(name: string) {
		this.name = name
		Action.__list.push(this)
	}

	public static get list() {
		return [...this.__list]
	}

	public invokes(callback: ActionCallback<I>) {
		this.__callback = callback
		return this
	}
	public async invoke(interact: I, client: Client) {
		const { result, reason } = await this.__callback(interact, client)

		if (result) {
			logger.info(`Invoke (${interact.id})`)
		} else {
			logger.error(`Invoke (${interact.id})`)
			logger.error(reason)
		}

		return result
	}
}
