import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailLoginRequestBody = {
	email?: string;
	password?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailLoginRequestBody;

	try {
		body = (await request.json()) as EmailLoginRequestBody;
	} catch {
		return json({ error: 'Invalid email login payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const password = body.password ?? '';
	if (!email) {
		return json({ error: 'Enter your email address to log in.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		if (password) {
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });

			if (error || !data.session) {
				return json({ error: error?.message ?? 'Unable to sign you in.' }, { status: 400 });
			}

			persistSupabaseSession(cookies, data.session);
			return json({ session: data.session });
		}

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
