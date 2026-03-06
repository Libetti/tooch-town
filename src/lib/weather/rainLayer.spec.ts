import { describe, expect, it } from 'vitest';
import { buildRainLineLayer } from './rainLayer';
import {
	createRainAnimationState,
	DEFAULT_RAIN_LAYER_CONFIG,
	type PrecipCell
} from './precipitation';

describe('buildRainLineLayer', () => {
	it('returns a line layer when precipitation cells exist', () => {
		const cells: PrecipCell[] = [
			{ lon: -75, lat: 39, precipitationMmPerHour: 1.3, visualIntensity: 0.85 }
		];

		const layer = buildRainLineLayer(
			cells,
			120,
			createRainAnimationState(DEFAULT_RAIN_LAYER_CONFIG),
			DEFAULT_RAIN_LAYER_CONFIG
		);

		expect(layer).not.toBeNull();
		expect(layer?.id).toBe('precipitation-rain-layer');
	});

	it('returns null for empty or no-rain data', () => {
		const empty = buildRainLineLayer(
			[],
			120,
			createRainAnimationState(DEFAULT_RAIN_LAYER_CONFIG),
			DEFAULT_RAIN_LAYER_CONFIG
		);
		expect(empty).toBeNull();

		const noRain = buildRainLineLayer(
			[{ lon: -75, lat: 39, precipitationMmPerHour: 0.01, visualIntensity: 0 }],
			120,
			createRainAnimationState(DEFAULT_RAIN_LAYER_CONFIG),
			DEFAULT_RAIN_LAYER_CONFIG
		);
		expect(noRain).toBeNull();
	});
});
