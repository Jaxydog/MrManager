export enum Text {
	AboutEmoji = "ℹ️",
	AboutLabel = "About",
	ReasonLabel = "Reason",
	TimezoneLabel = "Your timezone (UTC format)",
}
export module Text {
	export enum Apply {
		AboutDesc = "Guild applications are a way to help a guild's moderators manage new members." +
			"\n\nNew members are presented with a form that will ask for their timezone as well as 1-4 guild-specific questions." +
			"\n\nResponses to application forms are saved within the bot's internal storage and sent to the guild's output channel." +
			"\n\nFrom there, the guild's moderators will decide whether you, the applicant, are a suitable fit for the guild.",
		AboutTitle = "About applications",
		AcceptEmoji = "👍",
		AcceptLabel = "Accept",
		AcceptStatus = "👍 Accepted",
		AcceptTitle = "Accepted application",
		Command = "Manage guild applications",
		DenyEmoji = "👎",
		DenyLabel = "Deny",
		DenyStatus = "👎 Denied",
		DenyTitle = "Denied application",
		PendingStatus = "🤔 Pending",
		ResubmitEmoji = "🤷",
		ResubmitLabel = "Resubmit",
		ResubmitStatus = "🤷 Resubmit",
		ResubmitTitle = "Requested resubmission",
		SetupTitle = "Set up applications",
		SubmitEmoji = "👋",
		SubmitLabel = "Apply to Guild",
		SubmitTitle = "Application submitted",
		TimezonesTitle = "Guild timezones",
		ViewTitle = "Displayed user application",
	}
	export module Apply {
		export enum Subcommand {
			Setup = "Set up guild applications",
			Timezones = "View the guild's submitted timezones",
			View = "View a user's application",
		}
		export enum Option {
			AcceptRole = "Role given to accepted members",
			Branding = "Branding image URL",
			Description = "Embed description",
			FormOutput = "Application output channel",
			Question = "Application question",
			User = "Target user",
		}
	}
	export enum Embed {
		Command = "Create a message embed",
	}
	export module Embed {
		export enum Options {
			AuthorIcon = "Author icon URL",
			AuthorName = "Author name",
			AuthorUrl = "Author URL",
			Color = "Color resolvable",
			Description = "Description",
			FooterIcon = "Footer icon URL",
			FooterText = "Footer text",
			Image = "Image URL",
			Preview = "Whether to preview the embed",
			Thumbnail = "Thumbnail URL",
			Title = "Title",
			Url = "URL",
		}
	}
	export enum Mail {
		AboutDescription = "ModMail is a system that allows users of a guild to create private channels in order to contact the guild's moderators directly" +
			"\n\nChannels created through the ModMail system are only visible to you and the guild's moderators." +
			"\n\nUpon archiving a channel, all messages sent within that channel are saved and visible to guild moderators." +
			"\n\nChannels are automatically archived after an AFK timeout that is set per-guild; the current guild timeout is ",
		AboutTitle = "About ModMail",
		ArchiveEmoji = "🔒",
		ArchiveLabel = "Archive",
		ArchiveReason = "ModMail channel archived",
		ArchiveTitle = "Archived channel",
		Command = "Manage ModMail",
		CreateEmoji = "📨",
		CreateLabel = "Message",
		CreateReason = "ModMail channel created",
		DeleteTitle = "Deleted channel archive",
		EntryDescription = "*Your direct line of communication to your moderators!*",
		EntryTitle = "ModMail",
		LastEmoji = "⬅️",
		NextEmoji = "➡️",
		SetupTitle = "Set up ModMail",
		ViewEmoji = "🔍",
		WelcomeDescription = "...or you can close your ticket with the button below",
		WelcomeTitle = "An admin or moderator will be with you shortly",
	}
	export module Mail {
		export enum Option {
			Category = "ModMail channel output category",
			Id = "Archive identifier",
			Timeout = "Duration in minutes before a ModMail channel is archived due to inactivity",
		}
		export enum Subcommand {
			Delete = "Delete a channel archive",
			Setup = "Set up ModMail",
			View = "View channel archives",
		}
	}
	export enum Offer {
		Command = "Post a trade or service offer",
		OfferingName = "Offering",
		WantingName = "Wanting",
	}
	export module Offer {
		export enum Option {
			Duration = "Offer duration in hours",
			Giving = "The item or service that you are offering",
			Wanting = "The item or service that you want in return",
		}
	}
	export enum Ping {
		Command = "Tests the bot's response time",
	}
	export enum Poll {
		ChoiceCreateTitle = "Created choice",
		ChoiceDeleteTitle = "Deleted choice",
		ClosesField = "Poll Closes",
		CloseTitle = "Close Poll",
		Command = "Manage polls",
		CreateTitle = "Created poll",
		DeleteTitle = "Deleted poll",
		ResultTitle = "Poll results",
		SendTitle = "Sent poll",
		SetupTitle = "Set up polls",
		SubmitTitle = "Response recorded",
	}
	export module Poll {
		export enum Option {
			Description = "Poll description",
			Duration = "Poll duration in hours",
			Output = "Poll output channel",
			Title = "Poll title",
		}
		export module Option {
			export enum Choice {
				Emoji = "Choice emoji",
				Title = "Choice title",
			}
		}
		export enum Subcommand {
			Close = "Close a poll",
			Create = "Create a poll",
			Delete = "Delete a poll",
			Send = "Send a poll",
			Setup = "Set up polls",
			View = "View a poll",
		}
		export module Subcommand {
			export enum Choice {
				Create = "Create a choice",
				Delete = "Delete a choice",
				Group = "Manage choices",
			}
		}
	}
	export enum Role {
		Command = "Manage role selectors",
		CreateTitle = "Created selector",
		DeleteTitle = "Deleted selector",
		SendTitle = "Sent role selectors",
		ViewTitle = "Role selectors",
	}
	export module Role {
		export enum Options {
			Emoji = "Selector emoji",
			Role = "Selector role",
			Title = "Selector group title",
		}
		export enum Subcommand {
			Create = "Create a selector",
			Delete = "Delete a selector",
			Send = "Send selectors",
			View = "View selectors",
		}
	}
	export enum Star {
		CommandDescription = "Manage star vote channels",
		CreateTitle = "Created star channel",
		DeleteTitle = "Deleted star channel",
	}
	export module Star {
		export enum Option {
			Count = "Number of stars required for channel output, default 1",
			Input = "Source channel",
			Output = "Output channel",
		}
		export enum Subcommand {
			Create = "Create a star channel",
			Delete = "Delete a star channel",
		}
	}
}
