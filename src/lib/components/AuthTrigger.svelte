<script lang="ts">
	import { onMount } from 'svelte';
	import {
		authSession,
		clearAuthFeedback,
		getAuthUserLabel,
		initializeSupabaseAuth
	} from '$lib/supabase/auth';

	type Props = {
		hasSupabaseAuthConfig: boolean;
		expanded?: boolean;
		onToggle?: () => void;
	};

	let { hasSupabaseAuthConfig, expanded = false, onToggle }: Props = $props();

	const getTriggerLabel = () => {
		if (hasSupabaseAuthConfig) {
			return 'You';
		}

		return '!';
	};

	const getTriggerAriaLabel = () => {
		if ($authSession) {
			return expanded ? 'Hide account sidebar' : `Show account sidebar for ${getAuthUserLabel()}`;
		}

		if (hasSupabaseAuthConfig) {
			return expanded ? 'Hide sign in sidebar' : 'Show sign in sidebar';
		}

		return 'Supabase auth is offline';
	};

	onMount(() => {
		if (!hasSupabaseAuthConfig) return;
		initializeSupabaseAuth();
	});

	const togglePanel = () => {
		clearAuthFeedback();
		onToggle?.();
	};
</script>

<button
	type="button"
	class:auth-trigger--active={expanded}
	class="auth-trigger"
	aria-expanded={expanded}
	aria-controls="hero-auth-panel"
	aria-label={getTriggerAriaLabel()}
	onclick={togglePanel}
>
	<span aria-hidden="true">{getTriggerLabel()}</span>
</button>

<style>
	.auth-trigger {
		position: relative;
		z-index: 2;
		width: 3.25rem;
		height: 3.25rem;
		border: 1px solid rgba(166, 198, 255, 0.22);
		background:
			radial-gradient(circle at 30% 30%, rgba(255, 213, 146, 0.18), transparent 55%),
			rgba(10, 24, 43, 0.82);
		color: #f5f8ff;
		border-radius: 50%;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(12px);
		box-shadow: 0 14px 28px rgba(1, 6, 16, 0.32);
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.auth-trigger:hover {
		background:
			radial-gradient(circle at 30% 30%, rgba(255, 213, 146, 0.22), transparent 55%),
			rgba(14, 31, 54, 0.96);
		transform: translateY(-1px);
	}

	.auth-trigger--active,
	.auth-trigger--active:hover {
		background: #ffc67f;
		border-color: #ffc67f;
		color: #112237;
		box-shadow:
			0 0 0 1px rgba(255, 198, 127, 0.18),
			0 14px 28px rgba(1, 6, 16, 0.24);
	}
</style>
