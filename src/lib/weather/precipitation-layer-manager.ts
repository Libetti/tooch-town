import { PrecipitationLayer } from '@maptiler/weather';
import { createMapTilerWeatherLayerManager } from './maptiler-weather-layer-manager';

export type PrecipitationLayerManagerOptions = {
	layerId?: string;
	beforeLayerId?: string;
	animationFactor?: number;
};

export const createPrecipitationLayerManager = ({
	layerId = 'weather-precipitation',
	beforeLayerId,
	animationFactor = 3600
}: PrecipitationLayerManagerOptions = {}) =>
	createMapTilerWeatherLayerManager({
		layerId,
		layerCtor: PrecipitationLayer,
		beforeLayerId,
		animationFactor
	});
