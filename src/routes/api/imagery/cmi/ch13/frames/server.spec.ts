import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		LIGHTNING_API_BASE_URL: 'http://127.0.0.1:8000'
	}
}));

import { GET } from './+server';

describe('GET /api/imagery/cmi/ch13/frames', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('forwards query params to upstream and returns upstream JSON', async () => {
		const upstreamPayload = {
			satellite: 'goes-east',
			count: 1,
			poll_interval_seconds: 10,
			frames: []
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(upstreamPayload), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const response = await GET({
			fetch: fetchMock,
			url: new URL(
				'https://local.tooch.dev/api/imagery/cmi/ch13/frames?satellite=goes-west&limit=5&poll_hint=12'
			)
		} as never);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'http://127.0.0.1:8000/imagery/cmi/ch13/frames?satellite=goes-west&limit=5&poll_hint=12'
		);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(upstreamPayload);
	});

	it('returns 400 for invalid poll_hint', async () => {
		const fetchMock = vi.fn();
		const response = await GET({
			fetch: fetchMock,
			url: new URL('https://local.tooch.dev/api/imagery/cmi/ch13/frames?poll_hint=abc')
		} as never);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid poll_hint value' });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
