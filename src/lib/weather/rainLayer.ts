import { LineLayer } from '@deck.gl/layers';
import {
	DEFAULT_RAIN_LAYER_CONFIG,
	generateRainParticles,
	type PrecipCell,
	type RainAnimationState,
	type RainLayerConfig,
	type RainParticle
} from '$lib/weather/precipitation';

export const buildRainLineLayer = (
	cells: PrecipCell[],
	timeSeconds: number,
	animationState: RainAnimationState,
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG
): LineLayer<RainParticle> | null => {
	const particles = generateRainParticles(cells, config, timeSeconds, {
		perCellParticleCap: animationState.activePerCellCap,
		minPrecipMmPerHour: animationState.activeMinPrecipMmPerHour
	});

	if (!particles.length) return null;

	return new LineLayer<RainParticle>({
		id: 'precipitation-rain-layer',
		data: particles,
		getSourcePosition: (particle) => particle.sourcePosition,
		getTargetPosition: (particle) => particle.targetPosition,
		getColor: (particle) => particle.color,
		getWidth: (particle) => particle.width,
		widthUnits: 'pixels',
		pickable: false,
		opacity: 0.95,
		updateTriggers: {
			getSourcePosition: timeSeconds,
			getTargetPosition: timeSeconds
		}
	});
};
