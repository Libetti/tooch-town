import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailLoginVerifyBody = {
	email?: string;
	token?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailLoginVerifyBody;

	try {
		body = (await request.json()) as EmailLoginVerifyBody;
	} catch {
		return json({ error: 'Invalid email verification payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const token = body.token?.trim() ?? '';

	if (!email) {
		return json({ error: 'Enter the email address you used to log in.' }, { status: 400 });
	}

	if (!token) {
		return json({ error: 'Enter the verification code from your email.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.verifyOtp({
			email,
			token,
			type: 'email'
		});

		if (error || !data.session) {
			return json({ error: error?.message ?? 'Unable to sign you in.' }, { status: 400 });
		}

		persistSupabaseSession(cookies, data.session);
		return json({ session: data.session });
	} catch {
		return json({ error: 'Unable to verify your code right now.' }, { status: 500 });
	}
};
