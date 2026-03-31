import { browser } from '$app/environment';
import type { Session } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { getSupabaseBrowserClient, hasSupabaseAuthConfig } from '$lib/supabase/client';

export type PendingAuthFlow = 'signup' | 'login' | 'signout' | null;

export const authSession = writable<Session | null>(null);
export const authPendingFlow = writable<PendingAuthFlow>(null);
export const authError = writable<string | null>(null);
export const authNotice = writable<string | null>(null);

let initialized = false;

export const initializeSupabaseAuth = () => {
	if (!browser || initialized || !hasSupabaseAuthConfig) return;

	initialized = true;

	const supabase = getSupabaseBrowserClient();

	void (async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		authSession.set(session);
	})();

	supabase.auth.onAuthStateChange((_event, session) => {
		authSession.set(session);
	});
};

export const clearAuthFeedback = () => {
	authError.set(null);
	authNotice.set(null);
};

const setSupabaseError = (error: unknown) => {
	if (typeof error === 'string') {
		authError.set(error);
		return;
	}

	if (error instanceof Error) {
		if (error.message === 'Failed to fetch') {
			authError.set('Unable to reach Supabase right now. Check your auth URL and network connection.');
			return;
		}

		authError.set(error.message);
		return;
	}

	authError.set('Something went wrong while contacting Supabase.');
};

export const signUpWithEmail = async (input: {
	email: string;
	password: string;
	passwordConfirm: string;
}) => {
	clearAuthFeedback();

	const email = input.email.trim();
	if (!email) {
		authError.set('Enter an email address to create an account.');
		return false;
	}

	if (input.password.length < 8) {
		authError.set('Use at least 8 characters for your password.');
		return false;
	}

	if (input.password !== input.passwordConfirm) {
		authError.set('Your password confirmation does not match.');
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase.auth.signUp({
			email,
			password: input.password,
			options: browser
				? {
						emailRedirectTo: window.location.origin
					}
				: undefined
		});

		if (error) {
			setSupabaseError(error);
			return false;
		}

		if (data.session) {
			authSession.set(data.session);
			return true;
		}

		authNotice.set('Account created. Check your email for the confirmation link.');
		return false;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const signInWithEmail = async (input: { email: string; password: string }) => {
	clearAuthFeedback();

	const email = input.email.trim();
	if (!email || !input.password) {
		authError.set('Enter your email and password to log in.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password: input.password
		});

		if (error) {
			setSupabaseError(error);
			return false;
		}

		authSession.set(data.session);
		return true;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const signOut = async () => {
	clearAuthFeedback();
	authPendingFlow.set('signout');

	try {
		const supabase = getSupabaseBrowserClient();
		const { error } = await supabase.auth.signOut();

		if (error) {
			setSupabaseError(error);
			return false;
		}

		authSession.set(null);
		return true;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const getAuthUserLabel = () => {
	const session = get(authSession);
	return session?.user?.email ?? session?.user?.phone ?? 'Account';
};
