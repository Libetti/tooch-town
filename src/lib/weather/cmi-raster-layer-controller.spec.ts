import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCmiRasterLayerController,
	type CMIFramesResponse
} from './cmi-raster-layer-controller';

const flush = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const responseJson = (payload: unknown) =>
	({
		ok: true,
		json: async () => payload
	}) as Response;

const makeFramesPayload = (satellite: 'goes-east' | 'goes-west', frameIds: string[]): CMIFramesResponse => ({
	satellite,
	count: frameIds.length,
	poll_interval_seconds: 10,
	frames: frameIds.map((frameId, index) => ({
		frame_id: frameId,
		satellite,
		start_time: new Date(Date.UTC(2026, 2, 16, 0, index)).toISOString(),
		end_time: new Date(Date.UTC(2026, 2, 16, 0, index, 30)).toISOString(),
		tile_url_template: `https://upstream/${frameId}/{z}/{x}/{y}.png`
	}))
});

describe('createCmiRasterLayerController', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('animates frames oldest-to-newest and loops', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(makeFramesPayload('goes-east', ['f1', 'f2', 'f3']))
		);

		const controller = createCmiRasterLayerController({
			animationIntervalMs: 700,
			frameLimit: 3
		});
		const observed: Array<string | undefined> = [];
		const unsubscribe = controller.tileTemplate.subscribe((value) => observed.push(value));

		controller.start();
		await flush();

		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-east/f1/{z}/{x}/{y}.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-east/f2/{z}/{x}/{y}.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-east/f3/{z}/{x}/{y}.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-east/f3/{z}/{x}/{y}.png');

		unsubscribe();
		controller.stop();
	});

	it('switches satellites and resets frame stream', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const requestUrl =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const satellite = new URL(requestUrl, 'https://example.com').searchParams.get('satellite');
			const payload =
				satellite === 'goes-west'
					? makeFramesPayload('goes-west', ['w1', 'w2'])
					: makeFramesPayload('goes-east', ['e1', 'e2']);
			return responseJson(payload);
		});

		const controller = createCmiRasterLayerController();
		const observed: Array<string | undefined> = [];
		const unsubscribe = controller.tileTemplate.subscribe((value) => observed.push(value));

		controller.start();
		await flush();
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-east/e1/{z}/{x}/{y}.png');

		controller.setSatellite('goes-west');
		await flush();
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/tiles/goes-west/w1/{z}/{x}/{y}.png');

		unsubscribe();
		controller.stop();
	});

	it('stops timers and clears tile template when hidden', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(makeFramesPayload('goes-east', ['f1', 'f2']))
		);

		const controller = createCmiRasterLayerController();
		let latest: string | undefined;
		const unsubscribe = controller.tileTemplate.subscribe((value) => {
			latest = value;
		});

		controller.start();
		await flush();
		expect(latest).toBe('/api/imagery/cmi/ch13/tiles/goes-east/f1/{z}/{x}/{y}.png');

		controller.setVisible(false);
		expect(latest).toBeUndefined();
		const fetchCountAtHide = fetchSpy.mock.calls.length;

		vi.advanceTimersByTime(20_000);
		expect(fetchSpy.mock.calls.length).toBe(fetchCountAtHide);

		unsubscribe();
		controller.stop();
	});
});
