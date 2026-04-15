import { env } from '$env/dynamic/private';

type TurnstileVerifyOptions = {
	token?: string | null;
	remoteIp?: string;
	fetcher?: typeof fetch;
	secretKey?: string | null;
	timeoutMs?: number;
};

type TurnstileSiteverifyResponse = {
	success?: boolean;
};

export type TurnstileVerifyResult = { ok: true } | { ok: false; status: number; error: string };

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;
const TURNSTILE_TOKEN_MAX_LENGTH = 4096;

export const verifyTurnstileToken = async ({
	token,
	remoteIp,
	fetcher = fetch,
	secretKey = env.TURNSTILE_SECRET_KEY,
	timeoutMs = TURNSTILE_VERIFY_TIMEOUT_MS
}: TurnstileVerifyOptions): Promise<TurnstileVerifyResult> => {
	const trimmedToken = token?.trim() ?? '';

	if (!trimmedToken) {
		return {
			ok: false,
			status: 400,
			error: 'Complete the human check before continuing.'
		};
	}

	if (trimmedToken.length > TURNSTILE_TOKEN_MAX_LENGTH) {
		return {
			ok: false,
			status: 400,
			error: 'Human check failed. Please try again.'
		};
	}

	if (!secretKey) {
		return {
			ok: false,
			status: 503,
			error: 'Human check is not configured right now.'
		};
	}

	const body = new URLSearchParams({
		secret: secretKey,
		response: trimmedToken
	});

	if (remoteIp) {
		body.set('remoteip', remoteIp);
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			body,
			signal: controller.signal
		});

		if (!response.ok) {
			return {
				ok: false,
				status: 503,
				error: 'Unable to verify the human check right now.'
			};
		}

		const result = (await response.json()) as TurnstileSiteverifyResponse;
		if (!result.success) {
			return {
				ok: false,
				status: 400,
				error: 'Human check failed. Please try again.'
			};
		}

		return { ok: true };
	} catch {
		return {
			ok: false,
			status: 503,
			error: 'Unable to verify the human check right now.'
		};
	} finally {
		clearTimeout(timeout);
	}
};
