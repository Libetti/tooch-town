import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		LIGHTNING_API_BASE_URL: 'http://127.0.0.1:8000'
	}
}));

import { GET } from './+server';

describe('GET /api/imagery/cmi/ch13/tiles/[satellite]/[frame_id]/[z]/[x]/[y].png', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('proxies PNG tile bytes and key headers', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(new Uint8Array([137, 80, 78, 71]), {
				status: 200,
				headers: {
					'content-type': 'image/png',
					'cache-control': 'public, max-age=60',
					etag: '"abc123"'
				}
			})
		);

		const response = await GET({
			fetch: fetchMock,
			params: {
				satellite: 'goes-east',
				frame_id: 'frame-1',
				z: '2',
				x: '3',
				y: '4'
			}
		} as never);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'http://127.0.0.1:8000/imagery/cmi/ch13/tiles/goes-east/frame-1/2/3/4.png'
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toBe('public, max-age=60');
		expect(response.headers.get('etag')).toBe('"abc123"');
	});

	it('returns upstream status for failed tile fetch', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
		const response = await GET({
			fetch: fetchMock,
			params: {
				satellite: 'goes-east',
				frame_id: 'frame-1',
				z: '2',
				x: '3',
				y: '4'
			}
		} as never);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: 'Failed to fetch CMI tile image',
			status: 404
		});
	});
});
