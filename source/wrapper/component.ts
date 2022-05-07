import { MessageActionRow, MessageActionRowComponentResolvable } from "discord.js"

export class Component {
	private __list: Map<symbol, MessageActionRowComponentResolvable> = new Map()

	public get components() {
		return this.__list.size
	}
	public get rows() {
		return this.build().length
	}

	public add(component: MessageActionRowComponentResolvable) {
		const id = Symbol(component.type)
		this.__list.set(id, component)
		return id
	}
	public del(id: symbol) {
		return this.__list.delete(id)
	}
	public build() {
		const rows: MessageActionRow[] = []
		let current = new MessageActionRow()

		for (const item of this.__list.values()) {
			current.addComponents(item)

			if (current.components.length === 5) {
				rows.push(current)
				current = new MessageActionRow()
			}
		}

		if (current.components.length !== 0) {
			rows.push(current)
		}

		return rows
	}
}
