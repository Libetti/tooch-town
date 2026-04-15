import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Session } from '@supabase/supabase-js';
import {
	clearSupabaseAuthCookies,
	hasSupabaseAuthConfig,
	loadCurrentProfileRow,
	loadSupabaseSession,
	persistSupabaseSession
} from '$lib/server/supabase';
import { buildProfileInsert, mapProfileRecord, type UserProfile } from '$lib/supabase/profile';
import type { ValidatedSignupProfile } from '$lib/supabase/profile';

export const getAuthErrorMessage = (error: unknown, fallback: string) => {
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}

	if (error instanceof Error && error.message) return error.message;
	return fallback;
};

export const jsonSupabaseConfigError = () =>
	json({ error: 'Supabase auth is not configured.', configured: false }, { status: 503 });

export const normalizePhone = (value: string) => value.trim().replace(/[\s()-]/g, '');

export const buildAuthUserLabel = (session: Session | null, profile: UserProfile | null) =>
	profile?.username?.trim() || session?.user?.email || session?.user?.phone || 'Account';

export const buildAuthSnapshot = async (cookies: Cookies) => {
	if (!hasSupabaseAuthConfig) {
		return {
			configured: false as const,
			session: null
		};
	}

	const { session } = await loadSupabaseSession(cookies);
	if (!session?.user) {
		return {
			configured: true as const,
			session: null
		};
	}

	return {
		configured: true as const,
		session
	};
};

export const loadProfileForSession = async (
	cookies: Cookies
): Promise<{ session: Session | null; profile: UserProfile | null; error: string | null }> => {
	if (!hasSupabaseAuthConfig) {
		return { session: null, profile: null, error: 'Supabase auth is not configured.' };
	}

	const { session, client } = await loadSupabaseSession(cookies);
	if (!session?.user || !client) {
		return { session: null, profile: null, error: 'Sign in before loading your profile.' };
	}

	const profileRow = await loadCurrentProfileRow(client, session.user.id);

	return {
		session,
		profile: profileRow ? mapProfileRecord(profileRow) : null,
		error: null
	};
};

export const saveProfileForSession = async (
	cookies: Cookies,
	profile: ValidatedSignupProfile
): Promise<{ session: Session | null; profile: UserProfile | null; error: string | null }> => {
	if (!hasSupabaseAuthConfig) {
		return { session: null, profile: null, error: 'Supabase auth is not configured.' };
	}

	const { session, client } = await loadSupabaseSession(cookies);
	if (!session?.user || !client) {
		return { session: null, profile: null, error: 'Sign in before updating your profile.' };
	}

	try {
		const profileRecord = buildProfileInsert(session.user.id, profile);
		const { error } = await client.from('profiles').upsert(profileRecord, {
			onConflict: 'id'
		});

		if (error) {
			if (
				error.code === '23505' &&
				typeof error.message === 'string' &&
				error.message.includes('username_normalized')
			) {
				return { session, profile: null, error: 'That username is already taken.' };
			}

			return {
				session,
				profile: null,
				error: getAuthErrorMessage(
					error,
					'Your account was created, but we could not finish saving your profile yet.'
				)
			};
		}

		persistSupabaseSession(cookies, session);
		return {
			session,
			profile: mapProfileRecord(profileRecord),
			error: null
		};
	} catch (error) {
		return {
			session,
			profile: null,
			error: getAuthErrorMessage(
				error,
				'Your account was created, but we could not finish saving your profile yet.'
			)
		};
	}
};

export const clearAuthSession = (cookies: Cookies) => {
	clearSupabaseAuthCookies(cookies);
};
