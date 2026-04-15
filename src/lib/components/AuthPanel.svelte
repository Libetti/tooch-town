<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import HcaptchaChallenge from '$lib/components/HcaptchaChallenge.svelte';
	import { countryOptions, getStateOptions } from '$lib/profile/locations';
	import {
		authError,
		authNotice,
		authPendingFlow,
		authProfile,
		authProfileLoading,
		authProfilePending,
		authSession,
		clearAuthFeedback,
		getAuthUserLabel,
		initializeSupabaseAuth,
		requestEmailLoginOtp,
		requestEmailSignUpOtp,
		requestPhoneLoginOtp,
		requestPhoneSignUpOtp,
		signInWithEmailPassword,
		signOut,
		type SignupProfileInput,
		updateCurrentUserProfile,
		verifyEmailLoginOtp,
		verifyEmailSignUpOtp,
		verifyPhoneLoginOtp,
		verifyPhoneSignUpOtp
	} from '$lib/supabase/auth';

	type Props = {
		hasSupabaseAuthConfig: boolean;
		expanded?: boolean;
		onClose?: () => void;
	};

	let { hasSupabaseAuthConfig, expanded = false, onClose }: Props = $props();

	let signupEmail = $state('');
	let signupPassword = $state('');
	let signupPasswordConfirm = $state('');
	let signupPhone = $state('');
	let signupOtp = $state('');
	let signupOtpSent = $state(false);
	let signupOtpResent = $state(false);
	let signupUsername = $state('');
	let signupFirstName = $state('');
	let signupLastName = $state('');
	let signupCountryCode = $state('');
	let signupStateCode = $state('');
	let signupStateText = $state('');
	let signupCity = $state('');

	let loginEmail = $state('');
	let loginPassword = $state('');
	let loginPhone = $state('');
	let loginOtp = $state('');
	let loginOtpSent = $state(false);
	let emailLoginMode = $state<'otp' | 'password'>('password');
	let authMode = $state<'signup' | 'login'>('login');
	const phoneAuthEnabled = false;
	let authMethod = $state<'phone' | 'email'>('email');
	let profileUsername = $state('');
	let profileFirstName = $state('');
	let profileLastName = $state('');
	let profileCountryCode = $state('');
	let profileStateCode = $state('');
	let profileStateText = $state('');
	let profileCity = $state('');
	let lastLoadedProfileKey = $state('');
	let verificationCaptchaToken = $state('');
	let verificationCaptchaResetKey = $state(0);
	let signupCaptchaToken = $state('');

	const hcaptchaSiteKey = env.PUBLIC_HCAPTCHA_SITE_KEY ?? '';
	const captchaMissingMessage = 'Complete the captcha before requesting a verification code.';

	const signupStates = $derived(signupCountryCode ? getStateOptions(signupCountryCode) : []);
	const selectedSignupCountry = $derived(
		countryOptions.find((country) => country.isoCode === signupCountryCode) ?? null
	);
	const selectedSignupState = $derived(
		signupStates.find((state) => state.isoCode === signupStateCode) ?? null
	);
	const profileStates = $derived(profileCountryCode ? getStateOptions(profileCountryCode) : []);
	const selectedProfileCountry = $derived(
		countryOptions.find((country) => country.isoCode === profileCountryCode) ?? null
	);
	const selectedProfileState = $derived(
		profileStates.find((state) => state.isoCode === profileStateCode) ?? null
	);
	const profileBlockingLoad = $derived($authProfileLoading && !$authProfile);

	onMount(() => {
		if (!hasSupabaseAuthConfig) return;
		initializeSupabaseAuth();
	});

	const getCountryCodeByName = (countryName: string) =>
		countryOptions.find((country) => country.name === countryName)?.isoCode ?? '';

	const getStateCodeByName = (countryCode: string, stateName: string) =>
		getStateOptions(countryCode).find((state) => state.name === stateName)?.isoCode ?? '';

	const getSignupProfile = (): SignupProfileInput => ({
		username: signupUsername,
		firstName: signupFirstName,
		lastName: signupLastName,
		country: selectedSignupCountry?.name ?? '',
		state: signupStates.length > 0 ? (selectedSignupState?.name ?? '') : signupStateText,
		city: signupCity
	});

	const getProfileFormValue = (): SignupProfileInput => ({
		username: profileUsername,
		firstName: profileFirstName,
		lastName: profileLastName,
		country: selectedProfileCountry?.name ?? '',
		state: profileStates.length > 0 ? (selectedProfileState?.name ?? '') : profileStateText,
		city: profileCity
	});

	const normalizeProfileValue = (profile: SignupProfileInput): SignupProfileInput => ({
		username: profile.username.trim(),
		firstName: profile.firstName.trim(),
		lastName: profile.lastName.trim(),
		country: profile.country.trim(),
		state: profile.state.trim(),
		city: profile.city.trim()
	});

	const profileValuesMatch = (left: SignupProfileInput | null, right: SignupProfileInput) => {
		if (!left) return false;

		const normalizedLeft = normalizeProfileValue(left);
		const normalizedRight = normalizeProfileValue(right);

		return (
			normalizedLeft.username === normalizedRight.username &&
			normalizedLeft.firstName === normalizedRight.firstName &&
			normalizedLeft.lastName === normalizedRight.lastName &&
			normalizedLeft.country === normalizedRight.country &&
			normalizedLeft.state === normalizedRight.state &&
			normalizedLeft.city === normalizedRight.city
		);
	};

	const currentProfileForm = $derived(getProfileFormValue());
	const profileHasUnsavedEdits = $derived(
		Boolean($authProfile) && !profileValuesMatch($authProfile, currentProfileForm)
	);
	const profileSaveDisabled = $derived(
		profileBlockingLoad ||
			$authProfilePending ||
			$authPendingFlow !== null ||
			(Boolean($authProfile) && !profileHasUnsavedEdits)
	);
	const signupNeedsCaptcha = $derived(authMode === 'signup' && !signupOtpSent);
	const captchaIsComplete = $derived(Boolean(verificationCaptchaToken));
	const signupSubmitDisabled = $derived(
		$authPendingFlow === 'signup' || (signupNeedsCaptcha && !captchaIsComplete)
	);
	const signupResendDisabled = $derived(
		signupOtpResent || $authPendingFlow === 'signup'
	);

	const hydrateProfileForm = () => {
		const profile = $authProfile;
		const nextProfileKey = JSON.stringify(profile ?? null);
		if (lastLoadedProfileKey === nextProfileKey) return;

		lastLoadedProfileKey = nextProfileKey;

		if (!profile) {
			profileUsername = '';
			profileFirstName = '';
			profileLastName = '';
			profileCountryCode = '';
			profileStateCode = '';
			profileStateText = '';
			profileCity = '';
			return;
		}

		const nextCountryCode = getCountryCodeByName(profile.country);
		const nextStateCode = nextCountryCode ? getStateCodeByName(nextCountryCode, profile.state) : '';

		profileUsername = profile.username;
		profileFirstName = profile.firstName;
		profileLastName = profile.lastName;
		profileCountryCode = nextCountryCode;
		profileStateCode = nextStateCode;
		profileStateText = nextStateCode ? '' : profile.state;
		profileCity = profile.city;
	};

	$effect(() => {
		hydrateProfileForm();
	});

	const clearAuthFields = () => {
		signupEmail = '';
		signupPassword = '';
		signupPasswordConfirm = '';
		signupPhone = '';
		signupOtp = '';
		signupOtpSent = false;
		signupOtpResent = false;
		signupUsername = '';
		signupFirstName = '';
		signupLastName = '';
		signupCountryCode = '';
		signupStateCode = '';
		signupStateText = '';
		signupCity = '';
		loginEmail = '';
		loginPassword = '';
		loginPhone = '';
		loginOtp = '';
		loginOtpSent = false;
		resetSignupCaptcha();
	};

	const resetVerificationCaptcha = () => {
		verificationCaptchaToken = '';
		verificationCaptchaResetKey += 1;
	};

	const resetSignupCaptcha = () => {
		signupCaptchaToken = '';
		resetVerificationCaptcha();
	};

	const getVerificationCaptchaToken = () => {
		if (!hcaptchaSiteKey) {
			authError.set('Captcha is not configured yet.');
			return null;
		}

		const token = verificationCaptchaToken.trim();
		if (!token) {
			authError.set(captchaMissingMessage);
			return null;
		}

		return token;
	};

	const closePanel = () => {
		clearAuthFeedback();
		onClose?.();
	};

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!expanded || event.key !== 'Escape') return;
		event.preventDefault();
		closePanel();
	};

	const handleSignup = async (event: SubmitEvent) => {
		event.preventDefault();
		const profile = getSignupProfile();

		if (authMethod === 'phone') {
			if (!signupOtpSent) {
				const captchaToken = getVerificationCaptchaToken();
				if (!captchaToken) return;

				signupOtpSent = await requestPhoneSignUpOtp({
					phone: signupPhone,
					profile,
					captchaToken
				});
				if (signupOtpSent) signupOtpResent = false;
				if (signupOtpSent) signupCaptchaToken = captchaToken;
				if (!signupOtpSent) signupOtp = '';
				resetVerificationCaptcha();
				return;
			}

			const signedIn = await verifyPhoneSignUpOtp({
				phone: signupPhone,
				token: signupOtp,
				profile
			});

			if (signedIn) {
				clearAuthFields();
			}

			return;
		}

		if (!signupOtpSent) {
			const captchaToken = getVerificationCaptchaToken();
			if (!captchaToken) return;

			signupOtpSent = await requestEmailSignUpOtp({
				email: signupEmail,
				password: signupPassword,
				passwordConfirm: signupPasswordConfirm,
				profile,
				captchaToken
			});
			if (signupOtpSent) signupOtpResent = false;
			if (signupOtpSent) signupCaptchaToken = captchaToken;
			if (!signupOtpSent) signupOtp = '';
			resetVerificationCaptcha();
			return;
		}

		const signedIn = await verifyEmailSignUpOtp({
			email: signupEmail,
			token: signupOtp,
			password: signupPassword,
			passwordConfirm: signupPasswordConfirm,
			profile
		});

		if (signedIn) {
			clearAuthFields();
		}
	};

	const handleSignupOtpResend = async () => {
		if (signupOtpResent || $authPendingFlow === 'signup') return;

		const profile = getSignupProfile();

		const sent =
			authMethod === 'phone'
				? await requestPhoneSignUpOtp({
						phone: signupPhone,
						profile,
						captchaToken: signupCaptchaToken,
						isResend: true
					})
				: await requestEmailSignUpOtp({
						email: signupEmail,
						password: signupPassword,
						passwordConfirm: signupPasswordConfirm,
						profile,
						captchaToken: signupCaptchaToken,
						isResend: true
					});

		if (sent) {
			signupOtp = '';
			signupOtpResent = true;
		}

	};

	const handleLogin = async (event: SubmitEvent) => {
		event.preventDefault();

		if (authMethod === 'phone') {
			if (!loginOtpSent) {
				loginOtpSent = await requestPhoneLoginOtp({
					phone: loginPhone
				});
				if (!loginOtpSent) loginOtp = '';
				return;
			}

			const signedIn = await verifyPhoneLoginOtp({
				phone: loginPhone,
				token: loginOtp
			});

			if (signedIn) {
				clearAuthFields();
			}

			return;
		}

		if (emailLoginMode === 'password') {
			const signedIn = await signInWithEmailPassword({
				email: loginEmail,
				password: loginPassword
			});

			if (signedIn) {
				clearAuthFields();
			}

			return;
		}

		if (!loginOtpSent) {
			loginOtpSent = await requestEmailLoginOtp({
				email: loginEmail
			});
			if (!loginOtpSent) loginOtp = '';
			return;
		}

		const signedIn = await verifyEmailLoginOtp({
			email: loginEmail,
			token: loginOtp
		});

		if (signedIn) {
			clearAuthFields();
		}
	};

	const handleSignOut = async () => {
		await signOut();
	};

	const handleProfileSave = async (event: SubmitEvent) => {
		event.preventDefault();
		const saved = await updateCurrentUserProfile(getProfileFormValue());
		if (saved) lastLoadedProfileKey = '';
	};

	const setAuthMode = (mode: 'signup' | 'login') => {
		authMode = mode;
		clearAuthFeedback();
		signupOtp = '';
		signupOtpSent = false;
		signupOtpResent = false;
		loginOtp = '';
		loginOtpSent = false;
		emailLoginMode = 'password';
		resetSignupCaptcha();
	};

	const setAuthMethod = (method: 'phone' | 'email') => {
		authMethod = method;
		clearAuthFeedback();
		signupOtp = '';
		signupOtpSent = false;
		signupOtpResent = false;
		loginOtp = '';
		loginOtpSent = false;
		resetSignupCaptcha();
	};

	const setEmailLoginMode = (mode: 'otp' | 'password') => {
		emailLoginMode = mode;
		clearAuthFeedback();
		loginOtp = '';
		loginOtpSent = false;
		resetVerificationCaptcha();
	};

	const handleCountryChange = (event: Event) => {
		const nextCountryCode = (event.currentTarget as HTMLSelectElement).value;
		signupCountryCode = nextCountryCode;
		signupStateCode = '';
		signupStateText = '';
	};

	const handleProfileCountryChange = (event: Event) => {
		const nextCountryCode = (event.currentTarget as HTMLSelectElement).value;
		profileCountryCode = nextCountryCode;
		profileStateCode = '';
		profileStateText = '';
	};
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class:auth-panel-root--open={expanded} class="auth-panel-root">
	{#if expanded}
		<button
			type="button"
			class="auth-panel-backdrop"
			aria-label="Close auth panel"
			onclick={closePanel}
		></button>
	{/if}
	<aside
		id="hero-auth-panel"
		class:auth-panel--open={expanded}
		class="auth-panel"
		aria-hidden={!expanded}
	>
		<div class="auth-shell">
			<div class="auth-header">
				<div>
					<p class="auth-kicker">Profile</p>
					<h2>Your little safe space.</h2>
				</div>
			</div>

			{#if !hasSupabaseAuthConfig}
				<p class="auth-empty">
					Supabase auth is not configured yet. Add the server-side Supabase URL and anon key to
					enable sign in.
				</p>
			{:else if $authSession}
				<form class="auth-card auth-card--profile" onsubmit={handleProfileSave}>
					<div class="auth-card-copy">
						<h3>Edit Profile</h3>
					</div>

					{#if profileBlockingLoad}
						<p class="auth-banner auth-banner--notice">Loading your profile...</p>
					{/if}

					<div class="auth-profile-grid">
						<label class="auth-field auth-field--readonly">
							<span>Email</span>
							<div class="auth-readonly-field">
								<input
									class="auth-input--readonly"
									type="email"
									value={$authSession.user.email ?? ''}
									name="profile-email"
									autocomplete="email"
									readonly
									tabindex="-1"
								/>
								<span class="auth-readonly-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" class="auth-lock-icon">
										<path
											d="M7.5 10V8.5a4.5 4.5 0 1 1 9 0V10"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
										/>
										<rect
											x="5"
											y="10"
											width="14"
											height="10"
											rx="2.5"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
										/>
									</svg>
								</span>
							</div>
						</label>

						<label class:auth-field--readonly={Boolean($authProfile)} class="auth-field">
							<span>Username</span>
							<div class="auth-readonly-field">
								<input
									class:auth-input--readonly={Boolean($authProfile)}
									type="text"
									bind:value={profileUsername}
									name="profile-username"
									autocomplete="username"
									placeholder="stormwatcher"
									readonly={Boolean($authProfile)}
									tabindex={Boolean($authProfile) ? -1 : 0}
								/>
								{#if $authProfile}
									<span class="auth-readonly-icon" aria-hidden="true">
										<svg viewBox="0 0 24 24" class="auth-lock-icon">
											<path
												d="M7.5 10V8.5a4.5 4.5 0 1 1 9 0V10"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linecap="round"
											/>
											<rect
												x="5"
												y="10"
												width="14"
												height="10"
												rx="2.5"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
											/>
										</svg>
									</span>
								{/if}
							</div>
						</label>

						<div class="auth-field-pair">
							<label class="auth-field">
								<span>First Name</span>
								<input
									bind:value={profileFirstName}
									type="text"
									name="profile-first-name"
									autocomplete="given-name"
								/>
							</label>

							<label class="auth-field">
								<span>Last Name</span>
								<input
									bind:value={profileLastName}
									type="text"
									name="profile-last-name"
									autocomplete="family-name"
								/>
							</label>
						</div>

						<label class="auth-field">
							<span>Country</span>
							<select
								bind:value={profileCountryCode}
								name="profile-country"
								onchange={handleProfileCountryChange}
							>
								<option value="">Select a country</option>
								{#each countryOptions as country (country.isoCode)}
									<option value={country.isoCode}>{country.name}</option>
								{/each}
							</select>
						</label>

						{#if profileCountryCode}
							{#if profileStates.length > 0}
								<label class="auth-field">
									<span>State / Province</span>
									<select bind:value={profileStateCode} name="profile-state">
										<option value="">Select a state or province</option>
										{#each profileStates as state (state.isoCode)}
											<option value={state.isoCode}>{state.name}</option>
										{/each}
									</select>
								</label>
							{:else}
								<label class="auth-field">
									<span>State / Province</span>
									<input
										bind:value={profileStateText}
										type="text"
										name="profile-state-text"
										autocomplete="address-level1"
									/>
								</label>
							{/if}
						{/if}

						<label class="auth-field">
							<span>City</span>
							<input
								bind:value={profileCity}
								type="text"
								name="profile-city"
								autocomplete="address-level2"
							/>
						</label>

						<p
							class:auth-profile-edit-subtext--hidden={!profileHasUnsavedEdits}
							class="auth-profile-edit-subtext"
							aria-live="polite"
						>
							{profileHasUnsavedEdits ? 'You have unsaved profile edits.' : ''}
						</p>
					</div>

					<div class="auth-account-actions auth-account-actions--footer">
						{#if $authNotice}
							<p class="auth-inline-notice" role="status">{$authNotice}</p>
						{/if}

						<button
							type="submit"
							class="auth-submit auth-submit--soft auth-submit--profile"
							disabled={profileSaveDisabled}
						>
							{$authProfilePending ? 'Saving...' : 'Save Profile'}
						</button>
					</div>

					{#if $authError}
						<p class="auth-banner auth-banner--error" role="alert">{$authError}</p>
					{/if}
				</form>
				<div class="auth-sidebar-action">
					<button
						type="button"
						class="auth-logout-button"
						aria-label={$authPendingFlow === 'signout' ? 'Signing out' : 'Sign out'}
						title={$authPendingFlow === 'signout' ? 'Signing out' : 'Sign out'}
						disabled={$authPendingFlow === 'signout' || $authProfilePending}
						onclick={handleSignOut}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-logout-icon">
							<path
								d="M10 6H7.75A1.75 1.75 0 0 0 6 7.75v8.5C6 17.216 6.784 18 7.75 18H10"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M13 8.5 17 12l-4 3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M11 12h6"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
							/>
						</svg>
					</button>
				</div>
			{:else}
				<div class="auth-mode-toggle" role="tablist" aria-label="Auth flow">
					<button
						type="button"
						class:auth-mode-button--active={authMode === 'login'}
						class="auth-mode-button"
						role="tab"
						aria-selected={authMode === 'login'}
						onclick={() => setAuthMode('login')}
					>
						You're back
					</button>
					<button
						type="button"
						class:auth-mode-button--active={authMode === 'signup'}
						class="auth-mode-button"
						role="tab"
						aria-selected={authMode === 'signup'}
						onclick={() => setAuthMode('signup')}
					>
						Join Us
					</button>
				</div>

				<div class="auth-grid">
					{#if authMode === 'signup'}
						<form class="auth-card auth-card--signup" onsubmit={handleSignup}>
							<div class="auth-card-copy">
								<h3>
									{authMethod === 'phone'
										? 'Create Account With Phone'
										: 'Create Account With Email'}
								</h3>
							</div>

							{#if !signupOtpSent}
								<div class="auth-method-toggle" role="tablist" aria-label="Auth method">
									{#if phoneAuthEnabled}
										<button
											type="button"
											class:auth-mode-button--active={authMethod === 'phone'}
											class="auth-mode-button auth-method-icon-button"
											role="tab"
											aria-selected={authMethod === 'phone'}
											aria-label="Use phone"
											title="Phone"
											onclick={() => setAuthMethod('phone')}
										>
											<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-method-icon">
												<path
													d="M7.2 3.6h2.1c.4 0 .8.3.9.7l.6 2.7c.1.3 0 .7-.2 1l-1.2 1.5a15 15 0 0 0 5.5 5.5l1.5-1.2c.3-.2.7-.3 1-.2l2.7.6c.4.1.7.5.7.9v2.1c0 .6-.4 1-.9 1.1-.7.1-1.4.2-2.1.2A16.8 16.8 0 0 1 5.9 6.6c0-.7.1-1.4.2-2.1.1-.5.5-.9 1.1-.9Z"
													fill="none"
													stroke="currentColor"
													stroke-width="1.8"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										</button>
									{/if}
									<button
										type="button"
										class:auth-mode-button--active={authMethod === 'email'}
										class="auth-mode-button auth-method-icon-button"
										role="tab"
										aria-selected={authMethod === 'email'}
										aria-label="Use email"
										title="Email"
										onclick={() => setAuthMethod('email')}
									>
										<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-method-icon">
											<path
												d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linejoin="round"
											/>
											<path
												d="m4 8 8 5 8-5"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
								</div>
							{/if}

							{#if signupOtpSent}
								<label class="auth-field auth-field--verification">
									<span>Verification Code</span>
									<input
										bind:value={signupOtp}
										inputmode="numeric"
										name={authMethod === 'phone' ? 'signup-otp' : 'signup-email-otp'}
										autocomplete="one-time-code"
									/>
								</label>
							{:else}
								{#if authMethod === 'phone'}
									<label class="auth-field">
										<span>Phone</span>
										<input
											bind:value={signupPhone}
											type="tel"
											name="signup-phone"
											autocomplete="tel"
											placeholder="+15551234567"
										/>
									</label>
								{:else}
									<label class="auth-field">
										<span>Email</span>
										<input
											bind:value={signupEmail}
											type="email"
											name="signup-email"
											autocomplete="email"
										/>
									</label>

									<label class="auth-field">
										<span>Password</span>
										<input
											bind:value={signupPassword}
											type="password"
											name="signup-password"
											minlength="8"
											autocomplete="new-password"
										/>
									</label>

									<label class="auth-field">
										<span>Confirm Password</span>
										<input
											bind:value={signupPasswordConfirm}
											type="password"
											name="signup-password-confirm"
											minlength="8"
											autocomplete="new-password"
										/>
									</label>
								{/if}

								<div class="auth-profile-grid">
									<label class="auth-field">
										<span>Username</span>
										<input
											bind:value={signupUsername}
											type="text"
											name="signup-username"
											autocomplete="username"
											placeholder="stormwatcher"
										/>
									</label>

									<div class="auth-field-pair">
										<label class="auth-field">
											<span>First Name</span>
											<input
												bind:value={signupFirstName}
												type="text"
												name="signup-first-name"
												autocomplete="given-name"
											/>
										</label>

										<label class="auth-field">
											<span>Last Name</span>
											<input
												bind:value={signupLastName}
												type="text"
												name="signup-last-name"
												autocomplete="family-name"
											/>
										</label>
									</div>

									<label class="auth-field">
										<span>Country</span>
										<select
											bind:value={signupCountryCode}
											name="signup-country"
											onchange={handleCountryChange}
										>
											<option value="">Select a country</option>
											{#each countryOptions as country (country.isoCode)}
												<option value={country.isoCode}>{country.name}</option>
											{/each}
										</select>
									</label>

									{#if signupCountryCode}
										{#if signupStates.length > 0}
											<label class="auth-field">
												<span>State / Province</span>
												<select bind:value={signupStateCode} name="signup-state">
													<option value="">Select a state or province</option>
													{#each signupStates as state (state.isoCode)}
														<option value={state.isoCode}>{state.name}</option>
													{/each}
												</select>
											</label>
										{:else}
											<label class="auth-field">
												<span>State / Province</span>
												<input
													bind:value={signupStateText}
													type="text"
													name="signup-state-text"
													autocomplete="address-level1"
												/>
											</label>
										{/if}
									{/if}

									<label class="auth-field">
										<span>City</span>
										<input
											bind:value={signupCity}
											type="text"
											name="signup-city"
											autocomplete="address-level2"
										/>
									</label>
								</div>
							{/if}

							{#if signupNeedsCaptcha}
								<div class="auth-captcha">
									{#key verificationCaptchaResetKey}
										<HcaptchaChallenge
											sitekey={hcaptchaSiteKey}
											bind:token={verificationCaptchaToken}
										/>
									{/key}
								</div>
							{/if}

							{#if signupOtpSent && $authNotice}
								<p class="auth-verification-feedback" role="status">{$authNotice}</p>
							{/if}

							{#if signupOtpSent}
								<div class="auth-verification-actions">
									<button
										type="button"
										class="auth-text-button"
										disabled={signupResendDisabled}
										onclick={handleSignupOtpResend}
									>
										{signupOtpResent ? 'Confirmation Code Resent' : 'Resend Confirmation Code'}
									</button>
								</div>
							{/if}

							<button type="submit" class="auth-submit" disabled={signupSubmitDisabled}>
								{#if $authPendingFlow === 'signup'}
									{signupOtpSent ? 'Verifying...' : 'Sending Code...'}
								{:else}
									{authMethod === 'phone'
										? signupOtpSent
											? 'Verify And Create Account'
											: 'Send Verification Code'
										: signupOtpSent
											? 'Verify And Create Account'
											: 'Send Verification Code'}
								{/if}
							</button>

							{#if $authError}
								<p class="auth-banner auth-banner--error" role="alert">{$authError}</p>
							{/if}

							{#if !signupOtpSent && $authNotice}
								<p class="auth-banner auth-banner--notice">{$authNotice}</p>
							{/if}
						</form>
					{:else}
						<form class="auth-card auth-card--login" onsubmit={handleLogin}>
							<div class="auth-card-copy">
								<h3>{authMethod === 'phone' ? 'Log In With Phone' : 'Log In With Email'}</h3>
							</div>

							<div class="auth-method-toggle" role="tablist" aria-label="Auth method">
								{#if phoneAuthEnabled}
									<button
										type="button"
										class:auth-mode-button--active={authMethod === 'phone'}
										class="auth-mode-button auth-method-icon-button"
										role="tab"
										aria-selected={authMethod === 'phone'}
										aria-label="Use phone"
										title="Phone"
										onclick={() => setAuthMethod('phone')}
									>
										<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-method-icon">
											<path
												d="M7.2 3.6h2.1c.4 0 .8.3.9.7l.6 2.7c.1.3 0 .7-.2 1l-1.2 1.5a15 15 0 0 0 5.5 5.5l1.5-1.2c.3-.2.7-.3 1-.2l2.7.6c.4.1.7.5.7.9v2.1c0 .6-.4 1-.9 1.1-.7.1-1.4.2-2.1.2A16.8 16.8 0 0 1 5.9 6.6c0-.7.1-1.4.2-2.1.1-.5.5-.9 1.1-.9Z"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
								{/if}
								<button
									type="button"
									class:auth-mode-button--active={authMethod === 'email'}
									class="auth-mode-button auth-method-icon-button"
									role="tab"
									aria-selected={authMethod === 'email'}
									aria-label="Use email"
									title="Email"
									onclick={() => setAuthMethod('email')}
								>
									<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-method-icon">
										<path
											d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linejoin="round"
										/>
										<path
											d="m4 8 8 5 8-5"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</button>
							</div>

							{#if authMethod === 'phone'}
								<label class="auth-field">
									<span>Phone</span>
									<input
										bind:value={loginPhone}
										type="tel"
										name="login-phone"
										autocomplete="tel"
										placeholder="+15551234567"
									/>
								</label>

								{#if loginOtpSent}
									<label class="auth-field">
										<span>Verification Code</span>
										<input
											bind:value={loginOtp}
											inputmode="numeric"
											name="login-otp"
											autocomplete="one-time-code"
										/>
									</label>
								{/if}
							{:else}
								<label class="auth-field">
									<span>Email</span>
									<input
										bind:value={loginEmail}
										type="email"
										name="login-email"
										autocomplete="email"
										readonly={emailLoginMode === 'otp' && loginOtpSent}
									/>
								</label>

								{#if emailLoginMode === 'password'}
									<label class="auth-field">
										<span>Password</span>
										<input
											bind:value={loginPassword}
											type="password"
											name="login-password"
											autocomplete="current-password"
										/>
									</label>
								{:else if loginOtpSent}
									<label class="auth-field">
										<span>Verification Code</span>
										<input
											bind:value={loginOtp}
											inputmode="numeric"
											name="login-email-otp"
											autocomplete="one-time-code"
										/>
									</label>
								{/if}

								<div class="auth-inline-actions">
									{#if emailLoginMode === 'otp'}
										<button
											type="button"
											class="auth-text-button"
											onclick={() => setEmailLoginMode('password')}
										>
											Use Password
										</button>
									{:else}
										<button
											type="button"
											class="auth-text-button"
											onclick={() => setEmailLoginMode('otp')}
										>
											Email A Code
										</button>
									{/if}
								</div>
							{/if}

							<button
								type="submit"
								class="auth-submit auth-submit--secondary"
								disabled={$authPendingFlow === 'login'}
							>
								{#if $authPendingFlow === 'login'}
									{emailLoginMode === 'password'
										? 'Logging In...'
										: loginOtpSent
											? 'Verifying...'
											: 'Sending Code...'}
								{:else}
									{authMethod === 'phone'
										? loginOtpSent
											? 'Verify And Log In'
											: 'Text Me A Code'
										: emailLoginMode === 'password'
											? 'Log In'
											: loginOtpSent
												? 'Verify And Log In'
												: 'Email A Code'}
								{/if}
							</button>

							{#if $authError}
								<p class="auth-banner auth-banner--error" role="alert">{$authError}</p>
							{/if}

							{#if $authNotice}
								<p class="auth-banner auth-banner--notice">{$authNotice}</p>
							{/if}
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</aside>
</div>

<style>
	.auth-panel-root {
		position: fixed;
		inset: 0;
		z-index: 5;
		display: flex;
		justify-content: flex-end;
		pointer-events: none;
	}

	.auth-panel-root--open {
		pointer-events: auto;
	}

	.auth-panel-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: transparent;
		pointer-events: auto;
		animation: auth-panel-fade 180ms ease-out;
	}

	.auth-panel {
		--line: rgba(166, 198, 255, 0.28);
		--panel: rgba(7, 16, 29, 0.95);
		position: relative;
		height: 100%;
		width: min(30rem, 92vw);
		margin-left: auto;
		padding: 5.25rem 1rem 1rem;
		background: var(--panel);
		border-left: 1px solid var(--line);
		backdrop-filter: blur(12px);
		box-shadow: -12px 0 30px rgba(1, 6, 16, 0.35);
		overflow: auto;
		pointer-events: none;
		opacity: 0;
		transform: translateX(100%);
		transition:
			transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
			opacity 220ms ease;
	}

	.auth-panel--open {
		pointer-events: auto;
		opacity: 1;
		transform: translateX(0);
	}

	.auth-shell {
		min-height: 100%;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.auth-header {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
		gap: 1.25rem;
		align-items: end;
	}

	.auth-header h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.35rem, 2.4vw, 1.9rem);
		line-height: 1.1;
		color: #f5f8ff;
	}

	.auth-banner,
	.auth-empty {
		margin: 1rem 0 0;
		padding: 0.85rem 0.95rem;
		border-radius: 0.95rem;
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.auth-banner--error {
		background: rgba(98, 18, 18, 0.35);
		border: 1px solid rgba(255, 125, 125, 0.28);
		color: #ffd6d6;
	}

	.auth-banner--notice,
	.auth-empty {
		background: rgba(14, 43, 25, 0.72);
		border: 1px solid rgba(111, 214, 146, 0.26);
		color: rgba(219, 255, 228, 0.92);
	}

	.auth-kicker {
		margin: 0 0 0.45rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.7rem;
		color: #ffc67f;
	}

	.auth-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}

	.auth-mode-toggle {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
		margin-top: 1rem;
		padding: 0.35rem;
		border-radius: 999px;
		background: rgba(8, 18, 33, 0.72);
		border: 1px solid rgba(166, 198, 255, 0.16);
	}

	.auth-method-toggle {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
		margin-top: 0.65rem;
		padding: 0.25rem;
		border-radius: 999px;
		background: rgba(8, 18, 33, 0.58);
		border: 1px solid rgba(166, 198, 255, 0.12);
	}

	.auth-method-icon-button {
		min-width: 2.2rem;
		padding: 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.auth-method-icon {
		width: 0.9rem;
		height: 0.9rem;
	}

	.auth-mode-button {
		border: 0;
		border-radius: 999px;
		padding: 0.62rem 0.95rem;
		background: transparent;
		color: rgba(227, 238, 255, 0.82);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease,
			box-shadow 140ms ease;
	}

	.auth-mode-button--active {
		background: #ffc67f;
		color: #112237;
		box-shadow: 0 8px 18px rgba(1, 6, 16, 0.18);
	}

	.auth-card {
		padding: 1rem;
		border-radius: 1.05rem;
		border: 1px solid rgba(166, 198, 255, 0.18);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.auth-card--signup {
		background: linear-gradient(180deg, rgba(45, 28, 10, 0.56), rgba(14, 22, 34, 0.72));
	}

	.auth-card--login,
	.auth-card--profile {
		background: linear-gradient(180deg, rgba(11, 24, 46, 0.72), rgba(14, 22, 34, 0.72));
	}

	.auth-card-copy h3 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		color: #f5f8ff;
	}

	.auth-profile-edit-subtext {
		margin: -0.2rem 0 0;
		color: #ffc67f;
		font-size: 0.86rem;
		line-height: 1.45;
		min-height: 1.25rem;
	}

	.auth-profile-edit-subtext--hidden {
		visibility: hidden;
	}

	.auth-card--profile {
		margin-top: 1rem;
		padding: 1rem;
		border-radius: 1.05rem;
		border: 1px solid rgba(166, 198, 255, 0.18);
	}

	.auth-account-actions {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.65rem;
	}

	.auth-inline-notice {
		flex: 1 1 auto;
		margin: 0;
		color: rgba(219, 255, 228, 0.92);
		font-size: 0.86rem;
		line-height: 1.4;
		text-align: right;
		white-space: nowrap;
	}

	.auth-account-actions .auth-submit {
		flex: 0 0 auto;
	}

	.auth-sidebar-action {
		margin-top: auto;
		padding: 1rem 0 0;
		display: flex;
		justify-content: flex-end;
	}

	.auth-field {
		display: grid;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: rgba(227, 238, 255, 0.88);
	}

	.auth-field--verification {
		margin-top: 0.35rem;
	}

	.auth-verification-feedback {
		margin: 0.15rem 0 0.2rem;
		color: rgba(219, 255, 228, 0.92);
		font-size: 0.86rem;
		line-height: 1.4;
	}

	.auth-verification-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: -0.25rem;
	}

	.auth-captcha {
		overflow: hidden;
		max-width: 100%;
	}

	.auth-field--readonly,
	.auth-field--readonly span,
	.auth-field--readonly .auth-readonly-field {
		cursor: not-allowed;
	}

	.auth-field input,
	.auth-field select {
		border: 1px solid rgba(166, 198, 255, 0.22);
		border-radius: 0.85rem;
		background: rgba(9, 20, 36, 0.6);
		color: #f5f8ff;
		padding: 0.7rem 0.8rem;
		font: inherit;
	}

	.auth-input--readonly {
		border-color: rgba(255, 198, 127, 0.18);
		background:
			linear-gradient(180deg, rgba(255, 198, 127, 0.08), rgba(9, 20, 36, 0.7)), rgba(9, 20, 36, 0.6);
		color: #f5f8ff;
		cursor: not-allowed;
		padding-right: 2.8rem;
		pointer-events: none;
	}

	.auth-input--readonly:focus {
		outline: none;
	}

	.auth-readonly-field {
		position: relative;
		width: 100%;
	}

	.auth-readonly-field input {
		width: 100%;
		box-sizing: border-box;
	}

	.auth-readonly-icon {
		position: absolute;
		top: 50%;
		right: 0.8rem;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 217, 168, 0.9);
		pointer-events: none;
	}

	.auth-lock-icon {
		width: 0.95rem;
		height: 0.95rem;
	}

	.auth-field select {
		appearance: none;
	}

	.auth-field input:focus,
	.auth-field select:focus {
		outline: 2px solid rgba(255, 198, 127, 0.34);
		outline-offset: 1px;
	}

	.auth-profile-grid {
		display: grid;
		gap: 0.85rem;
	}

	.auth-field-pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.auth-inline-actions {
		display: flex;
		justify-content: flex-end;
	}

	.auth-text-button {
		border: 0;
		background: transparent;
		color: rgba(255, 198, 127, 0.96);
		font: inherit;
		font-size: 0.84rem;
		font-weight: 700;
		padding: 0;
		cursor: pointer;
	}

	.auth-text-button:hover {
		color: #f5f8ff;
	}

	.auth-text-button:disabled {
		color: rgba(227, 238, 255, 0.56);
		cursor: default;
	}

	.auth-submit {
		margin-top: auto;
		border: 0;
		border-radius: 999px;
		padding: 0.72rem 1rem;
		background: #ffc67f;
		color: #112237;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}

	.auth-submit--soft {
		background: rgba(215, 230, 255, 0.14);
		border: 1px solid rgba(166, 198, 255, 0.18);
		color: #e3eeff;
		font-weight: 600;
	}

	.auth-submit--secondary {
		background: #d7e6ff;
	}

	.auth-logout-button {
		border: 1px solid rgba(166, 198, 255, 0.16);
		border-radius: 999px;
		width: 2.9rem;
		height: 2.9rem;
		padding: 0;
		background: rgba(9, 20, 36, 0.58);
		color: rgba(227, 238, 255, 0.84);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease,
			border-color 140ms ease,
			transform 140ms ease;
	}

	.auth-logout-button:hover {
		background: rgba(128, 31, 31, 0.22);
		border-color: rgba(255, 125, 125, 0.24);
		color: #ffd6d6;
		transform: translateY(-1px);
	}

	.auth-logout-button:focus-visible {
		outline: 2px solid rgba(255, 198, 127, 0.45);
		outline-offset: 2px;
	}

	.auth-logout-button:disabled {
		opacity: 0.7;
		cursor: progress;
		transform: none;
	}

	.auth-logout-icon {
		width: 1.1rem;
		height: 1.1rem;
	}

	.auth-submit:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.auth-submit--profile:disabled {
		cursor: default;
	}

	@keyframes auth-panel-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 48rem) {
		.auth-panel {
			width: min(28rem, 100vw);
			padding-top: 5rem;
		}

		.auth-header {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.auth-field-pair {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.auth-panel-backdrop {
			animation: none;
		}

		.auth-panel {
			transition: none;
		}
	}
</style>
