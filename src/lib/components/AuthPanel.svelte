<script lang="ts">
	import { onMount } from 'svelte';
	import { hasSupabaseAuthConfig } from '$lib/supabase/client';
	import {
		authError,
		authNotice,
		authPendingFlow,
		authSession,
		clearAuthFeedback,
		getAuthUserLabel,
		initializeSupabaseAuth,
		signInWithEmail,
		signOut,
		signUpWithEmail
	} from '$lib/supabase/auth';

	type Props = {
		expanded?: boolean;
		onClose?: () => void;
	};

	let { expanded = false, onClose }: Props = $props();

	let signupEmail = $state('');
	let signupPassword = $state('');
	let signupPasswordConfirm = $state('');
	let signupPasswordVisible = $state(false);
	let signupPasswordConfirmVisible = $state(false);

	let loginEmail = $state('');
	let loginPassword = $state('');
	let loginPasswordVisible = $state(false);
	let authMode = $state<'signup' | 'login'>('login');

	onMount(() => {
		initializeSupabaseAuth();
	});

	const clearAuthFields = () => {
		signupEmail = '';
		signupPassword = '';
		signupPasswordConfirm = '';
		signupPasswordVisible = false;
		signupPasswordConfirmVisible = false;
		loginEmail = '';
		loginPassword = '';
		loginPasswordVisible = false;
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
		const signedIn = await signUpWithEmail({
			email: signupEmail,
			password: signupPassword,
			passwordConfirm: signupPasswordConfirm
		});

		if (signedIn) {
			clearAuthFields();
		} else {
			signupPassword = '';
			signupPasswordConfirm = '';
		}
	};

	const handleLogin = async (event: SubmitEvent) => {
		event.preventDefault();
		const signedIn = await signInWithEmail({
			email: loginEmail,
			password: loginPassword
		});

		if (signedIn) {
			clearAuthFields();
		}
	};

	const handleSignOut = async () => {
		await signOut();
	};

	const setAuthMode = (mode: 'signup' | 'login') => {
		authMode = mode;
		clearAuthFeedback();
	};

	const toggleSignupPasswordVisibility = () => {
		signupPasswordVisible = !signupPasswordVisible;
	};

	const toggleSignupPasswordConfirmVisibility = () => {
		signupPasswordConfirmVisible = !signupPasswordConfirmVisible;
	};

	const toggleLoginPasswordVisibility = () => {
		loginPasswordVisible = !loginPasswordVisible;
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
		<aside id="hero-auth-panel" class:auth-panel--open={expanded} class="auth-panel" aria-hidden={!expanded}>
			<div class="auth-shell">
				<div class="auth-header">
					<div>
						<p class="auth-kicker">Account</p>
						<h2>Your little safe space.</h2>
						<p class="auth-blurb-title">Why create an account?</p>
						<p class="auth-blurb-copy">
							Well you get to post GREAT stuff and if I know you I can steal your bank account!
						</p>
					</div>

				</div>

				{#if !hasSupabaseAuthConfig}
					<p class="auth-empty">
						Supabase auth is not configured yet. Add the public URL and anon key to enable sign in.
					</p>
				{:else if $authSession}
					<div class="auth-account">
						<div>
							<p class="auth-kicker">Signed In</p>
							<p class="auth-account-value">{getAuthUserLabel()}</p>
						</div>
						<button
							type="button"
							class="auth-submit auth-submit--secondary"
							disabled={$authPendingFlow === 'signout'}
							onclick={handleSignOut}
						>
							{$authPendingFlow === 'signout' ? 'Signing Out...' : 'Sign Out'}
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
									<h3>Create Account</h3>
								</div>

								<label class="auth-field">
									<span>Email</span>
									<input bind:value={signupEmail} type="email" name="signup-email" autocomplete="email" />
								</label>

								<label class="auth-field">
									<span>Password</span>
									<div class="auth-password-field">
										<input
											bind:value={signupPassword}
											type={signupPasswordVisible ? 'text' : 'password'}
											name="signup-password"
											minlength="8"
											autocomplete="new-password"
										/>
										<button
											type="button"
											class="auth-password-toggle"
											aria-pressed={signupPasswordVisible}
											aria-label={signupPasswordVisible ? 'Hide password' : 'Show password'}
											onclick={toggleSignupPasswordVisibility}
										>
											<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-password-icon">
												<path
													d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
													fill="none"
													stroke="currentColor"
													stroke-width="1.8"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
												<circle cx="12" cy="12" r="3" fill="currentColor" />
												{#if !signupPasswordVisible}
													<path
														d="M4 20 20 4"
														fill="none"
														stroke="currentColor"
														stroke-width="1.8"
														stroke-linecap="round"
													/>
												{/if}
											</svg>
										</button>
									</div>
								</label>

								<label class="auth-field">
									<span>Confirm Password</span>
									<div class="auth-password-field">
										<input
											bind:value={signupPasswordConfirm}
											type={signupPasswordConfirmVisible ? 'text' : 'password'}
											name="signup-password-confirm"
											minlength="8"
											autocomplete="new-password"
										/>
										<button
											type="button"
											class="auth-password-toggle"
											aria-pressed={signupPasswordConfirmVisible}
											aria-label={signupPasswordConfirmVisible ? 'Hide confirm password' : 'Show confirm password'}
											onclick={toggleSignupPasswordConfirmVisibility}
										>
											<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-password-icon">
												<path
													d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
													fill="none"
													stroke="currentColor"
													stroke-width="1.8"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
												<circle cx="12" cy="12" r="3" fill="currentColor" />
												{#if !signupPasswordConfirmVisible}
													<path
														d="M4 20 20 4"
														fill="none"
														stroke="currentColor"
														stroke-width="1.8"
														stroke-linecap="round"
													/>
												{/if}
											</svg>
										</button>
									</div>
								</label>

								<button type="submit" class="auth-submit" disabled={$authPendingFlow === 'signup'}>
									{$authPendingFlow === 'signup' ? 'Creating Account...' : 'Create Account'}
								</button>

								{#if $authError}
									<p class="auth-banner auth-banner--error" role="alert">{$authError}</p>
								{/if}

								{#if $authNotice}
									<p class="auth-banner auth-banner--notice">{$authNotice}</p>
								{/if}
							</form>
						{:else}
							<form class="auth-card auth-card--login" onsubmit={handleLogin}>
								<div class="auth-card-copy">
									<h3>Log In</h3>
								</div>

								<label class="auth-field">
									<span>Email</span>
									<input bind:value={loginEmail} type="email" name="login-email" autocomplete="email" />
								</label>

								<label class="auth-field">
									<span>Password</span>
									<div class="auth-password-field">
										<input
											bind:value={loginPassword}
											type={loginPasswordVisible ? 'text' : 'password'}
											name="login-password"
											autocomplete="current-password"
										/>
										<button
											type="button"
											class="auth-password-toggle"
											aria-pressed={loginPasswordVisible}
											aria-label={loginPasswordVisible ? 'Hide password' : 'Show password'}
											onclick={toggleLoginPasswordVisibility}
										>
											<svg aria-hidden="true" viewBox="0 0 24 24" class="auth-password-icon">
												<path
													d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
													fill="none"
													stroke="currentColor"
													stroke-width="1.8"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
												<circle cx="12" cy="12" r="3" fill="currentColor" />
												{#if !loginPasswordVisible}
													<path
														d="M4 20 20 4"
														fill="none"
														stroke="currentColor"
														stroke-width="1.8"
														stroke-linecap="round"
													/>
												{/if}
											</svg>
										</button>
									</div>
								</label>

								<button
									type="submit"
									class="auth-submit auth-submit--secondary"
									disabled={$authPendingFlow === 'login'}
								>
									{$authPendingFlow === 'login' ? 'Logging In...' : 'Log In'}
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

	.auth-blurb-title {
		margin: 1rem 0 0.3rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: #f5f8ff;
	}

	.auth-blurb-copy {
		margin: 0;
		color: rgba(227, 238, 255, 0.78);
		line-height: 1.55;
		font-size: 0.96rem;
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
		background: rgba(12, 26, 47, 0.72);
		border: 1px solid rgba(166, 198, 255, 0.2);
		color: rgba(227, 238, 255, 0.9);
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
	.auth-account {
		background: linear-gradient(180deg, rgba(11, 24, 46, 0.72), rgba(14, 22, 34, 0.72));
	}

	.auth-card-copy h3 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		color: #f5f8ff;
	}

	.auth-account-value {
		margin: 0.35rem 0 0;
		color: rgba(227, 238, 255, 0.88);
		line-height: 1.5;
	}

	.auth-account {
		margin-top: 1rem;
		padding: 1rem;
		border-radius: 1.05rem;
		border: 1px solid rgba(166, 198, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.auth-account-value {
		margin-top: 0;
		font-size: 1.05rem;
		font-weight: 600;
		word-break: break-word;
	}

	.auth-field {
		display: grid;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: rgba(227, 238, 255, 0.88);
	}

	.auth-field input {
		border: 1px solid rgba(166, 198, 255, 0.22);
		border-radius: 0.85rem;
		background: rgba(9, 20, 36, 0.6);
		color: #f5f8ff;
		padding: 0.7rem 0.8rem;
		font: inherit;
	}

	.auth-field input:focus {
		outline: 2px solid rgba(255, 198, 127, 0.34);
		outline-offset: 1px;
	}

	.auth-password-field {
		position: relative;
		width: 100%;
	}

	.auth-password-field input {
		width: 100%;
		box-sizing: border-box;
		padding-right: 2.8rem;
	}

	.auth-password-toggle {
		position: absolute;
		top: 50%;
		right: 0.45rem;
		transform: translateY(-50%);
		border: 0;
		background: transparent;
		color: rgba(227, 238, 255, 0.76);
		width: 2rem;
		height: 2rem;
		padding: 0;
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.auth-password-toggle:hover {
		color: rgba(255, 198, 127, 0.96);
	}

	.auth-password-toggle:focus-visible {
		outline: 2px solid rgba(255, 198, 127, 0.6);
		outline-offset: 2px;
		border-radius: 0.5rem;
	}

	.auth-password-icon {
		width: 1rem;
		height: 1rem;
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

	.auth-submit--secondary {
		background: #d7e6ff;
	}

	.auth-submit:disabled {
		opacity: 0.7;
		cursor: progress;
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

		.auth-account {
			flex-direction: column;
			align-items: flex-start;
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
