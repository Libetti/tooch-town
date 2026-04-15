<script lang="ts">
	import { browser } from '$app/environment';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';
	import { onDestroy } from 'svelte';

	type TurnstileWidgetId = string;
	type TurnstilePendingToken = {
		resolve: (token: string) => void;
		reject: (error: Error) => void;
	};
	const TURNSTILE_SCRIPT_URL =
		'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

	let container = $state<HTMLDivElement | null>(null);
	let widgetId: TurnstileWidgetId | null = null;
	let pendingToken: TurnstilePendingToken | null = null;

	const rejectPendingToken = (message: string) => {
		if (!pendingToken) return;

		pendingToken.reject(new Error(message));
		pendingToken = null;
	};

	const loadTurnstileScript = async () => {
		if (!browser) {
			throw new Error('Human check can only run in the browser.');
		}

		if (window.turnstile) return;

		if (!window.turnstileScriptPromise) {
			window.turnstileScriptPromise = new Promise<void>((resolve, reject) => {
				const existingScript = document.querySelector<HTMLScriptElement>(
					`script[src="${TURNSTILE_SCRIPT_URL}"]`
				);

				if (existingScript) {
					existingScript.addEventListener('load', () => resolve(), { once: true });
					existingScript.addEventListener(
						'error',
						() => reject(new Error('Unable to load the human check.')),
						{ once: true }
					);
					return;
				}

				const script = document.createElement('script');
				script.src = TURNSTILE_SCRIPT_URL;
				script.async = true;
				script.defer = true;
				script.addEventListener('load', () => resolve(), { once: true });
				script.addEventListener(
					'error',
					() => reject(new Error('Unable to load the human check.')),
					{ once: true }
				);
				document.head.appendChild(script);
			});
		}

		await window.turnstileScriptPromise;
	};

	const ensureWidget = async () => {
		if (!PUBLIC_TURNSTILE_SITE_KEY) {
			throw new Error('Human check is not configured right now.');
		}

		if (!container) {
			throw new Error('Human check is not ready yet.');
		}

		await loadTurnstileScript();

		if (!window.turnstile) {
			throw new Error('Human check is not ready yet.');
		}

		if (!widgetId) {
			widgetId = window.turnstile.render(container, {
				sitekey: PUBLIC_TURNSTILE_SITE_KEY,
				size: 'normal',
				execution: 'execute',
				appearance: 'interaction-only',
				'response-field': false,
				callback: (token: string) => {
					if (!pendingToken) return;

					pendingToken.resolve(token);
					pendingToken = null;
				},
				'error-callback': () => {
					rejectPendingToken('Human check failed. Please try again.');
				},
				'expired-callback': () => {
					rejectPendingToken('Human check expired. Please try again.');
				},
				'timeout-callback': () => {
					rejectPendingToken('Human check timed out. Please try again.');
				}
			});
		}

		return widgetId;
	};

	export const reset = () => {
		if (!browser) return;
		if (!widgetId || !window.turnstile) return;

		window.turnstile.reset(widgetId);
		pendingToken = null;
	};

	export const execute = async () => {
		const nextWidgetId = await ensureWidget();

		if (!window.turnstile) {
			throw new Error('Human check is not ready yet.');
		}

		rejectPendingToken('Human check restarted.');
		window.turnstile.reset(nextWidgetId);

		return new Promise<string>((resolve, reject) => {
			pendingToken = { resolve, reject };
			window.turnstile?.execute(nextWidgetId);
		});
	};

	onDestroy(() => {
		rejectPendingToken('Human check was cancelled.');
		if (!browser) return;

		if (widgetId && window.turnstile) {
			window.turnstile.remove(widgetId);
		}
	});
</script>

<div bind:this={container} class="turnstile-challenge" aria-hidden="true"></div>

<style>
	.turnstile-challenge {
		max-width: 100%;
		min-height: 0;
	}
</style>
