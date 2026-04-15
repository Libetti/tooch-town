<script lang="ts" module>
	type HcaptchaApi = {
		render: (
			container: HTMLElement,
			options: {
				sitekey: string;
				callback: (token: string) => void;
				'expired-callback': () => void;
				'error-callback': () => void;
			}
		) => string;
		remove?: (widgetId: string) => void;
		reset?: (widgetId: string) => void;
	};

	declare global {
		interface Window {
			hcaptcha?: HcaptchaApi;
		}
	}

	const HCAPTCHA_SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit';
	let hcaptchaScriptPromise: Promise<void> | null = null;
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	type Props = {
		sitekey: string;
		token?: string;
	};

	let { sitekey, token = $bindable('') }: Props = $props();

	let container: HTMLDivElement;
	let loadError = $state<string | null>(null);
	let widgetId: string | null = null;

	const getHcaptcha = () => window.hcaptcha as HcaptchaApi | undefined;

	const loadHcaptchaScript = () => {
		if (getHcaptcha()) return Promise.resolve();
		if (hcaptchaScriptPromise) return hcaptchaScriptPromise;

		hcaptchaScriptPromise = new Promise((resolve, reject) => {
			const existingScript = document.querySelector<HTMLScriptElement>(
				`script[src="${HCAPTCHA_SCRIPT_SRC}"]`
			);

			if (existingScript) {
				existingScript.addEventListener('load', () => resolve(), { once: true });
				existingScript.addEventListener('error', () => reject(new Error('hCaptcha failed to load.')), {
					once: true
				});
				return;
			}

			const script = document.createElement('script');
			script.src = HCAPTCHA_SCRIPT_SRC;
			script.async = true;
			script.defer = true;
			script.addEventListener('load', () => resolve(), { once: true });
			script.addEventListener('error', () => reject(new Error('hCaptcha failed to load.')), {
				once: true
			});
			document.head.appendChild(script);
		});

		return hcaptchaScriptPromise;
	};

	onMount(async () => {
		if (!sitekey) {
			loadError = 'Captcha is not configured yet.';
			return;
		}

		try {
			await loadHcaptchaScript();
			const hcaptcha = getHcaptcha();
			if (!hcaptcha) throw new Error('hCaptcha failed to load.');

			widgetId = hcaptcha.render(container, {
				sitekey,
				callback: (nextToken) => {
					token = nextToken;
					loadError = null;
				},
				'expired-callback': () => {
					token = '';
				},
				'error-callback': () => {
					token = '';
					loadError = 'Captcha failed. Try again.';
				}
			});
		} catch {
			loadError = 'Captcha failed to load. Check your connection and try again.';
		}
	});

	onDestroy(() => {
		const hcaptcha = getHcaptcha();
		if (!hcaptcha || !widgetId) return;

		if (hcaptcha.remove) {
			hcaptcha.remove(widgetId);
			return;
		}

		hcaptcha.reset?.(widgetId);
	});
</script>

<div class="hcaptcha-challenge">
	<div bind:this={container}></div>
	{#if loadError}
		<p class="hcaptcha-error" role="alert">{loadError}</p>
	{/if}
</div>

<style>
	.hcaptcha-challenge {
		display: grid;
		gap: 0.45rem;
		min-height: 4.9rem;
	}

	.hcaptcha-error {
		margin: 0;
		color: #ffd6d6;
		font-size: 0.84rem;
		line-height: 1.4;
	}
</style>
