import { Awaitable } from "discord.js"
import FS from "fs/promises"
import { newLogger } from "../logger.js"

export type AllCallback<T> = (data: T, path: string) => Awaitable<void>

export module Cache {
	const logger = newLogger("cache")
	const map: Map<string, unknown> = new Map()

	function log(log: string, success: boolean, silent: boolean) {
		if (!silent) success ? logger.info(log) : logger.warn(log)
		return success
	}
	export function has(path: string, silent: boolean) {
		return log(`Has (${path})`, map.has(path), silent)
	}
	export function get<T>(path: string, silent: boolean): T | undefined {
		if (log(`Get (${path})`, map.has(path), silent)) return map.get(path) as T
	}
	export function set<T>(path: string, data: T, silent: boolean) {
		return log(`Set (${path})`, map.set(path, data).has(path), silent)
	}
	export function del(path: string, silent: boolean) {
		return log(`Del (${path})`, map.delete(path), silent)
	}
	export async function all<T>(dir: string, action: AllCallback<T>, silent: boolean) {
		for (const path of [...map.keys()].filter((k) => k.startsWith(dir))) {
			await action(get<T>(path, silent)!, path)
		}
		log(`All (${dir})`, true, silent)
		return true
	}
	export function clr(silent: boolean) {
		map.clear()
		log("Clr (*)", true, silent)
	}
}
export module Files {
	const logger = newLogger("files")

	type CatchLogResult<T> = { success: true; result: T } | { success: false; result?: never }

	async function catchlog<T>(log: string, promise: Promise<T>, silent: boolean): Promise<CatchLogResult<T>> {
		try {
			const res = await promise
			if (!silent) logger.info(log)
			return { success: true, result: res }
		} catch (error) {
			if (!silent) logger.error(log)
			if (!silent) logger.error(error)
			return { success: false }
		}
	}
	export async function has(path: string, silent: boolean) {
		return (await catchlog(`Has (${path})`, FS.readFile(path), silent)).success
	}
	export async function get<T>(path: string, silent: boolean): Promise<T | undefined> {
		const data = await catchlog(`Get (${path})`, FS.readFile(path, { encoding: "utf8" }), silent)
		if (data.success) return JSON.parse(data.result) as T
	}
	export async function set<T>(path: string, data: T, silent: boolean) {
		const raw = JSON.stringify(data, null, "\t")
		const dir = path.slice(0, path.lastIndexOf("/"))
		await catchlog(`Dir ${dir}`, FS.mkdir(dir, { recursive: true }), silent)
		return (await catchlog(`Set ${path}`, FS.writeFile(path, raw, { encoding: "utf8" }), silent)).success
	}
	export async function del(path: string, silent: boolean) {
		return (await catchlog(`Del (${path})`, FS.rm(path), silent)).success
	}
	export async function all<T>(dir: string, action: AllCallback<T>, silent: boolean) {
		const { success, result } = await catchlog(`All (${dir})`, FS.readdir(dir, { withFileTypes: true }), silent)

		if (!success) return false

		const files = result.filter((e) => e.isFile())

		for (const file of files) {
			const path = filepath(`${dir}${file.name}`)
			const data = (await get<T>(path, silent))!
			await action(data, path)
		}

		return true
	}
}

export function dirpath(id: string) {
	const start = id.startsWith("data/") ? "" : "data/"
	const noext = id.endsWith(".json") ? id.slice(0, id.lastIndexOf(".json")) : id
	const slash = noext.endsWith("/") ? id : `${id}/`
	return `${start}${slash}`
}
export function filepath(id: string) {
	const start = id.startsWith("data/") ? "" : "data/"
	const json = id.endsWith(".json") ? id : `${id}.json`
	return `${start}${json}`
}

export async function has(id: string, silent = true) {
	const path = filepath(id)
	const cache = Cache.has(path, silent)
	const files = await Files.has(path, silent)
	const result = cache || files
	return { cache, files, result }
}
export async function get<T>(id: string, silent = true) {
	const path = filepath(id)

	if (Cache.has(path, silent)) {
		return Cache.get<T>(path, silent)
	} else if (await Files.has(path, silent)) {
		const data = (await Files.get<T>(path, silent))!
		Cache.set(path, data, silent)
		return data
	}
}
export async function set<T>(id: string, data: T, silent = true) {
	const path = filepath(id)
	const cache = Cache.set<T>(path, data, silent)
	const files = await Files.set<T>(path, data, silent)
	const result = cache && files
	return { cache, files, result }
}
export async function del(id: string, silent = true) {
	const path = filepath(id)
	const cache = Cache.del(path, silent)
	const files = await Files.del(path, silent)
	const result = cache && files
	return { cache, files, result }
}
export async function all<T>(id: string, action: AllCallback<T>, silent = true) {
	const dir = dirpath(id)
	const cache = await Cache.all(dir, action, silent)
	const files = await Files.all(dir, action, silent)
	const result = cache && files
	return { cache, files, result }
}
