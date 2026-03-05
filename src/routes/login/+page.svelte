<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Session } from '@supabase/supabase-js';
	import { getSupabaseBrowserClient, isSupabaseConfigured } from '$lib/supabase/client';
	import { PUBLIC_LOCAL_PROXY_URL } from '$env/static/public';

	const supabaseConfigured = isSupabaseConfigured();
	const supabase = getSupabaseBrowserClient();

	let email = $state('');
	let password = $state('');
	let session = $state<Session | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');
	let infoMessage = $state('');

	let unsubscribe: (() => void) | undefined = undefined;

	onMount(async () => {
		if (!supabase) return;

		const { data, error } = await supabase.auth.getSession();
		if (error) {
			errorMessage = error.message;
			return;
		}

		session = data.session;

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			session = nextSession;
		});

		unsubscribe = () => subscription.unsubscribe();
	});

	onDestroy(() => {
		unsubscribe?.();
	});

	const clearMessages = () => {
		errorMessage = '';
		infoMessage = '';
	};

	const signIn = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!supabase) return;

		clearMessages();
		loading = true;

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			errorMessage = error.message;
		} else {
			infoMessage = 'Signed in.';
		}

		loading = false;
	};

	const signUp = async () => {
		if (!supabase) return;

		clearMessages();
		loading = true;

		const redirectUrl = PUBLIC_LOCAL_PROXY_URL ?? window.location.origin;
		const redirectTo = typeof window !== 'undefined' ? `${redirectUrl}/login` : undefined;
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: redirectTo }
		});

		if (error) {
			errorMessage = error.message;
		} else {
			infoMessage = 'Account created. Check email confirmation if required, then sign in.';
		}

		loading = false;
	};

	const signOut = async () => {
		if (!supabase) return;

		clearMessages();
		loading = true;

		const { error } = await supabase.auth.signOut();
		if (error) {
			errorMessage = error.message;
		} else {
			infoMessage = 'Signed out.';
		}

		loading = false;
	};
</script>

<svelte:head>
	<title>Login | Tooch Town</title>
	<meta
		name="description"
		content="Simple login flow for Tooch Town powered by Supabase authentication."
	/>
</svelte:head>

<main class="auth-shell">
	<section class="auth-card" aria-labelledby="login-title">
		<p class="kicker">Tooch Town</p>
		<h1 id="login-title">Account Login</h1>
		<p class="description">Simple auth scaffold for future protected features like blog posting.</p>

		{#if !supabaseConfigured}
			<p class="notice">
				Supabase env vars are not configured. Add `PUBLIC_SUPABASE_URL` and
				`PUBLIC_SUPABASE_ANON_KEY`, then reload.
			</p>
		{:else if session}
			<p class="status">
				Signed in as
				<strong>{session.user.email ?? 'unknown user'}</strong>
			</p>
			<div class="actions">
				<button type="button" onclick={signOut} disabled={loading}>
					{loading ? 'Working...' : 'Sign out'}
				</button>
				<a href="/">Back home</a>
			</div>
		{:else}
			<form class="auth-form" onsubmit={signIn}>
				<label>
					Email
					<input
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="you@example.com"
						required
					/>
				</label>
				<label>
					Password
					<input
						type="password"
						bind:value={password}
						autocomplete="current-password"
						placeholder="minimum 6 characters"
						minlength={6}
						required
					/>
				</label>
				<div class="actions">
					<button type="submit" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
					<button type="button" class="ghost" onclick={signUp} disabled={loading}>
						{loading ? 'Please wait...' : 'Create account'}
					</button>
				</div>
			</form>
			<p class="hint">Create account once, then use sign in for future sessions.</p>
		{/if}

		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
		{#if infoMessage}
			<p class="info">{infoMessage}</p>
		{/if}
	</section>
</main>

<style>
	.auth-shell {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: linear-gradient(180deg, #0a1628, #08111e);
		color: #e8f1ff;
	}

	.auth-card {
		width: min(100%, 30rem);
		border: 1px solid rgba(166, 198, 255, 0.24);
		border-radius: 1rem;
		background: rgba(8, 17, 30, 0.78);
		backdrop-filter: blur(10px);
		padding: 1.25rem 1.1rem;
		box-shadow: 0 18px 34px rgba(1, 6, 16, 0.28);
	}

	.kicker {
		margin: 0;
		font-size: 0.74rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #ffc67f;
	}

	h1 {
		margin: 0.35rem 0 0;
		font-size: 1.6rem;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.description {
		margin: 0.45rem 0 0;
		color: rgba(227, 238, 255, 0.84);
	}

	.notice,
	.status {
		margin: 1rem 0 0;
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: rgba(13, 27, 47, 0.5);
		border: 1px solid rgba(166, 198, 255, 0.2);
	}

	.auth-form {
		margin-top: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.9rem;
	}

	input {
		border: 1px solid rgba(166, 198, 255, 0.24);
		background: rgba(6, 13, 24, 0.92);
		color: #eef6ff;
		border-radius: 0.62rem;
		padding: 0.58rem 0.7rem;
		font-size: 0.92rem;
	}

	input:focus-visible {
		outline: 2px solid rgba(123, 179, 255, 0.56);
		outline-offset: 1px;
	}

	.actions {
		margin-top: 0.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	button,
	.actions a {
		border: 1px solid rgba(166, 198, 255, 0.3);
		background: rgba(18, 47, 84, 0.9);
		color: #f3f8ff;
		border-radius: 999px;
		padding: 0.42rem 0.82rem;
		font-size: 0.86rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	button.ghost {
		background: rgba(8, 20, 35, 0.8);
	}

	button:disabled {
		opacity: 0.65;
		cursor: default;
	}

	.hint {
		margin: 0.8rem 0 0;
		color: rgba(203, 219, 247, 0.76);
		font-size: 0.88rem;
	}

	.error,
	.info {
		margin: 0.8rem 0 0;
		font-size: 0.9rem;
	}

	.error {
		color: #ffb3b3;
	}

	.info {
		color: #b7e0ff;
	}
</style>
