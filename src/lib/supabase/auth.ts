import { browser } from '$app/environment';
import type { Session } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import {
	mapValidatedProfile,
	validateSignupProfile,
	type SignupProfileInput,
	type UserProfile,
	type ValidatedSignupProfile
} from '$lib/supabase/profile';

export type { SignupProfileInput, UserProfile } from '$lib/supabase/profile';

export type PendingAuthFlow = 'signup' | 'login' | 'signout' | null;

type PendingSignupProfile = ValidatedSignupProfile & {
	userId: string | null;
	savedAt: string;
};

type AuthSnapshotResponse = {
	configured: boolean;
	session: Session | null;
	profile: UserProfile | null;
	error?: string;
};

type AuthMutationResponse = {
	session?: Session | null;
	profile?: UserProfile | null;
	userId?: string | null;
	error?: string;
};

type RequestResult<T> = {
	data: T | null;
	error: string | null;
};

export const authSession = writable<Session | null>(null);
export const authPendingFlow = writable<PendingAuthFlow>(null);
export const authError = writable<string | null>(null);
export const authNotice = writable<string | null>(null);
export const authPendingProfileSetup = writable(false);
export const authProfile = writable<UserProfile | null>(null);
export const authProfileLoading = writable(false);
export const authProfilePending = writable(false);

let initialized = false;
let refreshTimer: number | undefined;
const PENDING_SIGNUP_PROFILE_STORAGE_KEY = 'tooch-town.pending-signup-profile';

const setPendingProfileFlag = (hasPendingProfile: boolean) => {
	authPendingProfileSetup.set(hasPendingProfile);
};

const profilesMatch = (left: UserProfile | null, right: UserProfile) =>
	Boolean(
		left &&
		left.username === right.username &&
		left.firstName === right.firstName &&
		left.lastName === right.lastName &&
		left.country === right.country &&
		left.state === right.state &&
		left.city === right.city
	);

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

const setAuthSnapshot = (snapshot: { session?: Session | null; profile?: UserProfile | null }) => {
	authSession.set(snapshot.session ?? null);
	authProfile.set(snapshot.profile ?? null);
	scheduleSessionRefresh(snapshot.session ?? null);
};

