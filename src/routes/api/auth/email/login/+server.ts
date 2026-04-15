import { json } from '@sveltejs/kit';
import { createSupabaseServerClient, hasSupabaseAuthConfig } from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailLoginRequestBody = {
	email?: string;
};

export const POST: RequestHandler = async ({ request }) => {
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
	if (!email) {
		return json({ error: 'Enter your email address to log in.' }, { status: 400 });
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
