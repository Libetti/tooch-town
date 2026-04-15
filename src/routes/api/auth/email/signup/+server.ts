import { json } from '@sveltejs/kit';
import { createSupabaseServerClient, hasSupabaseAuthConfig } from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import { normalizeUsername } from '$lib/supabase/profile';
import type { RequestHandler } from './$types';

type EmailSignupRequestBody = {
	email?: string;
	username?: string;
	captchaToken?: string;
	isResend?: boolean;
};

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

export const POST: RequestHandler = async ({ request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailSignupRequestBody;

	try {
		body = (await request.json()) as EmailSignupRequestBody;
	} catch {
		return json({ error: 'Invalid email sign up payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const username = body.username?.trim() ?? '';
	const captchaToken = body.captchaToken?.trim() ?? '';
	const isResend = body.isResend === true;
	if (!email) {
		return json({ error: 'Enter an email address to create an account.' }, { status: 400 });
	}

	if (!isResend && !captchaToken) {
		return json(
			{ error: 'Complete the captcha before requesting a verification code.' },
			{ status: 400 }
		);
	}

	if (!username) {
		return json({ error: 'Choose a username to create your account.' }, { status: 400 });
	}

	if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
		return json(
			{ error: `Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters for your username.` },
			{ status: 400 }
		);
	}

	if (!USERNAME_PATTERN.test(username)) {
		return json(
			{ error: 'Usernames can only use letters, numbers, and underscores.' },
			{ status: 400 }
		);
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data: usernameAvailable, error: usernameError } = await supabase.rpc(
			'is_username_available',
			{
				username_input: normalizeUsername(username)
			}
		);

		if (usernameError) {
			return json(
				{ error: 'Unable to check that username right now.' },
				{ status: 500 }
			);
		}

		if (!usernameAvailable) {
			return json({ error: 'That username is already taken.' }, { status: 400 });
		}

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true,
				...(captchaToken ? { captchaToken } : {})
			}
		});

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ ok: true });
	} catch {
		return json({ error: 'Unable to send a verification code right now.' }, { status: 500 });
	}
};
