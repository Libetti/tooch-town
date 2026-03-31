<script lang="ts">
	import { onMount } from 'svelte';
	import { hasSupabaseAuthConfig } from '$lib/supabase/client';
	import { authSession, clearAuthFeedback, getAuthUserLabel, initializeSupabaseAuth } from '$lib/supabase/auth';

	type Props = {
		expanded?: boolean;
		onToggle?: () => void;
	};

	let { expanded = false, onToggle }: Props = $props();

	onMount(() => {
		initializeSupabaseAuth();
	});

	const togglePanel = () => {
		clearAuthFeedback();
		onToggle?.();
	};
</script>

<button
	type="button"
	class="auth-trigger"
	aria-expanded={expanded}
	aria-controls="hero-auth-panel"
	onclick={togglePanel}
>
	{#if $authSession}
		{expanded ? 'Hide Account' : getAuthUserLabel()}
	{:else if hasSupabaseAuthConfig}
		{expanded ? 'Hide Auth' : 'Sign In'}
	{:else}
		Auth Offline
	{/if}
</button>

<style>
	.auth-trigger {
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0.45rem 0.85rem;
		border: 1px solid rgba(166, 198, 255, 0.22);
		background: rgba(10, 24, 43, 0.7);
		color: #f5f8ff;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.auth-trigger:hover {
		background: rgba(14, 31, 54, 0.92);
	}
</style>
