import type { LayerSpecification, Map, RasterTileSource } from 'maplibre-gl';

type WeatherRasterLayerSyncInput = {
	visible: boolean;
	tileTemplate: string | undefined;
};

type WeatherRasterLayerManager = {
	sync: (targetMap: Map, input: WeatherRasterLayerSyncInput) => void;
	clear: (targetMap: Map) => void;
	resetAppliedState: () => void;
};

type WeatherRasterLayerManagerOptions = {
	sourceId?: string;
	layerId?: string;
	beforeLayerId?: string;
	opacity?: number;
	fadeOutZoomStart?: number;
	fadeOutZoomEnd?: number;
};

export const createWeatherRasterLayerManager = ({
	sourceId = 'weather-cmi',
	layerId = 'weather-cmi-layer',
	beforeLayerId,
	opacity = 0.72,
	fadeOutZoomStart = 8,
	fadeOutZoomEnd = 10
}: WeatherRasterLayerManagerOptions = {}): WeatherRasterLayerManager => {
	let appliedVisible: boolean | undefined;
	let appliedTileTemplate: string | undefined;

	const removeLayerArtifacts = (targetMap: Map): void => {
		if (targetMap.getLayer(layerId)) {
			targetMap.removeLayer(layerId);
		}
		if (targetMap.getSource(sourceId)) {
			targetMap.removeSource(sourceId);
		}
	};

	const ensureLayer = (targetMap: Map): void => {
		if (!targetMap.getLayer(layerId) && targetMap.getSource(sourceId)) {
			const layerDefinition: LayerSpecification = {
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': [
						'interpolate',
						['linear'],
						['zoom'],
						fadeOutZoomStart,
						opacity,
						fadeOutZoomEnd,
						0
					],
					'raster-fade-duration': 0
				}
			};
			if (beforeLayerId && targetMap.getLayer(beforeLayerId)) {
				targetMap.addLayer(layerDefinition, beforeLayerId);
				return;
			}
			targetMap.addLayer(layerDefinition);
		}
	};

	const resetAppliedState = (): void => {
		appliedVisible = undefined;
		appliedTileTemplate = undefined;
	};

	const sync = (targetMap: Map, input: WeatherRasterLayerSyncInput): void => {
		const { visible, tileTemplate } = input;
		if (!targetMap.isStyleLoaded()) return;
		if (
			appliedVisible === visible &&
			appliedTileTemplate === tileTemplate &&
			targetMap.getLayer(layerId) !== undefined
		) {
			return;
		}

		if (!visible || !tileTemplate) {
			removeLayerArtifacts(targetMap);
			appliedVisible = visible;
			appliedTileTemplate = tileTemplate;
			return;
		}

		const existingSource = targetMap.getSource(sourceId) as RasterTileSource | undefined;
		if (!existingSource) {
			targetMap.addSource(sourceId, {
				type: 'raster',
				tiles: [tileTemplate],
				tileSize: 256
			});
			ensureLayer(targetMap);
		} else {
			if (appliedTileTemplate !== tileTemplate) {
				existingSource.setTiles([tileTemplate]);
			}
			ensureLayer(targetMap);
		}
		appliedVisible = visible;
		appliedTileTemplate = tileTemplate;
	};

	const clear = (targetMap: Map): void => {
		removeLayerArtifacts(targetMap);
		resetAppliedState();
	};

	return {
		sync,
		clear,
		resetAppliedState
	};
};
