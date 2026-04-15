import { env } from '$env/dynamic/private';

type TurnstileVerifyOptions = {
	token?: string | null;
	remoteIp?: string;
	fetcher?: typeof fetch;
};

type TurnstileSiteverifyResponse = {
	success?: boolean;
	'error-codes'?: string[];
};

export type TurnstileVerifyResult = { ok: true } | { ok: false; status: number; error: string };

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const verifyTurnstileToken = async ({
	token,
	remoteIp,
	fetcher = fetch
}: TurnstileVerifyOptions): Promise<TurnstileVerifyResult> => {
	const secretKey = env.TURNSTILE_SECRET_KEY;
	const trimmedToken = token?.trim() ?? '';

	if (!trimmedToken) {
		return {
			ok: false,
			status: 400,
			error: 'Complete the human check before creating your account.'
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

	try {
		const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			body
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
	}
};
