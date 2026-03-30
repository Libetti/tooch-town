import { afterEach, describe, expect, it, vi } from 'vitest';

const loadGetHandler = async () => {
	vi.resetModules();
	const module = await import('./+server');
	return module.GET;
};

describe('/api/lightning/latest-frame GET', () => {
	afterEach(() => {
		delete process.env.MOCK_LIGHTNING;
		delete process.env.LIGHTNING_API_BASE_URL;
	});

	it('proxies the latest frame response from upstream', async () => {
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
					flash_count: 75,
					updated_at: '2026-03-30T17:23:28Z'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const response = await GET({
			fetch: fetchMock,
			url: new URL('https://local.tooch.dev/api/lightning/latest-frame?satellite=goes-east')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
		expect(String(requestUrl)).toContain('/lightning/latest-frame?satellite=goes-east');
		expect(requestInit).toEqual(
			expect.objectContaining({
				headers: { accept: 'application/json' }
			})
		);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.frame_id).toBe('frame-east-1');
		expect(body.satellite).toBe('goes-east');
	});

	it('rejects invalid satellite values', async () => {
		process.env.MOCK_LIGHTNING = 'true';
		const GET = await loadGetHandler();

		const response = await GET({
			fetch: vi.fn(),
			url: new URL('https://local.tooch.dev/api/lightning/latest-frame?satellite=nope')
		} as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe('satellite must be either goes-east or goes-west');
	});
});
