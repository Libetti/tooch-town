import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrecipitationLayerManager } from './precipitation-layer-manager';

type MockLayer = { id: string };

const instances: Array<{
	id: string;
	animate: ReturnType<typeof vi.fn>;
	setAnimationTime: ReturnType<typeof vi.fn>;
	onSourceReadyAsync: ReturnType<typeof vi.fn>;
	getAnimationEndDate: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@maptiler/weather', () => {
	return {
		PrecipitationLayer: class {
			id: string;
			animate = vi.fn();
			setAnimationTime = vi.fn();
			onSourceReadyAsync = vi.fn(async () => {});
			getAnimationEndDate = vi.fn(() => new Date('2026-03-16T06:00:00.000Z'));

			constructor(options?: { id?: string }) {
				this.id = options?.id ?? 'MapTiler Precipitation';
				instances.push(this);
			}
		}
	};
});

const flushAsync = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const createMockMap = () => {
	const layers = new globalThis.Map<string, MockLayer>();
	const map = {
		isStyleLoaded: vi.fn(() => true),
		getLayer: vi.fn((layerId: string) => layers.get(layerId)),
		addLayer: vi.fn((layer: MockLayer) => {
			layers.set(layer.id, layer);
		}),
		removeLayer: vi.fn((layerId: string) => {
			layers.delete(layerId);
		})
	};

	return {
		map: map as unknown as MapLibreMap,
		mapMock: map,
		layers
	};
};

describe('createPrecipitationLayerManager', () => {
	afterEach(() => {
		instances.length = 0;
		vi.clearAllMocks();
	});

	it('adds layer when visible', async () => {
		const { map, mapMock, layers } = createMockMap();
		layers.set('moon-orbit-layer', { id: 'moon-orbit-layer' });
		const manager = createPrecipitationLayerManager({
			layerId: 'weather-precipitation',
			beforeLayerId: 'moon-orbit-layer'
		});

		manager.sync(map, { visible: true });
		await flushAsync();

		expect(mapMock.addLayer).toHaveBeenCalledTimes(1);
		expect(mapMock.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'weather-precipitation' }), 'moon-orbit-layer');
		expect(instances).toHaveLength(1);
	});

	it('prefers the first available model anchor when inserting the layer', async () => {
		const { map, mapMock, layers } = createMockMap();
		layers.set('space-battle-layer', { id: 'space-battle-layer' });
		layers.set('moon-orbit-layer', { id: 'moon-orbit-layer' });
		const manager = createPrecipitationLayerManager({
			layerId: 'weather-precipitation',
			beforeLayerId: ['space-battle-layer', 'moon-orbit-layer']
		});

		manager.sync(map, { visible: true });
		await flushAsync();

		expect(mapMock.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'weather-precipitation' }),
			'space-battle-layer'
		);
	});

	it('does not recreate the layer after repeated no-op sync calls', async () => {
		const { map } = createMockMap();
		const manager = createPrecipitationLayerManager();

		manager.sync(map, { visible: true });
		manager.sync(map, { visible: true });
		await flushAsync();

		expect(instances).toHaveLength(1);
	});

	it('accepts explicit clock time updates when visible', async () => {
		const { map } = createMockMap();
		const manager = createPrecipitationLayerManager();
		const targetTime = new Date('2026-03-16T03:00:00.000Z');

		manager.sync(map, { visible: true, time: targetTime });
		await flushAsync();

		expect(instances[0]?.animate).toHaveBeenCalledWith(0);
		expect(instances[0]?.setAnimationTime).toHaveBeenCalledWith(
			Math.floor(targetTime.getTime() / 1000)
		);
		expect(manager.getAnimationEndDate()?.toISOString()).toBe('2026-03-16T06:00:00.000Z');
	});

	it('pauses and removes layer when hidden', async () => {
		const { map, mapMock } = createMockMap();
		const manager = createPrecipitationLayerManager();

		manager.sync(map, { visible: true });
		await flushAsync();
		const layer = instances[0];
		expect(layer).toBeDefined();

		manager.sync(map, { visible: false });

		expect(layer?.animate).toHaveBeenCalledWith(0);
		expect(mapMock.removeLayer).toHaveBeenCalledWith('weather-precipitation');
	});

	it('re-adds the layer after style reset when still visible', async () => {
		const { map, mapMock, layers } = createMockMap();
		const manager = createPrecipitationLayerManager();

		manager.sync(map, { visible: true });
		await flushAsync();
		expect(mapMock.addLayer).toHaveBeenCalledTimes(1);

		layers.clear();
		manager.resetAppliedState();
		manager.sync(map, { visible: true });
		await flushAsync();

		expect(mapMock.addLayer).toHaveBeenCalledTimes(2);
	});

	it('cleans up active layer state', async () => {
		const { map, mapMock } = createMockMap();
		const manager = createPrecipitationLayerManager();

		manager.sync(map, { visible: true });
		await flushAsync();
		const layer = instances[0];

		manager.clear(map);

		expect(layer?.animate).toHaveBeenCalledWith(0);
		expect(mapMock.removeLayer).toHaveBeenCalledWith('weather-precipitation');
	});
});
