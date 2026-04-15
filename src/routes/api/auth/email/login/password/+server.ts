import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailPasswordLoginBody = {
	email?: string;
	password?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailPasswordLoginBody;

	try {
		body = (await request.json()) as EmailPasswordLoginBody;
	} catch {
		return json({ error: 'Invalid email login payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const password = body.password ?? '';

	if (!email || !password) {
		return json({ error: 'Enter your email and password to log in.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });

		if (error || !data.session) {
			return json({ error: error?.message ?? 'Unable to sign you in.' }, { status: 400 });
		}

		persistSupabaseSession(cookies, data.session);
		return json({ session: data.session });
	} catch {
		return json({ error: 'Unable to sign you in right now.' }, { status: 500 });
	}
};