const setProfilePersistenceError = (error: string | null) => {
	authError.set(
		error ?? 'Your account was created, but we could not finish saving your profile yet.'
	);
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

const requestJson = async <T>(
	url: string,
	options: RequestInit,
	fallback: string
): Promise<RequestResult<T>> => {
	try {
		const headers = new Headers(options.headers);
		if (options.body && !headers.has('content-type')) {
			headers.set('content-type', 'application/json');
		}

		const response = await fetch(url, {
			...options,
			headers
		});
		const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

		if (!response.ok) {
			return {
				data: null,
				error: body?.error ?? fallback
			};
		}

		return {
			data: body as T,
			error: null
		};
	} catch (error) {
		return {
			data: null,
			error: error instanceof Error ? error.message : fallback
		};
	}
};

const clearAuthUrlArtifacts = (mode: 'hash' | 'query') => {
	if (!browser) return;

	const nextUrl = new URL(window.location.href);

	if (mode === 'hash') {
		nextUrl.hash = '';
	} else {
		nextUrl.searchParams.delete('code');
		nextUrl.searchParams.delete('type');
		nextUrl.searchParams.delete('error');
		nextUrl.searchParams.delete('error_code');
		nextUrl.searchParams.delete('error_description');
	}

	window.history.replaceState({}, '', nextUrl);
};

const syncSessionFromUrl = async () => {
	if (!browser) return true;

	const currentUrl = new URL(window.location.href);
	const code = currentUrl.searchParams.get('code');

	if (code) {
		const result = await requestJson<AuthSnapshotResponse>(
			'/api/auth/session/exchange',
			{
				method: 'POST',
				body: JSON.stringify({ code })
			},
			'Unable to finish signing you in.'
		);

		clearAuthUrlArtifacts('query');

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		if (result.data) {
			setAuthSnapshot(result.data);
		}

		return true;
	}

	const hash = window.location.hash.startsWith('#')
		? window.location.hash.slice(1)
		: window.location.hash;
	const hashParams = new URLSearchParams(hash);
	const accessToken = hashParams.get('access_token');
	const refreshToken = hashParams.get('refresh_token');

	if (accessToken && refreshToken) {
		const result = await requestJson<AuthSnapshotResponse>(
			'/api/auth/session/exchange',
			{
				method: 'POST',
				body: JSON.stringify({ accessToken, refreshToken })
			},
			'Unable to finish signing you in.'
		);

		clearAuthUrlArtifacts('hash');

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		if (result.data) {
			setAuthSnapshot(result.data);
		}
	}

	return true;
};

const loadCurrentAuthSnapshot = async () => {
	const result = await requestJson<AuthSnapshotResponse>(
		'/api/auth/session',
		{ method: 'GET' },
		'Unable to load your account right now.'
	);

	if (result.error) {
		setSupabaseError(result.error);
		setAuthSnapshot({ session: null, profile: null });
		return null;
	}

	if (!result.data) {
		setAuthSnapshot({ session: null, profile: null });
		return null;
	}

	if (!result.data.configured) {
		setAuthSnapshot({ session: null, profile: null });
		return result.data;
	}

	setAuthSnapshot(result.data);
	return result.data;
};

const syncPendingSignupProfile = async (session: Session | null) => {
	if (!browser) return false;

	const pendingProfile = readPendingSignupProfile();
	setPendingProfileFlag(Boolean(pendingProfile));

	if (!pendingProfile || !session?.user) return false;
	if (pendingProfile.userId && pendingProfile.userId !== session.user.id) return false;

	const synced = await saveProfileForCurrentUser(pendingProfile);
	if (synced) {
		authNotice.set('Profile setup complete.');
	}

	return synced;
};

const scheduleSessionRefresh = (session: Session | null) => {
	if (!browser) return;
	if (refreshTimer) window.clearTimeout(refreshTimer);

	if (!session?.expires_at) return;

	const refreshAtMs = session.expires_at * 1000 - 60_000;
	const delayMs = Math.max(refreshAtMs - Date.now(), 30_000);

	refreshTimer = window.setTimeout(() => {
		void hydrateAuthState({ syncPendingProfile: false });
	}, delayMs);
};

const hydrateAuthState = async (
	options: {
		syncPendingProfile?: boolean;
	} = {}
) => {
	authProfileLoading.set(true);

	try {
		const callbackSynced = await syncSessionFromUrl();
		if (!callbackSynced) return false;

		const snapshot = await loadCurrentAuthSnapshot();
		if (!snapshot) return false;

		if (options.syncPendingProfile !== false) {
			await syncPendingSignupProfile(snapshot.session);
		}

		return true;
	} finally {
		authProfileLoading.set(false);
	}
};

const saveProfileForCurrentUser = async (
	profile: ValidatedSignupProfile,
	options: { rememberOnFailure?: boolean } = {}
) => {
	const result = await requestJson<AuthMutationResponse>(
		'/api/auth/profile',
		{
			method: 'POST',
			body: JSON.stringify({
				profile: {
					username: profile.username,
					firstName: profile.firstName,
					lastName: profile.lastName,
					country: profile.country,
					state: profile.state,
					city: profile.city
				}
			})
		},
		'Your account was created, but we could not finish saving your profile yet.'
	);

	if (result.error || !result.data) {
		if (options.rememberOnFailure) {
			rememberPendingSignupProfile(profile, { userId: get(authSession)?.user?.id ?? null });
		}
		setProfilePersistenceError(result.error);
		return false;
	}

	authSession.set(result.data.session ?? get(authSession));
	authProfile.set(result.data.profile ?? mapValidatedProfile(profile));
	writePendingSignupProfile(null);
	return true;
};

export const initializeSupabaseAuth = () => {
	if (!browser || initialized) return;

	initialized = true;
	setPendingProfileFlag(Boolean(readPendingSignupProfile()));

	void hydrateAuthState();

	window.addEventListener('focus', () => {
		void hydrateAuthState({ syncPendingProfile: false });
	});
};

export const clearAuthFeedback = () => {
	authError.set(null);
	authNotice.set(null);
};

export const requestEmailSignUpOtp = async (input: {
	email: string;
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const email = input.email.trim();
	const validation = validateSignupProfile(input.profile);

	if (!email) {
		authError.set('Enter an email address to create an account.');
		return false;
	}

	if (!validation.profile) {
		authError.set(validation.error);
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const result = await requestJson<{ ok: true }>(
			'/api/auth/email/signup',
			{
				method: 'POST',
				body: JSON.stringify({ email })
			},
			'Unable to send a verification code right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		authNotice.set(
			'Verification code sent. Enter the code from your email to create your account.'
		);
		return true;
	} finally {
		authPendingFlow.set(null);
	}
};

export const verifyEmailSignUpOtp = async (input: {
	email: string;
	token: string;
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const email = input.email.trim();
	const token = input.token.trim();
	const validation = validateSignupProfile(input.profile);

	if (!email) {
		authError.set('Enter the email address you used to sign up.');
		return false;
	}

	if (!token) {
		authError.set('Enter the verification code from your email.');
		return false;
	}

	if (!validation.profile) {
		authError.set(validation.error);
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/email/signup/verify',
			{
				method: 'POST',
				body: JSON.stringify({ email, token })
			},
			'Unable to verify your code right now.'
		);

		if (result.error || !result.data?.session) {
			setSupabaseError(
				result.error ?? 'Your email was verified, but we could not finish your account setup.'
			);
			return false;
		}

		authSession.set(result.data.session);
		const profileSaved = await saveProfileForCurrentUser(validation.profile, {
			rememberOnFailure: true
		});

		if (!profileSaved) return false;

		authNotice.set('Email confirmed. Your account is ready.');
		return true;
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
	const validation = validateSignupProfile(input.profile);

	if (!phone) {
		authError.set('Enter a phone number to create an account.');
		return false;
	}

	if (!validation.profile) {
		authError.set(validation.error);
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const result = await requestJson<{ ok: true }>(
			'/api/auth/phone/signup/request',
			{
				method: 'POST',
				body: JSON.stringify({ phone })
			},
			'Unable to send a verification code right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		rememberPendingSignupProfile(validation.profile);
		authNotice.set('Verification code sent. Enter the SMS code to finish creating your account.');
		return true;
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
	const validation = validateSignupProfile(input.profile);

	if (!phone) {
		authError.set('Enter the phone number you used to sign up.');
		return false;
	}

	if (!token) {
		authError.set('Enter the verification code from your text message.');
		return false;
	}

	if (!validation.profile) {
		authError.set(validation.error);
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/phone/signup/verify',
			{
				method: 'POST',
				body: JSON.stringify({ phone, token })
			},
			'Unable to verify your code right now.'
		);

		if (result.error || !result.data?.session) {
			setSupabaseError(
				result.error ?? 'Your phone was verified, but we could not finish your account setup.'
			);
			return false;
		}

		authSession.set(result.data.session);
		const profileSaved = await saveProfileForCurrentUser(validation.profile, {
			rememberOnFailure: true
		});

		if (!profileSaved) return false;

		authNotice.set('Phone number confirmed. Your account is ready.');
		return true;
	} finally {
		authPendingFlow.set(null);
	}
};

export const requestEmailLoginOtp = async (input: { email: string }) => {
	clearAuthFeedback();

	const email = input.email.trim();
	if (!email) {
		authError.set('Enter your email address to log in.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/email/login',
			{
				method: 'POST',
				body: JSON.stringify({ email })
			},
			'Unable to send a verification code right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		authNotice.set('Verification code sent. Enter the code from your email to log in.');
		return true;
	} finally {
		authPendingFlow.set(null);
	}
};

export const verifyEmailLoginOtp = async (input: { email: string; token: string }) => {
	clearAuthFeedback();

	const email = input.email.trim();
	const token = input.token.trim();

	if (!email) {
		authError.set('Enter the email address you used to log in.');
		return false;
	}

	if (!token) {
		authError.set('Enter the verification code from your email.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/email/login/verify',
			{
				method: 'POST',
				body: JSON.stringify({ email, token })
			},
			'Unable to verify your code right now.'
		);

		if (result.error || !result.data?.session) {
			setSupabaseError(result.error ?? 'Unable to sign you in right now.');
			return false;
		}

		authSession.set(result.data.session);
		await hydrateAuthState();
		return true;
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
		const result = await requestJson<{ ok: true }>(
			'/api/auth/phone/login/request',
			{
				method: 'POST',
				body: JSON.stringify({ phone })
			},
			'Unable to send a verification code right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		authNotice.set('Verification code sent. Enter the SMS code to log in.');
		return true;
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
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/phone/login/verify',
			{
				method: 'POST',
				body: JSON.stringify({ phone, token })
			},
			'Unable to verify your code right now.'
		);

		if (result.error || !result.data?.session) {
			setSupabaseError(result.error ?? 'Unable to sign you in right now.');
			return false;
		}

		authSession.set(result.data.session);
		await hydrateAuthState();
		return true;
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

	const retried = await saveProfileForCurrentUser(pendingProfile, {
		rememberOnFailure: true
	});
	if (retried) {
		authNotice.set('Profile setup complete.');
	}

	return retried;
};

export const signOut = async () => {
	clearAuthFeedback();
	authPendingFlow.set('signout');

	try {
		const result = await requestJson<{ ok: true }>(
			'/api/auth/signout',
			{
				method: 'POST'
			},
			'Unable to sign you out right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			return false;
		}

		setAuthSnapshot({ session: null, profile: null });
		return true;
	} finally {
		authPendingFlow.set(null);
	}
};

export const getAuthUserLabel = () => {
	const session = get(authSession);
	return session?.user?.email ?? session?.user?.phone ?? 'Account';
};

export const updateCurrentUserProfile = async (input: UserProfile) => {
	clearAuthFeedback();

	const session = get(authSession);
	const currentProfile = get(authProfile);

	if (!session?.user) {
		authError.set('Sign in before updating your profile.');
		return false;
	}

	const validation = validateSignupProfile(input);
	if (!validation.profile) {
		authError.set(validation.error);
		return false;
	}

	const nextProfile = mapValidatedProfile(validation.profile);
	if (profilesMatch(currentProfile, nextProfile)) {
		return true;
	}

	authProfilePending.set(true);

	try {
		const saved = await saveProfileForCurrentUser(validation.profile);
		if (!saved) return false;

		authNotice.set('Profile saved.');
		return true;
	} finally {
		authProfilePending.set(false);
	}
};
