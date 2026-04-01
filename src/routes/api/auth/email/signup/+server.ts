import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type EmailSignupBody = {
	email?: string;
	password?: string;
	emailRedirectTo?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: EmailSignupBody;

	try {
		body = (await request.json()) as EmailSignupBody;
	} catch {
		return json({ error: 'Invalid sign up payload.' }, { status: 400 });
	}

	const email = body.email?.trim() ?? '';
	const password = body.password ?? '';

	if (!email || !password) {
		return json({ error: 'Enter an email address to create an account.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: body.emailRedirectTo
				? {
						emailRedirectTo: body.emailRedirectTo
					}
				: undefined
		});

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		if (data.session) {
			persistSupabaseSession(cookies, data.session);
		}

		return json({
			session: data.session,
			userId: data.user?.id ?? null
		});
	} catch {
		return json({ error: 'Unable to create your account right now.' }, { status: 500 });
	}
};
