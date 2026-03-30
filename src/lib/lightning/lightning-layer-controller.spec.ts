import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	computeDecayFactor,
	createLightningLayerController,
	normalizeEnergy,
	type LightningStrikePayload
} from './lightning-layer-controller';

type SourceMock = {
	setData: ReturnType<typeof vi.fn>;
	lastData: unknown;
};

type MockMapState = {
	sources: globalThis.Map<string, SourceMock>;
	layers: globalThis.Map<string, LayerSpecification>;
	handlers: globalThis.Map<string, Set<(...args: unknown[]) => void>>;
};

type MockMap = {
	map: MapLibreMap;
	state: MockMapState;
	emit: (eventName: string) => void;
};

const flushAsync = async (): Promise<void> => {
	await vi.advanceTimersByTimeAsync(1);
	await Promise.resolve();
	await Promise.resolve();
};

const buildFramePayload = (satellite: 'goes-east' | 'goes-west', frameId: string) => ({
	frame_id: frameId,
	satellite,
	start_time: '2026-03-16T10:00:00.000Z',
	end_time: '2026-03-16T10:00:20.000Z',
	flash_count: 1,
	updated_at: '2026-03-16T10:00:21.000Z'
});

const buildPointsPayload = (
	satellite: 'goes-east' | 'goes-west',
	features: LightningStrikePayload[],
	frameId = 'frame-1'
) => ({
	frame_id: frameId,
	satellite,
	start_time: '2026-03-16T10:00:00.000Z',
	end_time: '2026-03-16T10:00:20.000Z',
	updated_at: '2026-03-16T10:00:21.000Z',
	count: features.length,
	features
});

const responseJson = (payload: unknown): Response =>
	new Response(JSON.stringify(payload), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});

const createMockMap = (): MockMap => {
	const state: MockMapState = {
		sources: new Map(),
		layers: new Map(),
		handlers: new Map()
	};

	const on = vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
		const existing = state.handlers.get(eventName) ?? new Set();
		existing.add(handler);
		state.handlers.set(eventName, existing);
	});

	const off = vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
		state.handlers.get(eventName)?.delete(handler);
	});

	const mapMock = {
		addSource: vi.fn((sourceId: string) => {
			const source: SourceMock = {
				setData: vi.fn((nextData: unknown) => {
					source.lastData = nextData;
				}),
				lastData: null
			};
			state.sources.set(sourceId, source);
		}),
		getSource: vi.fn((sourceId: string) => state.sources.get(sourceId)),
		removeSource: vi.fn((sourceId: string) => {
			state.sources.delete(sourceId);
		}),
		addLayer: vi.fn((layer: LayerSpecification) => {
			state.layers.set(layer.id, layer);
		}),
		getLayer: vi.fn((layerId: string) => state.layers.get(layerId)),
		removeLayer: vi.fn((layerId: string) => {
			state.layers.delete(layerId);
		}),
		setLayoutProperty: vi.fn(),
		setFilter: vi.fn(),
		moveLayer: vi.fn(),
		on,
		off
	};

	return {
		map: mapMock as unknown as MapLibreMap,
		state,
		emit: (eventName: string) => {
			for (const handler of state.handlers.get(eventName) ?? []) handler();
		}
	};
};

