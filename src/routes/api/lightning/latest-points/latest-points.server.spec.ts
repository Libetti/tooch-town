import { afterEach, describe, expect, it, vi } from 'vitest';

const loadGetHandler = async () => {
	vi.resetModules();
	const module = await import('./+server');
	return module.GET;
};

describe('/api/lightning/latest-points GET', () => {
	afterEach(() => {
		delete process.env.MOCK_LIGHTNING;
		delete process.env.LIGHTNING_API_BASE_URL;
	});

	it('proxies the latest points response from upstream', async () => {
		process.env.MOCK_LIGHTNING = 'false';
		process.env.LIGHTNING_API_BASE_URL = 'https://upstream.example';
		const GET = await loadGetHandler();
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					frame_id: 'frame-east-1',
					satellite: 'goes-east',
					start_time: '2026-03-30T17:23:00Z',
					end_time: '2026-03-30T17:23:20Z',
					updated_at: '2026-03-30T17:23:28Z',
					count: 1,
					features: [
						{
							id: 'evt-1',
							latitude: 39.6,
							longitude: -75.5,
							time: '2026-03-30T17:23:05Z',
							energy: 1e-13
						}
					]
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const response = await GET({
			fetch: fetchMock,
			url: new URL('https://local.tooch.dev/api/lightning/latest-points?satellite=goes-east&limit=10')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
		expect(String(requestUrl)).toContain('/lightning/latest-points?satellite=goes-east&limit=10');
		expect(requestInit).toEqual(
			expect.objectContaining({
				headers: { accept: 'application/json' }
			})
		);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.count).toBe(1);
		expect(Array.isArray(body.features)).toBe(true);
	});

	it('rejects invalid limit values', async () => {
		process.env.MOCK_LIGHTNING = 'true';
		const GET = await loadGetHandler();

		const response = await GET({
			fetch: vi.fn(),
			url: new URL('https://local.tooch.dev/api/lightning/latest-points?satellite=goes-east&limit=abc')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe('limit must be a positive integer');
	});
});
