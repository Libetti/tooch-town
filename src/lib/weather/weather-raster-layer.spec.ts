import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { createWeatherRasterLayerManager } from './weather-raster-layer';

type MockLayer = { id: string };

const createMockMap = () => {
	const layers = new globalThis.Map<string, MockLayer>();
	const sources = new globalThis.Map<string, RasterTileSource>();
	const map = {
		isStyleLoaded: vi.fn(() => true),
		getLayer: vi.fn((layerId: string) => layers.get(layerId)),
		getSource: vi.fn((sourceId: string) => sources.get(sourceId)),
		addLayer: vi.fn((layer: MockLayer) => {
			layers.set(layer.id, layer);
		}),
		addSource: vi.fn((sourceId: string, source: RasterTileSource) => {
			sources.set(sourceId, source);
		}),
		removeLayer: vi.fn((layerId: string) => {
			layers.delete(layerId);
		}),
		removeSource: vi.fn((sourceId: string) => {
			sources.delete(sourceId);
		})
	};

	return {
		map: map as unknown as MapLibreMap,
		mapMock: map,
		layers
	};
};

describe('createWeatherRasterLayerManager', () => {
	it('uses the first available model anchor when inserting the raster layer', () => {
		const { map, mapMock, layers } = createMockMap();
		layers.set('space-battle-layer', { id: 'space-battle-layer' });
		layers.set('moon-orbit-layer', { id: 'moon-orbit-layer' });
		const manager = createWeatherRasterLayerManager({
			layerId: 'weather-cmi-layer',
			beforeLayerId: ['space-battle-layer', 'moon-orbit-layer']
		});

		manager.sync(map, {
			visible: true,
			tileTemplate: '/tiles/{z}/{x}/{y}.png'
		});

		expect(mapMock.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'weather-cmi-layer' }),
			'space-battle-layer'
		);
	});

	it('configures raster source and layer zoom bounds for overscaling', () => {
		const { map, mapMock } = createMockMap();
		const manager = createWeatherRasterLayerManager({
			sourceMinZoom: 2,
			sourceMaxZoom: 2,
			layerMinZoom: 2,
			layerMaxZoom: 4
		});

		manager.sync(map, {
			visible: true,
			tileTemplate: '/tiles/{z}/{x}/{y}.png'
		});

		expect(mapMock.addSource).toHaveBeenCalledWith(
			'weather-cmi',
			expect.objectContaining({
				type: 'raster',
				tileSize: 256,
				minzoom: 2,
				maxzoom: 2
			})
		);
		expect(mapMock.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'weather-cmi-layer',
				minzoom: 2,
				maxzoom: 4
			})
		);
	});
});
