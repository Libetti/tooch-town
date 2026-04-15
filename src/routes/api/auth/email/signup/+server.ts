import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { createSupabaseServerClient, hasSupabaseAuthConfig } from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const PENDING_EMAIL_SIGNUP_COOKIE = 'tooch-town-pending-email-signup';
const PENDING_EMAIL_SIGNUP_MAX_AGE_SECONDS = 60 * 15;

type EmailSignupRequestBody = {
	email?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
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
	if (!email) {
		return json({ error: 'Enter an email address to create an account.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const pendingSignupEmail = cookies.get(PENDING_EMAIL_SIGNUP_COOKIE);

		if (pendingSignupEmail === email) {
			const { error: resendError } = await supabase.auth.resend({
				type: 'signup',
				email
			});

			if (!resendError) {
				return json({ ok: true });
			}
		}

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true
			}
		});

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		cookies.set(PENDING_EMAIL_SIGNUP_COOKIE, email, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: PENDING_EMAIL_SIGNUP_MAX_AGE_SECONDS
		});

		return json({ ok: true });
	} catch {
		return json({ error: 'Unable to send a verification code right now.' }, { status: 500 });
	}
};
