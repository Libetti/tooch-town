import { json } from '@sveltejs/kit';
import { loadProfileForSession, saveProfileForSession } from '$lib/server/auth';
import { hasSupabaseAuthConfig } from '$lib/server/supabase';
import { validateSignupProfile, type SignupProfileInput } from '$lib/supabase/profile';
import { jsonSupabaseConfigError } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type ProfileBody = {
	profile?: SignupProfileInput;
};

export const GET: RequestHandler = async ({ cookies }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	try {
		const result = await loadProfileForSession(cookies);
		if (result.error) {
			return json({ error: result.error }, { status: 400 });
		}

		return json({
			session: result.session,
			profile: result.profile
		});
	} catch {
		return json({ error: 'Unable to load your profile right now.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: ProfileBody;

	try {
		body = (await request.json()) as ProfileBody;
	} catch {
		return json({ error: 'Invalid profile payload.' }, { status: 400 });
	}

	const validation = validateSignupProfile(
		body.profile ?? {
			username: '',
			firstName: '',
			lastName: '',
			country: '',
			state: '',
			city: ''
		}
	);

	if (!validation.profile) {
		return json({ error: validation.error ?? 'Invalid profile payload.' }, { status: 400 });
	}

	const result = await saveProfileForSession(cookies, validation.profile);
	if (result.error) {
		return json({ error: result.error }, { status: 400 });
	}

	return json({
		session: result.session,
		profile: result.profile
	});
};
