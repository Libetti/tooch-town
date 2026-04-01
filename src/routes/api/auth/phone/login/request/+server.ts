import { json } from '@sveltejs/kit';
import { createSupabaseServerClient, hasSupabaseAuthConfig } from '$lib/server/supabase';
import { jsonSupabaseConfigError, normalizePhone } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type PhoneRequestBody = {
	phone?: string;
};

export const POST: RequestHandler = async ({ request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: PhoneRequestBody;

	try {
		body = (await request.json()) as PhoneRequestBody;
	} catch {
		return json({ error: 'Invalid phone sign in payload.' }, { status: 400 });
	}

	const phone = normalizePhone(body.phone ?? '');
	if (!phone) {
		return json({ error: 'Enter your phone number to log in.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { error } = await supabase.auth.signInWithOtp({
			phone,
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
