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
	};

	let { expanded = false }: Props = $props();

	let signupEmail = $state('');
	let signupPassword = $state('');
	let signupPasswordConfirm = $state('');

	let loginEmail = $state('');
	let loginPassword = $state('');

	onMount(() => {
		initializeSupabaseAuth();
	});

	const clearAuthFields = () => {
		signupEmail = '';
		signupPassword = '';
		signupPasswordConfirm = '';
		loginEmail = '';
		loginPassword = '';
	};

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!expanded || event.key !== 'Escape') return;
		event.preventDefault();
		clearAuthFeedback();
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
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div id="hero-auth-panel" class:auth-panel--expanded={expanded} class="auth-panel" aria-hidden={!expanded}>
	<div class="auth-expand-inner">
		{#if $authError}
			<p class="auth-banner auth-banner--error" role="alert">{$authError}</p>
		{/if}

		{#if $authNotice}
			<p class="auth-banner auth-banner--notice">{$authNotice}</p>
		{/if}

		{#if !hasSupabaseAuthConfig}
			<p class="auth-empty">Supabase auth is not configured yet. Add the public URL and anon key to enable sign in.</p>
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
			<div class="auth-grid">
				<form class="auth-card auth-card--signup" onsubmit={handleSignup}>
					<div class="auth-card-copy">
						<p class="auth-kicker">New Here?</p>
						<h3>Sign Up</h3>
						<p>Create an account with your email and password.</p>
					</div>

					<label class="auth-field">
						<span>Email</span>
						<input bind:value={signupEmail} type="email" name="signup-email" autocomplete="email" />
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

					<button type="submit" class="auth-submit" disabled={$authPendingFlow === 'signup'}>
						{$authPendingFlow === 'signup' ? 'Creating Account...' : 'Create Account'}
					</button>
				</form>

				<form class="auth-card auth-card--login" onsubmit={handleLogin}>
					<div class="auth-card-copy">
						<p class="auth-kicker">Already Signed Up?</p>
						<h3>Log In</h3>
						<p>Use the same email and password to get back in.</p>
					</div>

					<label class="auth-field">
						<span>Email</span>
						<input bind:value={loginEmail} type="email" name="login-email" autocomplete="email" />
					</label>

					<label class="auth-field">
						<span>Password</span>
						<input
							bind:value={loginPassword}
							type="password"
							name="login-password"
							autocomplete="current-password"
						/>
					</label>

					<button type="submit" class="auth-submit auth-submit--secondary" disabled={$authPendingFlow === 'login'}>
						{$authPendingFlow === 'login' ? 'Logging In...' : 'Log In'}
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>

<style>
	.auth-panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 320ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.auth-panel--expanded {
		grid-template-rows: 1fr;
	}

	.auth-expand-inner {
		min-height: 0;
		overflow: hidden;
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1rem;
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

	.auth-card-copy p,
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

	@media (max-width: 48rem) {
		.auth-grid {
			grid-template-columns: 1fr;
		}

		.auth-account {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
