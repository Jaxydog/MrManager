import Logger, { Level, Rule } from "@jaxydog/clogts"
import dayjs from "dayjs"

Logger.store = false
Logger.default.colors.create("name", "hsl(320, 35%, 65%)")
Logger.default.colors.create("lt.i", "hsl(190, 35%, 65%)")
Logger.default.colors.create("lt.w", "hsl(35, 55%, 65%)")
Logger.default.colors.create("lt.e", "hsl(0, 50%, 65%)")
Logger.default.colors.create("bg.l", "gray-bright")
Logger.default.colors.create("bg.d", "gray")

Logger.default.props.create(
	Level.All,
	() => dayjs().format("DD-MM-YY HH:mm:ss"),
	new Rule(/\d/g, "bg.l"),
	new Rule(/[:,-]/g, "bg.d")
)
Logger.default.props.create(Level.Info, () => `<i>`, new Rule(/[<>]/g, "bg.d"), new Rule(/i/g, "lt.i"))
Logger.default.props.create(Level.Warn, () => `<?>`, new Rule(/[<>]/g, "bg.d"), new Rule(/\?/g, "lt.w"))
Logger.default.props.create(Level.Error, () => `<!>`, new Rule(/[<>]/g, "bg.d"), new Rule(/!/g, "lt.e"))

export function newLogger(name: string) {
	const logger = Logger.default.clone()
	name = name.toUpperCase()

	logger.props.create(Level.All, () => name, new Rule(/.*/, "name"))
	logger.props.create(Level.All, () => ":", new Rule(/:/, "bg.d"))

	return logger
}
