import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import type { Database, ProfileRow } from '$lib/supabase/types';

export const hasSupabaseAuthConfig = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

const ACCESS_TOKEN_COOKIE = 'tooch-town-sb-access-token';
const REFRESH_TOKEN_COOKIE = 'tooch-town-sb-refresh-token';
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const getSupabaseConfig = () => {
	if (!hasSupabaseAuthConfig) {
		throw new Error('Supabase auth is not configured.');
	}

	return {
		url: env.SUPABASE_URL as string,
		anonKey: env.SUPABASE_ANON_KEY as string
	};
};

const getCookieOptions = (maxAge?: number) => ({
	path: '/',
	httpOnly: true,
	secure: !dev,
	sameSite: 'lax' as const,
	...(typeof maxAge === 'number' ? { maxAge } : {})
});

export const createSupabaseServerClient = (accessToken?: string): SupabaseClient<Database> => {
	const { url, anonKey } = getSupabaseConfig();

	return createClient<Database>(url, anonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false
		},
		...(accessToken
			? {
					global: {
						headers: {
							Authorization: `Bearer ${accessToken}`
						}
					}
				}
			: {})
	});
};

export const clearSupabaseAuthCookies = (cookies: Cookies) => {
	cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
	cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
};

export const persistSupabaseSession = (cookies: Cookies, session: Session) => {
	const accessTokenMaxAge =
		typeof session.expires_at === 'number'
			? Math.max(session.expires_at - Math.floor(Date.now() / 1000), 0)
			: undefined;

	cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, getCookieOptions(accessTokenMaxAge));
	cookies.set(
		REFRESH_TOKEN_COOKIE,
		session.refresh_token,
		getCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS)
	);
};

export const readSupabaseAuthCookies = (cookies: Cookies) => ({
	accessToken: cookies.get(ACCESS_TOKEN_COOKIE) ?? null,
	refreshToken: cookies.get(REFRESH_TOKEN_COOKIE) ?? null
});

export const loadSupabaseSession = async (
	cookies: Cookies
): Promise<{ session: Session | null; client: SupabaseClient<Database> | null }> => {
	if (!hasSupabaseAuthConfig) {
		return { session: null, client: null };
	}

	const { accessToken, refreshToken } = readSupabaseAuthCookies(cookies);
	if (!accessToken || !refreshToken) {
		return { session: null, client: null };
	}

	const supabase = createSupabaseServerClient();
	const { data, error } = await supabase.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken
	});

	if (error || !data.session) {
		clearSupabaseAuthCookies(cookies);
		return { session: null, client: null };
	}

	persistSupabaseSession(cookies, data.session);

	return {
		session: data.session,
		client: createSupabaseServerClient(data.session.access_token)
	};
};

export const loadCurrentProfileRow = async (
	client: SupabaseClient<Database>,
	userId: string
): Promise<ProfileRow | null> => {
	const { data, error } = await client
		.from('profiles')
		.select(
			'id, username, username_normalized, first_name, last_name, country, state, city, created_at, updated_at'
		)
		.eq('id', userId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data;
};
