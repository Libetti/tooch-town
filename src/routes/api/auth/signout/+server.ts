import { json } from '@sveltejs/kit';
import { clearAuthSession, jsonSupabaseConfigError } from '$lib/server/auth';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	readSupabaseAuthCookies
} from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	try {
		const { accessToken, refreshToken } = readSupabaseAuthCookies(cookies);
		if (accessToken && refreshToken) {
			const supabase = createSupabaseServerClient();
			const { error } = await supabase.auth.setSession({
				access_token: accessToken,
				refresh_token: refreshToken
			});

			if (!error) {
				await supabase.auth.signOut();
			}
		}
	} catch {
		// Clearing the local cookies is enough to finish sign out even if the upstream call fails.
	}

	clearAuthSession(cookies);
	return json({ ok: true });
};
