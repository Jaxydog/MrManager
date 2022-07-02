export module ID {
	export enum Apply {
		About = "apply_about",
		Accept = "apply_accept",
		Command = "apply",
		Deny = "apply_deny",
		Resubmit = "apply_resubmit",
		Submit = "apply_submit",
	}
	export module Apply {
		export enum Option {
			AcceptRole = "accept_role",
			Branding = "branding_url",
			Description = "description",
			FormOutput = "send_forms_to",
			Question1 = "question_1",
			Question2 = "question_2",
			Question3 = "question_3",
			Question4 = "question_4",
			Reason = "reason",
			Timezone = "timezone",
			User = "user",
		}
		export enum Status {
			Accept = "accept",
			Deny = "deny",
			Pending = "pending",
			Resubmit = "resubmit",
		}
		export enum Subcommand {
			Setup = "setup",
			Timezones = "timezones",
			View = "view",
		}
	}
	export enum Embed {
		Command = "embed",
	}
	export module Embed {
		export enum Options {
			AuthorIcon = "author_icon",
			AuthorName = "author_name",
			AuthorUrl = "author_url",
			Color = "color",
			Description = "description",
			FooterIcon = "footer_icon",
			FooterText = "footer_text",
			Image = "image",
			Preview = "preview",
			Thumbnail = "thumbnail",
			Title = "title",
			Url = "url",
		}
	}
	export enum Mail {
		About = "mail_about",
		Archive = "mail_archive",
		Command = "mail",
		Create = "mail_create",
		Last = "mail_last",
		Next = "mail_next",
		View = "mail_view",
	}
	export module Mail {
		export enum Option {
			Category = "category",
			Id = "id",
			Timeout = "afk_timeout",
		}
		export enum Subcommand {
			Delete = "delete",
			Setup = "setup",
			View = "view",
		}
	}
	export enum Offer {
		Command = "offer",
	}
	export module Offer {
		export enum Option {
			Duration = "duration",
			Giving = "giving",
			Wanting = "wanting",
		}
	}
	export enum Ping {
		Command = "ping",
	}
	export enum Poll {
		Choice = "poll_choice",
		Command = "poll",
	}
	export module Poll {
		export enum Option {
			Description = "description",
			Duration = "duration",
			Output = "output_channel",
			Title = "title",
		}
		export module Option {
			export enum Choice {
				Emoji = "emoji",
				Title = "title",
			}
		}
		export enum Subcommand {
			Close = "close",
			Create = "create",
			Delete = "delete",
			Send = "send",
			Setup = "setup",
			View = "view",
		}
		export module Subcommand {
			export enum Choice {
				Create = "create",
				Delete = "delete",
				Group = "choice",
			}
		}
	}
	export enum Role {
		Command = "role",
		Selector = "role_selector",
	}
	export module Role {
		export enum Options {
			Emoji = "emoji",
			Role = "role",
			Title = "title",
		}
		export enum Subcommand {
			Create = "create",
			Delete = "delete",
			Send = "send",
			View = "view",
		}
	}
	export enum Star {
		Command = "star",
	}
	export module Star {
		export enum Option {
			Count = "star_count",
			Input = "input_channel",
			Output = "output_channel",
		}
		export enum Subcommand {
			Create = "create",
			Delete = "delete",
		}
	}
}
