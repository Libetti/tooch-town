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

type AuthSnapshotResponse = {
	configured: boolean;
	session: Session | null;
	error?: string;
};

type AuthMutationResponse = {
	session?: Session | null;
	profile?: UserProfile | null;
	error?: string;
};

type ProfileResponse = {
	session?: Session | null;
	profile: UserProfile | null;
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
export const authProfile = writable<UserProfile | null>(null);
export const authProfileLoading = writable(false);
export const authProfilePending = writable(false);

let initialized = false;
let refreshTimer: number | undefined;
let authNoticeClearTimer: number | undefined;
const TEMPORARY_AUTH_NOTICE_DURATION_MS = 2500;

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

const normalizePhone = (value: string) => value.trim().replace(/[\s()-]/g, '');

const setAuthSnapshot = (snapshot: { session?: Session | null }) => {
	const previousSession = get(authSession);
	const nextSession = snapshot.session ?? null;
	authSession.set(snapshot.session ?? null);
	if (!nextSession || previousSession?.user?.id !== nextSession.user?.id) {
		authProfile.set(null);
	}
	scheduleSessionRefresh(nextSession);
};

const setProfilePersistenceError = (error: string | null) => {
	authError.set(
		error ?? 'Your account was created, but we could not finish saving your profile yet.'
	);
};

const clearAuthNoticeTimer = () => {
	if (!authNoticeClearTimer) return;

	window.clearTimeout(authNoticeClearTimer);
	authNoticeClearTimer = undefined;
};

const setTemporaryAuthNotice = (
	message: string,
	durationMs = TEMPORARY_AUTH_NOTICE_DURATION_MS
) => {
	clearAuthNoticeTimer();
	authNotice.set(message);

	if (!browser) return;

	authNoticeClearTimer = window.setTimeout(() => {
		authNoticeClearTimer = undefined;
		if (get(authNotice) === message) {
			authNotice.set(null);
		}
	}, durationMs);
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
		setAuthSnapshot({ session: null });
		return null;
	}

	if (!result.data) {
		setAuthSnapshot({ session: null });
		return null;
	}

	if (!result.data.configured) {
		setAuthSnapshot({ session: null });
		return result.data;
	}

	setAuthSnapshot(result.data);
	return result.data;
};

const loadCurrentProfile = async () => {
	authProfileLoading.set(true);

	try {
		const result = await requestJson<ProfileResponse>(
			'/api/auth/profile',
			{ method: 'GET' },
			'Unable to load your profile right now.'
		);

		if (result.error) {
			setSupabaseError(result.error);
			authProfile.set(null);
			return null;
		}

		if (!result.data) {
			authProfile.set(null);
			return null;
		}

		if (result.data.session) {
			authSession.set(result.data.session);
			scheduleSessionRefresh(result.data.session);
		}

		authProfile.set(result.data.profile ?? null);
		return result.data.profile;
	} finally {
		authProfileLoading.set(false);
	}
};

const scheduleSessionRefresh = (session: Session | null) => {
	if (!browser) return;
	if (refreshTimer) window.clearTimeout(refreshTimer);

	if (!session?.expires_at) return;

	const refreshAtMs = session.expires_at * 1000 - 60_000;
	const delayMs = Math.max(refreshAtMs - Date.now(), 30_000);

	refreshTimer = window.setTimeout(() => {
		void hydrateAuthState({ loadProfile: false });
	}, delayMs);
};

const hydrateAuthState = async (
	options: {
		loadProfile?: boolean;
	} = {}
) => {
	const callbackSynced = await syncSessionFromUrl();
	if (!callbackSynced) return false;

	const snapshot = await loadCurrentAuthSnapshot();
	if (!snapshot) return false;

	if (options.loadProfile !== false && snapshot.session) {
		await loadCurrentProfile();
	}

	return true;
};

const applySessionAndLoadProfile = async (session: Session) => {
	authSession.set(session);
	scheduleSessionRefresh(session);
	await loadCurrentProfile();
};

const saveProfileForCurrentUser = async (profile: ValidatedSignupProfile) => {
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
		setProfilePersistenceError(result.error);
		return false;
	}

	authSession.set(result.data.session ?? get(authSession));
	scheduleSessionRefresh(result.data.session ?? get(authSession));
	authProfile.set(result.data.profile ?? mapValidatedProfile(profile));
	return true;
};

export const initializeSupabaseAuth = () => {
	if (!browser || initialized) return;

	initialized = true;

	void hydrateAuthState();

	window.addEventListener('focus', () => {
		void hydrateAuthState({ loadProfile: false });
	});
};

export const clearAuthFeedback = () => {
	clearAuthNoticeTimer();
	authError.set(null);
	authNotice.set(null);
};

export const requestEmailSignUpOtp = async (input: {
	email: string;
	password: string;
	passwordConfirm: string;
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

	if (!input.password) {
		authError.set('Enter a password for future sign in.');
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
		const result = await requestJson<{ ok: true }>(
			'/api/auth/email/signup',
			{
				method: 'POST',
				body: JSON.stringify({
					email,
					username: validation.profile.username
				})
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
	password: string;
	passwordConfirm: string;
	profile: SignupProfileInput;
}) => {
	clearAuthFeedback();

	const email = input.email.trim();
	const token = input.token.trim();
	const password = input.password;
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

	if (!password) {
		authError.set('Enter a password for future sign in.');
		return false;
	}

	if (password.length < 8) {
		authError.set('Use at least 8 characters for your password.');
		return false;
	}

	if (password !== input.passwordConfirm) {
		authError.set('Your password confirmation does not match.');
		return false;
	}

	authPendingFlow.set('signup');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/email/signup/verify',
			{
				method: 'POST',
				body: JSON.stringify({ email, token, password })
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
		const profileSaved = await saveProfileForCurrentUser(validation.profile);

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
		const profileSaved = await saveProfileForCurrentUser(validation.profile);

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
			'/api/auth/email/login/otp/request',
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

export const signInWithEmailPassword = async (input: { email: string; password: string }) => {
	clearAuthFeedback();

	const email = input.email.trim();
	if (!email || !input.password) {
		authError.set('Enter your email and password to log in.');
		return false;
	}

	authPendingFlow.set('login');

	try {
		const result = await requestJson<AuthMutationResponse>(
			'/api/auth/email/login/password',
			{
				method: 'POST',
				body: JSON.stringify({
					email,
					password: input.password
				})
			},
			'Unable to sign you in right now.'
		);

		if (result.error || !result.data?.session) {
			setSupabaseError(result.error ?? 'Unable to sign you in right now.');
			return false;
		}

		await applySessionAndLoadProfile(result.data.session);
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

		await applySessionAndLoadProfile(result.data.session);
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

		await applySessionAndLoadProfile(result.data.session);
		return true;
	} finally {
		authPendingFlow.set(null);
	}
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

		setAuthSnapshot({ session: null });
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

		setTemporaryAuthNotice('Profile saved.');
		return true;
	} finally {
		authProfilePending.set(false);
	}
};
