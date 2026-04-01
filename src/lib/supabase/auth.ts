import { browser } from '$app/environment';
import type { PostgrestError, Session } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { getSupabaseBrowserClient, hasSupabaseAuthConfig } from '$lib/supabase/client';

export type PendingAuthFlow = 'signup' | 'login' | 'signout' | null;
export type SignupProfileInput = {
	username: string;
	firstName: string;
	lastName: string;
	country: string;
	state: string;
	city: string;
};

type ValidatedSignupProfile = {
	username: string;
	usernameNormalized: string;
	firstName: string;
	lastName: string;
	country: string;
	state: string;
	city: string;
};

type PendingSignupProfile = ValidatedSignupProfile & {
	userId: string | null;
	savedAt: string;
};

export const authSession = writable<Session | null>(null);
export const authPendingFlow = writable<PendingAuthFlow>(null);
export const authError = writable<string | null>(null);
export const authNotice = writable<string | null>(null);
export const authPendingProfileSetup = writable(false);

let initialized = false;
const PENDING_SIGNUP_PROFILE_STORAGE_KEY = 'tooch-town.pending-signup-profile';
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

const setPendingProfileFlag = (hasPendingProfile: boolean) => {
	authPendingProfileSetup.set(hasPendingProfile);
};

const readPendingSignupProfile = (): PendingSignupProfile | null => {
	if (!browser) return null;

	try {
		const rawValue = window.localStorage.getItem(PENDING_SIGNUP_PROFILE_STORAGE_KEY);
		if (!rawValue) return null;

		const parsedValue = JSON.parse(rawValue) as PendingSignupProfile;
		if (!parsedValue || typeof parsedValue !== 'object') return null;
		if (typeof parsedValue.username !== 'string') return null;
		return parsedValue;
	} catch {
		return null;
	}
};

const writePendingSignupProfile = (profile: PendingSignupProfile | null) => {
	if (!browser) return;

	if (!profile) {
		window.localStorage.removeItem(PENDING_SIGNUP_PROFILE_STORAGE_KEY);
		setPendingProfileFlag(false);
		return;
	}

	window.localStorage.setItem(PENDING_SIGNUP_PROFILE_STORAGE_KEY, JSON.stringify(profile));
	setPendingProfileFlag(true);
};

const rememberPendingSignupProfile = (
	profile: ValidatedSignupProfile,
	options: { userId?: string | null } = {}
) => {
	writePendingSignupProfile({
		...profile,
		userId: options.userId ?? null,
		savedAt: new Date().toISOString()
	});
};

const normalizePhone = (value: string) => value.trim().replace(/[\s()-]/g, '');
const normalizeUsername = (value: string) => value.trim().toLowerCase();

const validateSignupProfile = (input: SignupProfileInput): ValidatedSignupProfile | null => {
	const username = input.username.trim();
	const usernameNormalized = normalizeUsername(input.username);
	const firstName = input.firstName.trim();
	const lastName = input.lastName.trim();
	const country = input.country.trim();
	const state = input.state.trim();
	const city = input.city.trim();

	if (!username) {
		authError.set('Choose a username to create your account.');
		return null;
	}

	if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
		authError.set(
			`Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters for your username.`
		);
		return null;
	}

	if (!USERNAME_PATTERN.test(username)) {
		authError.set('Usernames can only use letters, numbers, and underscores.');
		return null;
	}

	if (!firstName) {
		authError.set('Enter your first name.');
		return null;
	}

	if (!lastName) {
		authError.set('Enter your last name.');
		return null;
	}

	if (!country) {
		authError.set('Choose your country.');
		return null;
	}

	if (!state) {
		authError.set('Choose your state or province.');
		return null;
	}

	if (!city) {
		authError.set('Enter your city.');
		return null;
	}

	return {
		username,
		usernameNormalized,
		firstName,
		lastName,
		country,
		state,
		city
	};
};

const setProfilePersistenceError = (error: PostgrestError | Error | unknown) => {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === '23505' &&
		'message' in error &&
		typeof error.message === 'string' &&
		error.message.includes('username_normalized')
	) {
		authError.set('That username is already taken.');
		return;
	}

	authError.set('Your account was created, but we could not finish saving your profile yet.');
};

const saveProfileForUser = async (userId: string, profile: ValidatedSignupProfile) => {
	try {
		const supabase = getSupabaseBrowserClient();
		const { error } = await supabase.from('profiles').upsert(
			{
				id: userId,
				username: profile.username,
				username_normalized: profile.usernameNormalized,
				first_name: profile.firstName,
				last_name: profile.lastName,
				country: profile.country,
				state: profile.state,
				city: profile.city
			},
			{
				onConflict: 'id'
			}
		);

		if (error) {
			rememberPendingSignupProfile(profile, { userId });
			setProfilePersistenceError(error);
			return false;
		}

		writePendingSignupProfile(null);
		return true;
	} catch (error) {
		rememberPendingSignupProfile(profile, { userId });
		setProfilePersistenceError(error);
		return false;
	}
};