describe('lightning maplibre controller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-16T10:00:00.000Z'));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('normalizes energy and clamps decay factors', () => {
		expect(normalizeEnergy(null)).toBeGreaterThan(0);
		expect(normalizeEnergy(0)).toBeGreaterThan(0);
		expect(normalizeEnergy(1e-11)).toBeCloseTo(1, 5);
		expect(computeDecayFactor(-100, 120_000)).toBe(1);
		expect(computeDecayFactor(60_000, 120_000)).toBeCloseTo(0.5, 5);
		expect(computeDecayFactor(130_000, 120_000)).toBe(0);
	});

	it('adds source/layer and publishes decayed weights', async () => {
		const strike: LightningStrikePayload = {
			id: 'evt-1',
			satellite: 'goes-east',
			latitude: 39.66,
			longitude: -75.56,
			time: '2026-03-16T10:00:00.000Z',
			energy: 2.2e-13
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-1')))
			.mockResolvedValueOnce(responseJson(buildPointsPayload('goes-east', [strike], 'frame-east-1')));
		vi.stubGlobal('fetch', fetchMock);
		const mockMap = createMockMap();
		const controller = createLightningLayerController({
			frameApiPath: '/api/lightning/latest-frame',
			pointsApiPath: '/api/lightning/latest-points',
			pollIntervalMs: 10_000,
			decayWindowMs: 4_000
		});
		controller.setSatelliteFilter('goes-east');

		controller.attach(mockMap.map);
		controller.start();
		await flushAsync();

		expect(mockMap.state.sources.has('lightning-source')).toBe(true);
		expect(mockMap.state.layers.has('lightning-heatmap')).toBe(true);
		expect(mockMap.state.layers.has('lightning-strikes')).toBe(true);
		const source = mockMap.state.sources.get('lightning-source');
		expect(source).toBeDefined();
		const featureCollection = source?.lastData as {
			type: string;
			features: Array<{ properties: { weight: number } }>;
		};
		expect(featureCollection.type).toBe('FeatureCollection');
		expect(featureCollection.features).toHaveLength(1);
		const initialWeight = featureCollection.features[0]?.properties.weight ?? 0;
		expect(initialWeight).toBeGreaterThan(0);

		await vi.advanceTimersByTimeAsync(3_000);
		await flushAsync();

		const nextData = source?.lastData as {
			features: Array<{ properties: { weight: number } }>;
		};
		const laterWeight = nextData.features[0]?.properties.weight ?? 0;
		expect(laterWeight).toBeLessThan(initialWeight);
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'/api/lightning/latest-frame?satellite=goes-east'
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/api/lightning/latest-points?satellite=goes-east&limit=600'
		);
		controller.stop();
	});

	it('fetches points only when the frame id changes', async () => {
		const strike: LightningStrikePayload = {
			id: 'evt-2',
			satellite: 'goes-east',
			latitude: 39.1,
			longitude: -75.1,
			time: '2026-03-16T10:00:00.000Z',
			energy: 8e-14
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-1')))
			.mockResolvedValueOnce(responseJson(buildPointsPayload('goes-east', [strike], 'frame-east-1')))
			.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-1')))
			.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-2')))
			.mockResolvedValueOnce(responseJson(buildPointsPayload('goes-east', [strike], 'frame-east-2')));
		vi.stubGlobal('fetch', fetchMock);
		const mockMap = createMockMap();
		const controller = createLightningLayerController({
			frameApiPath: '/api/lightning/latest-frame',
			pointsApiPath: '/api/lightning/latest-points',
			pollIntervalMs: 1_000,
			decayWindowMs: 10_000
		});
		controller.setSatelliteFilter('goes-east');

		controller.attach(mockMap.map);
		controller.start();
		await flushAsync();
		await vi.advanceTimersByTimeAsync(1_000);
		await flushAsync();
		await vi.advanceTimersByTimeAsync(1_000);
		await flushAsync();

		const source = mockMap.state.sources.get('lightning-source');
		const featureCollection = source?.lastData as { features: unknown[] };
		expect(featureCollection.features).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(5);
		controller.stop();
	});

	it('removes map artifacts on stop', async () => {
		const strike: LightningStrikePayload = {
			id: 'evt-3',
			satellite: 'goes-west',
			latitude: 35.1,
			longitude: -90.2,
			time: '2026-03-16T10:00:00.000Z',
			energy: 5e-14
		};
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(responseJson(buildFramePayload('goes-west', 'frame-west-1')))
				.mockResolvedValueOnce(
					responseJson(buildPointsPayload('goes-west', [strike], 'frame-west-1'))
				)
		);
		const mockMap = createMockMap();
		const controller = createLightningLayerController({
			frameApiPath: '/api/lightning/latest-frame',
			pointsApiPath: '/api/lightning/latest-points',
			pollIntervalMs: 10_000,
			decayWindowMs: 10_000
		});
		controller.setSatelliteFilter('goes-west');

		controller.attach(mockMap.map);
		controller.start();
		await flushAsync();

		controller.stop();
		expect(mockMap.state.layers.has('lightning-heatmap')).toBe(false);
		expect(mockMap.state.layers.has('lightning-strikes')).toBe(false);
		expect(mockMap.state.sources.has('lightning-source')).toBe(false);
	});

	it('rebuilds source/layer after style reload when running', async () => {
		const strike: LightningStrikePayload = {
			id: 'evt-4',
			satellite: 'goes-east',
			latitude: 30,
			longitude: -100,
			time: '2026-03-16T10:00:00.000Z',
			energy: 1.1e-13
		};
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-1')))
				.mockResolvedValueOnce(
					responseJson(buildPointsPayload('goes-east', [strike], 'frame-east-1'))
				)
		);
		const mockMap = createMockMap();
		const controller = createLightningLayerController({
			frameApiPath: '/api/lightning/latest-frame',
			pointsApiPath: '/api/lightning/latest-points',
			pollIntervalMs: 10_000,
			decayWindowMs: 10_000
		});
		controller.setSatelliteFilter('goes-east');

		controller.attach(mockMap.map);
		controller.start();
		await flushAsync();

		mockMap.state.layers.clear();
		mockMap.state.sources.clear();
		mockMap.emit('style.load');

		expect(mockMap.state.layers.has('lightning-heatmap')).toBe(true);
		expect(mockMap.state.layers.has('lightning-strikes')).toBe(true);
		expect(mockMap.state.sources.has('lightning-source')).toBe(true);
		controller.stop();
	});

	it('keeps lightning below the moon layer when that anchor exists', async () => {
		const strike: LightningStrikePayload = {
			id: 'evt-5',
			satellite: 'goes-east',
			latitude: 40,
			longitude: -74,
			time: '2026-03-16T10:00:00.000Z',
			energy: 1.2e-13
		};
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(responseJson(buildFramePayload('goes-east', 'frame-east-1')))
				.mockResolvedValueOnce(
					responseJson(buildPointsPayload('goes-east', [strike], 'frame-east-1'))
				)
		);
		const mockMap = createMockMap();
		mockMap.state.layers.set('moon-orbit-layer', {
			id: 'moon-orbit-layer',
			type: 'custom'
		} as unknown as LayerSpecification);
		const controller = createLightningLayerController({
			frameApiPath: '/api/lightning/latest-frame',
			pointsApiPath: '/api/lightning/latest-points',
			pollIntervalMs: 10_000,
			decayWindowMs: 10_000
		});
		controller.setSatelliteFilter('goes-east');

		controller.attach(mockMap.map);
		controller.start();
		await flushAsync();

		expect(mockMap.map.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'lightning-heatmap' }),
			'moon-orbit-layer'
		);
		expect(mockMap.map.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'lightning-strikes' }),
			'moon-orbit-layer'
		);
		expect(mockMap.map.moveLayer).toHaveBeenCalledWith('lightning-heatmap', 'moon-orbit-layer');
		expect(mockMap.map.moveLayer).toHaveBeenCalledWith('lightning-strikes', 'moon-orbit-layer');
		controller.stop();
	});
});
