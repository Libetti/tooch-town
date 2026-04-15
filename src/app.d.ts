// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	type CloudflareTurnstileWidgetId = string;
	type CloudflareTurnstileRenderOptions = {
		sitekey: string;
		size: 'compact' | 'flexible' | 'normal';
		execution: 'execute' | 'render';
		appearance: 'always' | 'execute' | 'interaction-only';
		'response-field'?: boolean;
		callback: (token: string) => void;
		'error-callback': () => void;
		'expired-callback': () => void;
		'timeout-callback': () => void;
	};

	interface Window {
		turnstile?: {
			render: (
				container: HTMLElement,
				options: CloudflareTurnstileRenderOptions
			) => CloudflareTurnstileWidgetId;
			execute: (widgetId: CloudflareTurnstileWidgetId) => void;
			reset: (widgetId: CloudflareTurnstileWidgetId) => void;
			remove: (widgetId: CloudflareTurnstileWidgetId) => void;
		};
		turnstileScriptPromise?: Promise<void>;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
