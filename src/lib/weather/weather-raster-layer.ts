import type { Coordinates, ImageSource, LayerSpecification, Map } from 'maplibre-gl';

type WeatherRasterLayerSyncInput = {
	visible: boolean;
	imageUrl: string | undefined;
	coordinates: Coordinates | undefined;
};

type WeatherRasterLayerManager = {
	sync: (targetMap: Map, input: WeatherRasterLayerSyncInput) => void;
	clear: (targetMap: Map) => void;
	resetAppliedState: () => void;
};

type WeatherRasterLayerManagerOptions = {
	sourceId?: string;
	layerId?: string;
	beforeLayerId?: string | string[];
	opacity?: number;
	fadeOutZoomStart?: number;
	fadeOutZoomEnd?: number;
	layerMinZoom?: number;
	layerMaxZoom?: number;
};

const resolveBeforeLayerId = (
	targetMap: Map,
	beforeLayerId: string | string[] | undefined
): string | undefined => {
	if (!beforeLayerId) return undefined;

	const candidateIds = Array.isArray(beforeLayerId) ? beforeLayerId : [beforeLayerId];
	return candidateIds.find((candidateId) => targetMap.getLayer(candidateId)) ?? undefined;
};

export const createWeatherRasterLayerManager = ({
	sourceId = 'weather-cmi',
	layerId = 'weather-cmi-layer',
	beforeLayerId,
	opacity = 0.72,
	fadeOutZoomStart = 8,
	fadeOutZoomEnd = 10,
	layerMinZoom,
	layerMaxZoom
}: WeatherRasterLayerManagerOptions = {}): WeatherRasterLayerManager => {
	let appliedVisible: boolean | undefined;
	let appliedImageUrl: string | undefined;
	let appliedCoordinates: Coordinates | undefined;

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
				minzoom: layerMinZoom,
				maxzoom: layerMaxZoom,
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
			const beforeId = resolveBeforeLayerId(targetMap, beforeLayerId);
			if (beforeId) {
				targetMap.addLayer(layerDefinition, beforeId);
				return;
			}
			targetMap.addLayer(layerDefinition);
		}
	};

	const resetAppliedState = (): void => {
		appliedVisible = undefined;
		appliedImageUrl = undefined;
		appliedCoordinates = undefined;
	};

	const sync = (targetMap: Map, input: WeatherRasterLayerSyncInput): void => {
		const { visible, imageUrl, coordinates } = input;
		if (!targetMap.isStyleLoaded()) return;
		if (
			appliedVisible === visible &&
			appliedImageUrl === imageUrl &&
			appliedCoordinates === coordinates &&
			targetMap.getLayer(layerId) !== undefined
		) {
			return;
		}

		if (!visible || !imageUrl || !coordinates) {
			removeLayerArtifacts(targetMap);
			appliedVisible = visible;
			appliedImageUrl = imageUrl;
			appliedCoordinates = coordinates;
			return;
		}

		const existingSource = targetMap.getSource(sourceId) as ImageSource | undefined;
		if (!existingSource) {
			targetMap.addSource(sourceId, {
				type: 'image',
				url: imageUrl,
				coordinates
			});
			ensureLayer(targetMap);
		} else {
			if (appliedImageUrl !== imageUrl || appliedCoordinates !== coordinates) {
				existingSource.updateImage({
					url: imageUrl,
					coordinates
				});
			}
			ensureLayer(targetMap);
		}
		appliedVisible = visible;
		appliedImageUrl = imageUrl;
		appliedCoordinates = coordinates;
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
