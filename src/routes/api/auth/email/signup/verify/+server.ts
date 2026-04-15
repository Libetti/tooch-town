import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailSignupVerifyBody = {
	email?: string;
	token?: string;
	password?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailSignupVerifyBody;

	try {
		body = (await request.json()) as EmailSignupVerifyBody;
	} catch {
		return json({ error: 'Invalid email verification payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const token = body.token?.trim() ?? '';
	const password = body.password ?? '';

	if (!email) {
		return json({ error: 'Enter the email address you used to sign up.' }, { status: 400 });
	}

	if (!token) {
		return json({ error: 'Enter the verification code from your email.' }, { status: 400 });
	}

	if (!password) {
		return json({ error: 'Enter a password for future sign in.' }, { status: 400 });
	}

	if (password.length < 8) {
		return json({ error: 'Use at least 8 characters for your password.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.verifyOtp({
			email,
			token,
			type: 'email'
		});

		if (error || !data.session) {
			return json(
				{
					error:
						error?.message ?? 'Your email was verified, but we could not finish your account setup.'
				},
				{ status: 400 }
			);
		}

		const userClient = createSupabaseServerClient();
		const { error: sessionError } = await userClient.auth.setSession({
			access_token: data.session.access_token,
			refresh_token: data.session.refresh_token
		});

		if (sessionError) {
			return json({ error: sessionError.message }, { status: 400 });
		}

		const { error: passwordError } = await userClient.auth.updateUser({ password });
		if (passwordError) {
			return json({ error: passwordError.message }, { status: 400 });
		}

		persistSupabaseSession(cookies, data.session);
		return json({ session: data.session });
	} catch {
		return json({ error: 'Unable to verify your code right now.' }, { status: 500 });
	}
};
