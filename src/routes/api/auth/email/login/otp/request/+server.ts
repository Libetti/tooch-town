import { json } from '@sveltejs/kit';
import { createSupabaseServerClient, hasSupabaseAuthConfig } from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import { verifyTurnstileToken } from '$lib/server/turnstile';
import type { RequestHandler } from './$types';

type EmailOtpLoginRequestBody = {
	email?: string;
	turnstileToken?: string;
};

export const POST: RequestHandler = async ({ fetch, getClientAddress, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailOtpLoginRequestBody;

	try {
		body = (await request.json()) as EmailOtpLoginRequestBody;
	} catch {
		return json({ error: 'Invalid email login payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	if (!email) {
		return json({ error: 'Enter your email address to log in.' }, { status: 400 });
	}

	const turnstileResult = await verifyTurnstileToken({
		token: body.turnstileToken,
		remoteIp: getClientAddress(),
		fetcher: fetch
	});
	if (!turnstileResult.ok) {
		return json({ error: turnstileResult.error }, { status: turnstileResult.status });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: false
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
