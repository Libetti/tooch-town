import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const PENDING_EMAIL_SIGNUP_COOKIE = 'tooch-town-pending-email-signup';

type EmailSignupVerifyBody = {
	email?: string;
	token?: string;
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

	if (!email) {
		return json({ error: 'Enter the email address you used to sign up.' }, { status: 400 });
	}

	if (!token) {
		return json({ error: 'Enter the verification code from your email.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.verifyOtp({
			email,
			token,
			type: 'signup'
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

		persistSupabaseSession(cookies, data.session);
		cookies.delete(PENDING_EMAIL_SIGNUP_COOKIE, { path: '/' });
		return json({ session: data.session });
	} catch {
		return json({ error: 'Unable to verify your code right now.' }, { status: 500 });
	}
};
