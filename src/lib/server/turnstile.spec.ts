import { describe, expect, it, vi } from 'vitest';

const loadVerifier = async () => {
	vi.resetModules();
	const module = await import('./turnstile');
	return module.verifyTurnstileToken;
};

describe('verifyTurnstileToken', () => {
	it('rejects a missing token before calling Cloudflare', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn();

		const result = await verifyTurnstileToken({ token: '', secretKey: 'secret', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 400,
			error: 'Complete the human check before continuing.'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('rejects an oversized token before calling Cloudflare', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn();

		const result = await verifyTurnstileToken({
			token: 'x'.repeat(4097),
			secretKey: 'secret',
			fetcher
		});

		expect(result).toEqual({
			ok: false,
			status: 400,
			error: 'Human check failed. Please try again.'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('rejects missing server configuration before calling Cloudflare', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn();

		const result = await verifyTurnstileToken({ token: 'token', secretKey: '', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 503,
			error: 'Human check is not configured right now.'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('accepts a successful Siteverify response', async () => {
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
			secretKey: 'secret',
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
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(String(init.body)).toContain('response=token');
		expect(String(init.body)).toContain('remoteip=203.0.113.9');
	});

	it('treats a non-200 Siteverify response as temporarily unavailable', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 }));

		const result = await verifyTurnstileToken({ token: 'token', secretKey: 'secret', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 503,
			error: 'Unable to verify the human check right now.'
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('times out a slow Siteverify response', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
					once: true
				});
			});
		});

		const result = await verifyTurnstileToken({
			token: 'token',
			secretKey: 'secret',
			fetcher,
			timeoutMs: 1
		});

		expect(result).toEqual({
			ok: false,
			status: 503,
			error: 'Unable to verify the human check right now.'
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('rejects an unsuccessful Siteverify response', async () => {
		const verifyTurnstileToken = await loadVerifier();
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: false }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await verifyTurnstileToken({ token: 'token', secretKey: 'secret', fetcher });

		expect(result).toEqual({
			ok: false,
			status: 400,
			error: 'Human check failed. Please try again.'
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
