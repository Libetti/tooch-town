import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { buildAuthSnapshot, jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type SessionExchangeBody = {
	code?: string;
	accessToken?: string;
	refreshToken?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: SessionExchangeBody;

	try {
		body = (await request.json()) as SessionExchangeBody;
	} catch {
		return json({ error: 'Invalid auth session payload.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();

		if (body.code) {
			const { data, error } = await supabase.auth.exchangeCodeForSession(body.code);
			if (error || !data.session) {
				return json({ error: 'Unable to finish signing you in.' }, { status: 400 });
			}

			persistSupabaseSession(cookies, data.session);
			return json(await buildAuthSnapshot(cookies));
		}

		if (body.accessToken && body.refreshToken) {
			const { data, error } = await supabase.auth.setSession({
				access_token: body.accessToken,
				refresh_token: body.refreshToken
			});

			if (error || !data.session) {
				return json({ error: 'Unable to finish signing you in.' }, { status: 400 });
			}

			persistSupabaseSession(cookies, data.session);
			return json(await buildAuthSnapshot(cookies));
		}

		return json({ error: 'Missing auth session payload.' }, { status: 400 });
	} catch {
		return json({ error: 'Unable to finish signing you in.' }, { status: 500 });
	}
};
