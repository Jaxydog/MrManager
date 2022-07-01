export enum ID {
	Reason = "reason",
	Timezone = "timezone",
}
export module ID {
	export enum Apply {
		About = "apply_about",
		Accept = "apply_accept",
		Command = "apply",
		Deny = "apply_deny",
		Resubmit = "apply_resubmit",
		Submit = "apply_submit",
	}
	export enum Mail {
		About = "mail_about",
		Archive = "mail_archive",
		Create = "mail_create",
		Command = "mail",
		Last = "mail_last",
		Next = "mail_next",
		View = "mail_view",
	}
	export enum Poll {
		Choice = "poll_choice",
		Command = "poll",
	}
	export enum Role {
		Command = "role",
		Selector = "role_selector",
	}
}
