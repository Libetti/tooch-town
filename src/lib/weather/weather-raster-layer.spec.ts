import type { Coordinates, ImageSource, Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { createWeatherRasterLayerManager } from './weather-raster-layer';

type MockLayer = { id: string };
type MockImageSource = Pick<ImageSource, 'updateImage'> & {
	type: 'image';
	url: string;
	coordinates: Coordinates;
};

const sampleCoordinates: Coordinates = [
	[-100, 50],
	[-90, 50],
	[-90, 40],
	[-100, 40]
];

const createMockMap = () => {
	const layers = new globalThis.Map<string, MockLayer>();
	const sources = new globalThis.Map<string, MockImageSource>();
	const map = {
		isStyleLoaded: vi.fn(() => true),
		getLayer: vi.fn((layerId: string) => layers.get(layerId)),
		getSource: vi.fn((sourceId: string) => sources.get(sourceId)),
		addLayer: vi.fn((layer: MockLayer) => {
			layers.set(layer.id, layer);
		}),
		addSource: vi.fn((sourceId: string, source: { type: 'image'; url: string; coordinates: Coordinates }) => {
			const imageSource: MockImageSource = {
				...source,
				updateImage: vi.fn((next) => {
					if (next.url) imageSource.url = next.url;
					if (next.coordinates) imageSource.coordinates = next.coordinates;
					return imageSource as ImageSource;
				})
			};
			sources.set(sourceId, imageSource);
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
			imageUrl: '/images/frame-1.png',
			coordinates: sampleCoordinates
		});

		expect(mapMock.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'weather-cmi-layer' }),
			'space-battle-layer'
		);
	});

	it('configures an image source and layer zoom bounds', () => {
		const { map, mapMock } = createMockMap();
		const manager = createWeatherRasterLayerManager({
			layerMinZoom: 2,
			layerMaxZoom: 4
		});

		manager.sync(map, {
			visible: true,
			imageUrl: '/images/frame-1.png',
			coordinates: sampleCoordinates
		});

		expect(mapMock.addSource).toHaveBeenCalledWith(
			'weather-cmi',
			expect.objectContaining({
				type: 'image',
				url: '/images/frame-1.png',
				coordinates: sampleCoordinates
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

	it('updates the existing image source when frame imagery changes', () => {
		const { map, mapMock } = createMockMap();
		const manager = createWeatherRasterLayerManager();

		manager.sync(map, {
			visible: true,
			imageUrl: '/images/frame-1.png',
			coordinates: sampleCoordinates
		});

		const source = mapMock.getSource('weather-cmi') as MockImageSource;
		const nextCoordinates: Coordinates = [
			[-101, 51],
			[-91, 51],
			[-91, 41],
			[-101, 41]
		];

		manager.sync(map, {
			visible: true,
			imageUrl: '/images/frame-2.png',
			coordinates: nextCoordinates
		});

		expect(source.updateImage).toHaveBeenCalledWith({
			url: '/images/frame-2.png',
			coordinates: nextCoordinates
		});
	});
});
