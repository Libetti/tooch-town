import type { ProfileInsert, ProfileRow } from '$lib/supabase/types';

export type SignupProfileInput = {
	username: string;
	firstName: string;
	lastName: string;
	country: string;
	state: string;
	city: string;
};

export type UserProfile = SignupProfileInput;

export type ValidatedSignupProfile = {
	username: string;
	usernameNormalized: string;
	firstName: string;
	lastName: string;
	country: string;
	state: string;
	city: string;
};

type PublicProfileRecord = Pick<
	ProfileRow,
	'username' | 'first_name' | 'last_name' | 'country' | 'state' | 'city'
>;

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export const mapProfileRecord = (record: PublicProfileRecord): UserProfile => ({
	username: record.username,
	firstName: record.first_name,
	lastName: record.last_name,
	country: record.country,
	state: record.state,
	city: record.city
});

export const mapValidatedProfile = (profile: ValidatedSignupProfile): UserProfile => ({
	username: profile.username,
	firstName: profile.firstName,
	lastName: profile.lastName,
	country: profile.country,
	state: profile.state,
	city: profile.city
});

export const buildProfileInsert = (
	userId: string,
	profile: ValidatedSignupProfile
): ProfileInsert => ({
	id: userId,
	username: profile.username,
	username_normalized: profile.usernameNormalized,
	first_name: profile.firstName,
	last_name: profile.lastName,
	country: profile.country,
	state: profile.state,
	city: profile.city
});

export const validateSignupProfile = (
	input: SignupProfileInput
): { profile: ValidatedSignupProfile | null; error: string | null } => {
	const username = input.username.trim();
	const usernameNormalized = normalizeUsername(input.username);
	const firstName = input.firstName.trim();
	const lastName = input.lastName.trim();
	const country = input.country.trim();
	const state = input.state.trim();
	const city = input.city.trim();

	if (!username) {
		return { profile: null, error: 'Choose a username to create your account.' };
	}

	if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
		return {
			profile: null,
			error: `Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters for your username.`
		};
	}

	if (!USERNAME_PATTERN.test(username)) {
		return {
			profile: null,
			error: 'Usernames can only use letters, numbers, and underscores.'
		};
	}

	if (!firstName) {
		return { profile: null, error: 'Enter your first name.' };
	}

	if (!lastName) {
		return { profile: null, error: 'Enter your last name.' };
	}

	if (!country) {
		return { profile: null, error: 'Choose your country.' };
	}

	if (!state) {
		return { profile: null, error: 'Choose your state or province.' };
	}

	if (!city) {
		return { profile: null, error: 'Enter your city.' };
	}

	return {
		profile: {
			username,
			usernameNormalized,
			firstName,
			lastName,
			country,
			state,
			city
		},
		error: null
	};
};
