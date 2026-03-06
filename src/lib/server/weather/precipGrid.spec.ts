import { beforeEach, describe, expect, it } from 'vitest';
import {
	__internal,
	clearPrecipGridCacheForTests,
	getPrecipGrid,
	type PrecipGridResponse
} from './precipGrid';

const buildMockFetch = () => {
	let callCount = 0;

	const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
		callCount += 1;
		const url = new URL(typeof input === 'string' ? input : input.toString());
		const latitudes = (url.searchParams.get('latitude') ?? '').split(',').map(Number);
		const longitudes = (url.searchParams.get('longitude') ?? '').split(',').map(Number);

		const batch = latitudes.map((lat, index) => ({
			latitude: lat,
			longitude: longitudes[index],
			current: {
				precipitation: index % 2 === 0 ? 0.35 : 0
			}
		}));

		return new Response(JSON.stringify(batch), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof fetch;

	return {
		mockFetch,
		getCallCount: () => callCount
	};
};

const expectedBatchCount = Math.ceil(__internal.GRID_POINTS.length / __internal.GRID_BATCH_SIZE);

describe('getPrecipGrid', () => {
	beforeEach(() => {
		clearPrecipGridCacheForTests();
	});

	it('uses cache hit within ttl window', async () => {
		const { mockFetch, getCallCount } = buildMockFetch();
		const startMs = Date.parse('2026-03-06T12:00:00.000Z');

		await getPrecipGrid(mockFetch, startMs);
		const second = await getPrecipGrid(mockFetch, startMs + 1_000);

		expect(getCallCount()).toBe(expectedBatchCount);
		expect(second.ttlSeconds).toBe(180);
	});

	it('deduplicates concurrent in-flight refreshes', async () => {
		const { mockFetch, getCallCount } = buildMockFetch();
		const startMs = Date.parse('2026-03-06T12:00:00.000Z');

		const [first, second] = await Promise.all([
			getPrecipGrid(mockFetch, startMs),
			getPrecipGrid(mockFetch, startMs)
		]);

		expect(getCallCount()).toBe(expectedBatchCount);
		expect(first).toEqual(second);
	});

	it('refreshes cache after ttl expires', async () => {
		const { mockFetch, getCallCount } = buildMockFetch();
		const firstStart = Date.parse('2026-03-06T12:00:00.000Z');
		const first = (await getPrecipGrid(mockFetch, firstStart)) as PrecipGridResponse;
		const second = (await getPrecipGrid(
			mockFetch,
			firstStart + __internal.CACHE_TTL_MS + 1
		)) as PrecipGridResponse;

		expect(getCallCount()).toBe(expectedBatchCount * 2);
		expect(second.generatedAt).not.toBe(first.generatedAt);
	});
});
