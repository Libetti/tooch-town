import { afterEach, describe, expect, it, vi } from 'vitest';

const loadGetHandler = async () => {
	vi.resetModules();
	const module = await import('./+server');
	return module.GET;
};

describe('/api/lightning/recent GET', () => {
	afterEach(() => {
		delete process.env.MOCK_LIGHTNING;
		delete process.env.LIGHTNING_API_BASE_URL;
	});

	it('returns unified strike payload from upstream responses', async () => {
		process.env.MOCK_LIGHTNING = 'false';
		process.env.LIGHTNING_API_BASE_URL = 'https://upstream.example';
		const GET = await loadGetHandler();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						satellite: 'goes-east',
						count: 1,
						features: [
							{
								id: 'evt-east-1',
								latitude: 39.6,
								longitude: -75.5,
								time: '2026-03-16T10:00:00.000Z',
								energy: 1e-13
							}
						]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						satellite: 'goes-west',
						count: 1,
						features: [
							{
								id: 'evt-west-1',
								latitude: 38.1,
								longitude: -90.1,
								time: '2026-03-16T10:00:05.000Z',
								energy: 8e-14
							}
						]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			);

		const response = await GET({
			fetch: fetchMock,
			url: new URL('https://local.tooch.dev/api/lightning/recent?windowSeconds=120&limit=10')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(typeof body.generatedAt).toBe('string');
		expect(body.windowSeconds).toBe(120);
		expect(Array.isArray(body.strikes)).toBe(true);
		expect((body.strikes as unknown[]).length).toBeLessThanOrEqual(10);

		const firstStrike = (body.strikes as Record<string, unknown>[])[0];
		expect(typeof firstStrike.id).toBe('string');
		expect(firstStrike.satellite === 'goes-east' || firstStrike.satellite === 'goes-west').toBe(true);
		expect(typeof firstStrike.latitude).toBe('number');
		expect(typeof firstStrike.longitude).toBe('number');
		expect(typeof firstStrike.time).toBe('string');
	});

	it('rejects invalid windowSeconds values', async () => {
		process.env.MOCK_LIGHTNING = 'true';
		const GET = await loadGetHandler();

		const response = await GET({
			fetch: vi.fn(),
			url: new URL('https://local.tooch.dev/api/lightning/recent?windowSeconds=abc')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe('windowSeconds must be a positive integer');
	});

	it('propagates upstream failures as API errors', async () => {
		process.env.MOCK_LIGHTNING = 'false';
		process.env.LIGHTNING_API_BASE_URL = 'https://upstream.example';
		const GET = await loadGetHandler();

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						satellite: 'goes-east',
						count: 0,
						features: []
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(new Response('upstream failure', { status: 503 }));

		const response = await GET({
			fetch: fetchMock,
			url: new URL('https://local.tooch.dev/api/lightning/recent?windowSeconds=120')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(503);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe('Failed to fetch lightning data');
		expect(body.status).toBe(503);
	});
});
