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

const makeFramesPayload = (
	satellite: 'goes-east' | 'goes-west',
	frames: Array<{ frameId: string; offsetMinutes: number }>,
	pollIntervalSeconds = 10
): CMIFramesResponse => ({
	satellite,
	count: frames.length,
	poll_interval_seconds: pollIntervalSeconds,
	frames: frames.map(({ frameId, offsetMinutes }, index) => {
		const startTime = new Date(Date.UTC(2026, 2, 16, 0, offsetMinutes));
		const endTime = new Date(Date.UTC(2026, 2, 16, 0, offsetMinutes + 30));
		return {
			frame_id: frameId,
			satellite,
			start_time: startTime.toISOString(),
			end_time: endTime.toISOString(),
			image_url: `/api/imagery/cmi/ch13/images/${satellite}/${frameId}.png`,
			coordinates: coordinatesFor(index)
		};
	})
});

describe('createCmiRasterLayerController', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('selects the nearest prior frame for the requested time', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(
				makeFramesPayload('goes-east', [
					{ frameId: 'f1', offsetMinutes: 0 },
					{ frameId: 'f2', offsetMinutes: 60 },
					{ frameId: 'f3', offsetMinutes: 120 }
				])
			)
		);

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 1, 30)));
		controller.start();
		await flush();

		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f2.png');

		unsubscribe();
		controller.stop();
	});

	it('falls back to the nearest available frame when no earlier frame exists', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(
				makeFramesPayload('goes-east', [
					{ frameId: 'f1', offsetMinutes: 120 },
					{ frameId: 'f2', offsetMinutes: 180 }
				])
			)
		);

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 0, 0)));
		controller.start();
		await flush();

		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		unsubscribe();
		controller.stop();
	});

	it('updates the published frame when the requested time changes', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(
				makeFramesPayload('goes-east', [
					{ frameId: 'f1', offsetMinutes: 0 },
					{ frameId: 'f2', offsetMinutes: 60 },
					{ frameId: 'f3', offsetMinutes: 120 }
				])
			)
		);

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 0, 0)));
		controller.start();
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 2, 0)));
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f3.png');

		unsubscribe();
		controller.stop();
	});

	it('clears the overlay when the requested time moves into the future beyond the latest frame', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(
				makeFramesPayload('goes-east', [
					{ frameId: 'f1', offsetMinutes: 0 },
					{ frameId: 'f2', offsetMinutes: 60 }
				])
			)
		);

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 0, 0)));
		controller.start();
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 3, 0)));
		expect(latestImageUrl).toBeUndefined();

		unsubscribe();
		controller.stop();
	});

	it('publishes the freshest available CMI time', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			responseJson(
				makeFramesPayload('goes-east', [
					{ frameId: 'f1', offsetMinutes: 0 },
					{ frameId: 'f2', offsetMinutes: 60 }
				])
			)
		);

		const controller = createCmiRasterLayerController();
		let latestAvailableTime: Date | undefined;
		const unsubscribe = controller.latestAvailableTime.subscribe((value) => {
			latestAvailableTime = value;
		});

		controller.start();
		await flush();

		expect(latestAvailableTime?.toISOString()).toBe('2026-03-16T01:00:00.000Z');

		unsubscribe();
		controller.stop();
	});

	it('keeps the last good overlay visible during transient refresh failures', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				responseJson(
					makeFramesPayload(
						'goes-east',
						[
							{ frameId: 'f1', offsetMinutes: 0 },
							{ frameId: 'f2', offsetMinutes: 60 }
						],
						5
					)
				)
			)
			.mockRejectedValueOnce(new Error('network'));

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 0, 30)));
		controller.start();
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		vi.advanceTimersByTime(5_000);
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/f1.png');

		unsubscribe();
		controller.stop();
	});

	it('leaves the overlay empty when the initial load fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

		const controller = createCmiRasterLayerController();
		let latestImageUrl = 'not-empty';
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl ?? '';
		});

		controller.start();
		await flush();
		expect(latestImageUrl).toBe('');

		unsubscribe();
		controller.stop();
	});

	it('switches satellites and resets to the new feed timeline', async () => {
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
					? makeFramesPayload('goes-west', [
							{ frameId: 'w1', offsetMinutes: 0 },
							{ frameId: 'w2', offsetMinutes: 60 }
						])
					: makeFramesPayload('goes-east', [
							{ frameId: 'e1', offsetMinutes: 0 },
							{ frameId: 'e2', offsetMinutes: 60 }
						]);
			return responseJson(payload);
		});

		const controller = createCmiRasterLayerController();
		let latestImageUrl: string | undefined;
		let latestCoordinates: Coordinates | undefined;
		const unsubscribe = controller.overlay.subscribe((value) => {
			latestImageUrl = value?.imageUrl;
			latestCoordinates = value?.coordinates;
		});

		controller.setTime(new Date(Date.UTC(2026, 2, 16, 0, 0)));
		controller.start();
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-east/e1.png');

		controller.setSatellite('goes-west');
		await flush();
		expect(latestImageUrl).toBe('/api/imagery/cmi/ch13/images/goes-west/w1.png');
		expect(latestCoordinates).toEqual(coordinatesFor(0));

		unsubscribe();
		controller.stop();
	});
});
