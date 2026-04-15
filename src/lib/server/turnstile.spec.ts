import { afterEach, describe, expect, it, vi } from 'vitest';

const loadVerifier = async () => {
	vi.resetModules();
	const module = await import('./turnstile');
	return module.verifyTurnstileToken;
};

describe('verifyTurnstileToken', () => {
	afterEach(() => {
		delete process.env.TURNSTILE_SECRET_KEY;
	});

	it('rejects a missing token before calling Cloudflare', async () => {
		process.env.TURNSTILE_SECRET_KEY = 'secret';
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn();

		const result = await verifyTurnstileToken({ token: '', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 400,
			error: 'Complete the human check before creating your account.'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('accepts a successful Siteverify response', async () => {
		process.env.TURNSTILE_SECRET_KEY = 'secret';
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await verifyTurnstileToken({
			token: 'token',
			remoteIp: '203.0.113.9',
			fetcher
		});

		expect(result).toEqual({ ok: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
		const [, init] = fetcher.mock.calls[0] ?? [];
		expect(init).toEqual(
			expect.objectContaining({
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' }
			})
		);
		expect(String(init.body)).toContain('response=token');
		expect(String(init.body)).toContain('remoteip=203.0.113.9');
	});

	it('rejects an unsuccessful Siteverify response', async () => {
		process.env.TURNSTILE_SECRET_KEY = 'secret';
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: false }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await verifyTurnstileToken({ token: 'token', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 400,
			error: 'Human check failed. Please try again.'
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