const syncPendingSignupProfile = async (session: Session | null) => {
	if (!browser) return false;

	const pendingProfile = readPendingSignupProfile();
	setPendingProfileFlag(Boolean(pendingProfile));

	if (!pendingProfile || !session?.user) return false;
	if (pendingProfile.userId && pendingProfile.userId !== session.user.id) return false;

	const synced = await saveProfileForUser(session.user.id, pendingProfile);
	if (synced) {
		authNotice.set('Profile setup complete.');
	}

	return synced;
};

export const initializeSupabaseAuth = () => {
	if (!browser || initialized || !hasSupabaseAuthConfig) return;

	initialized = true;
	setPendingProfileFlag(Boolean(readPendingSignupProfile()));

	const supabase = getSupabaseBrowserClient();

	void (async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		authSession.set(session);
		void syncPendingSignupProfile(session);
	})();

	supabase.auth.onAuthStateChange((_event, session) => {
		authSession.set(session);
		void syncPendingSignupProfile(session);
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
			authError.set(
				'Unable to reach Supabase right now. Check your auth URL and network connection.'
			);
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
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const email = input.email.trim();
	const profile = validateSignupProfile(input.profile);
	if (!email) {
		authError.set('Enter an email address to create an account.');
		return false;
	}

	if (!profile) return false;

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

		if (data.session && data.user) {
			authSession.set(data.session);
			return await saveProfileForUser(data.user.id, profile);
		}

		if (data.user) {
			rememberPendingSignupProfile(profile, { userId: data.user.id });
			authNotice.set(
				'Account created. Check your email for the confirmation link. We will finish setting up your profile after you confirm.'
			);
			return true;
		}

		authNotice.set('Account created. Check your email for the confirmation link.');
		return true;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const requestPhoneSignUpOtp = async (input: {
	phone: string;
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const phone = normalizePhone(input.phone);
	const profile = validateSignupProfile(input.profile);
	if (!phone) {
		authError.set('Enter a phone number to create an account.');
		return false;
	}

	if (!profile) return false;

	authPendingFlow.set('signup');

	try {
		const supabase = getSupabaseBrowserClient();
		const { error } = await supabase.auth.signInWithOtp({
			phone,
			options: {
				shouldCreateUser: true
			}
		});

		if (error) {
			setSupabaseError(error);
			return false;
		}

		rememberPendingSignupProfile(profile);
		authNotice.set('Verification code sent. Enter the SMS code to finish creating your account.');
		return true;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const verifyPhoneSignUpOtp = async (input: {
	phone: string;
	token: string;
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const phone = normalizePhone(input.phone);
	const token = input.token.trim();
	const profile = validateSignupProfile(input.profile);

	if (!phone) {
		authError.set('Enter the phone number you used to sign up.');
		return false;
	}

	if (!token) {
		authError.set('Enter the verification code from your text message.');
		return false;
	}

	if (!profile) return false;

	authPendingFlow.set('signup');

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase.auth.verifyOtp({
			phone,
			token,
			type: 'sms'
		});

		if (error) {
			setSupabaseError(error);
			return false;
		}

		authSession.set(data.session);
		if (!data.session?.user) {
			authError.set('Your phone was verified, but we could not finish your account setup.');
			return false;
		}

		const profileSaved = await saveProfileForUser(data.session.user.id, profile);
		if (!profileSaved) return false;

		authNotice.set('Phone number confirmed. Your account is ready.');
		return true;
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

export const requestPhoneLoginOtp = async (input: { phone: string }) => {
	clearAuthFeedback();

	const phone = normalizePhone(input.phone);
	if (!phone) {
		authError.set('Enter your phone number to log in.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const supabase = getSupabaseBrowserClient();
		const { error } = await supabase.auth.signInWithOtp({
			phone,
			options: {
				shouldCreateUser: false
			}
		});

		if (error) {
			setSupabaseError(error);
			return false;
		}

		authNotice.set('Verification code sent. Enter the SMS code to log in.');
		return true;
	} catch (error) {
		setSupabaseError(error);
		return false;
	} finally {
		authPendingFlow.set(null);
	}
};

export const verifyPhoneLoginOtp = async (input: { phone: string; token: string }) => {
	clearAuthFeedback();

	const phone = normalizePhone(input.phone);
	const token = input.token.trim();

	if (!phone) {
		authError.set('Enter your phone number to log in.');
		return false;
	}

	if (!token) {
		authError.set('Enter the verification code from your text message.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase.auth.verifyOtp({
			phone,
			token,
			type: 'sms'
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

export const retryPendingProfileSetup = async () => {
	clearAuthFeedback();

	const session = get(authSession);
	if (!session) {
		authError.set('Sign in again before retrying your profile setup.');
		return false;
	}

	const pendingProfile = readPendingSignupProfile();
	if (!pendingProfile) {
		authNotice.set('Your profile is already set up.');
		setPendingProfileFlag(false);
		return true;
	}

	if (pendingProfile.userId && pendingProfile.userId !== session.user.id) {
		authError.set('The saved profile draft belongs to a different account.');
		return false;
	}

	const retried = await saveProfileForUser(session.user.id, pendingProfile);
	if (retried) {
		authNotice.set('Profile setup complete.');
	}

	return retried;
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
