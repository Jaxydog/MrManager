import Logger from "@jaxydog/clogts"
import { ApplicationCommandDataResolvable, Awaitable, Client, Interaction } from "discord.js"
import { newLogger } from "../logger.js"
import { get } from "./data.js"

export type ActionCallback<I extends Interaction, T extends ApplicationCommandDataResolvable> = (
	interact: I,
	client: Client,
	data?: T
) => Awaitable<void>
export type ActionResult = { result: true; reason?: never } | { result: false; reason: string }

const logger = newLogger("action")

export class Action<I extends Interaction = Interaction, T extends ApplicationCommandDataResolvable = any> {
	private static __list: Action<any>[] = []

	public readonly name: string
	private readonly __logger: Logger
	private __data?: T
	private __callback: ActionCallback<I, T> = () => {}

	public constructor(name: string) {
		this.name = name
		this.__logger = newLogger(name.split("/")[0]!)
		Action.__list.push(this)
	}

	public static get list() {
		return [...this.__list]
	}

	public get data() {
		return this.__data
	}

	public static getOfType(type: string) {
		return this.list.filter(({ name }) => name.startsWith(type))
	}

	public fetchData() {
		get<T>(this.name, true).then((data) => {
			const text = `Fetch (${this.name})`
			this.__data = data
			data ? this.__logger.info(text) : this.__logger.error(text)
		})
		return this
	}
	public invokes(callback: ActionCallback<I, T>) {
		this.__callback = callback
		return this
	}
	public async invoke(interact: I, client: Client): Promise<ActionResult> {
		try {
			await this.__callback(interact, client, this.__data)
			logger.info(`Invoke (${interact.id})`)
			return { result: true }
		} catch (error) {
			logger.error(`Invoke (${interact.id})`)
			logger.error(error)
			return { result: false, reason: `${error}` }
		}
	}
}
