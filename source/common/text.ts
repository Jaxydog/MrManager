export enum Text {
	AboutEmoji = "ℹ️",
	AboutLabel = "About",
	ReasonLabel = "Reason",
	TimezoneLabel = "Timezone (UTC)",
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
		AcceptStatus = "👍 Accept",
		AcceptTitle = "Accepted application",
		DenyEmoji = "👎",
		DenyLabel = "Deny",
		DenyStatus = "👎 Deny",
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
	export enum Mail {
		AboutTitle = "About ModMail",
		AboutDescription = "ModMail is a system that allows users of a guild to create private channels in order to contact the guild's moderators directly" +
			"\n\nChannels created through the ModMail system are only visible to you and the guild's moderators." +
			"\n\nUpon archiving a channel, all messages sent within that channel are saved and visible to guild moderators." +
			"\n\nChannels are automatically archived after an AFK timeout that is set per-guild; the current guild timeout is ",
		ArchiveEmoji = "🔒",
		ArchiveLabel = "Archive",
		ArchiveReason = "ModMail channel archived",
		ArchiveTitle = "Archived channel",
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
		WelcomeTitle = "An admin or moderator will be with you shortly",
		WelcomeDescription = "...or you can close your ticket with the button below",
	}
	export enum Poll {
		ChoiceCreateTitle = "Created option",
		ChoiceDeleteTitle = "Deleted option",
		ClosesField = "Poll Closes",
		CloseTitle = "Close Poll",
		CreateTitle = "Created poll",
		DeleteTitle = "Deleted poll",
		ResultTitle = "Poll results",
		SendTitle = "Sent poll",
		SetupTitle = "Set up polls",
		SubmitTitle = "Response recorded",
	}
	export enum Role {
		CreateTitle = "Created selector",
		DeleteTitle = "Deleted selector",
		SendTitle = "Sent role selectors",
		ViewTitle = "Role selectors",
	}
}
