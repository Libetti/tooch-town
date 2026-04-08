import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCmiRasterLayerController,
	type CMIFramesResponse
} from './cmi-raster-layer-controller';
import type { Coordinates } from 'maplibre-gl';

const flush = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const responseJson = (payload: unknown) =>
	({
		ok: true,
		json: async () => payload
	}) as Response;

const coordinatesFor = (index: number): Coordinates => [
	[-100 - index, 50 + index],
	[-90 - index, 50 + index],
	[-90 - index, 40 + index],
	[-100 - index, 40 + index]
];

const makeFramesPayload = (satellite: 'goes-east' | 'goes-west', frameIds: string[]): CMIFramesResponse => ({
	satellite,
	count: frameIds.length,
	poll_interval_seconds: 10,
	frames: frameIds.map((frameId, index) => ({
		frame_id: frameId,
		satellite,
		start_time: new Date(Date.UTC(2026, 2, 16, 0, index)).toISOString(),
		end_time: new Date(Date.UTC(2026, 2, 16, 0, index, 30)).toISOString(),
		image_url: `/api/imagery/cmi/ch13/images/${satellite}/${frameId}.png`,
		coordinates: coordinatesFor(index)
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

	it('animates frames oldest-to-newest and then holds on the latest frame', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(makeFramesPayload('goes-east', ['f1', 'f2', 'f3']))
		);

		const controller = createCmiRasterLayerController({
			animationIntervalMs: 700,
			frameLimit: 3
		});
		const observed: Array<string | undefined> = [];
		const unsubscribe = controller.overlay.subscribe((value) => observed.push(value?.imageUrl));

		controller.start();
		await flush();

		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-east/f2.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-east/f3.png');

		vi.advanceTimersByTime(700);
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-east/f3.png');

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
		const unsubscribe = controller.overlay.subscribe((value) => observed.push(value?.imageUrl));

		controller.start();
		await flush();
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-east/e1.png');

		controller.setSatellite('goes-west');
		await flush();
		expect(observed.at(-1)).toBe('/api/imagery/cmi/ch13/images/goes-west/w1.png');

		unsubscribe();
		controller.stop();
	});

	it('stops timers and clears the overlay when hidden', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(makeFramesPayload('goes-east', ['f1', 'f2']))
		);

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.start();
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		controller.setVisible(false);
		expect(latestImageUrl).toBeUndefined();
		const fetchCountAtHide = fetchSpy.mock.calls.length;

		vi.advanceTimersByTime(20_000);
		expect(fetchSpy.mock.calls.length).toBe(fetchCountAtHide);

		unsubscribe();
		controller.stop();
	});

	it('publishes frame coordinates alongside the image URL', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(makeFramesPayload('goes-east', ['f1']))
		);

		const controller = createCmiRasterLayerController();
		let latestCoordinates: Coordinates | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestCoordinates = value?.coordinates;
		});

		controller.start();
		await flush();

		expect(latestCoordinates).toEqual(coordinatesFor(0));

		unsubscribe();
		controller.stop();
	});
});
