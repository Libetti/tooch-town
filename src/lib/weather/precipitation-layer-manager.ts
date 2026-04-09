import { PrecipitationLayer } from '@maptiler/weather';
import { createMapTilerWeatherLayerManager } from './maptiler-weather-layer-manager';

export type PrecipitationLayerManagerOptions = {
	layerId?: string;
	beforeLayerId?: string | string[];
};

export const createPrecipitationLayerManager = ({
	layerId = 'weather-precipitation',
	beforeLayerId
}: PrecipitationLayerManagerOptions = {}) =>
	createMapTilerWeatherLayerManager({
		layerId,
		layerCtor: PrecipitationLayer,
		beforeLayerId
	});
