import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import {
	DEFAULT_RAIN_LAYER_CONFIG,
	generateRainParticles,
	type PrecipCell,
	type RainAnimationState,
	type RainLayerConfig,
	type RainParticle
} from '$lib/weather/precipitation';

type RainSceneInstance = {
	position: [number, number, number];
	color: [number, number, number, number];
	scale: [number, number, number];
	orientation: [number, number, number];
};

export const buildRainLineLayer = (
	cells: PrecipCell[],
	timeSeconds: number,
	animationState: RainAnimationState,
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG
): ScenegraphLayer<RainSceneInstance> | null => {
	const particles = generateRainParticles(cells, config, timeSeconds, {
		perCellParticleCap: animationState.activePerCellCap,
		minPrecipMmPerHour: animationState.activeMinPrecipMmPerHour
	});

	if (!particles.length) return null;

	const instances = particles.map((particle: RainParticle): RainSceneInstance => {
		const [sourceLon, sourceLat, sourceAlt] = particle.sourcePosition;
		const [targetLon, targetLat, targetAlt] = particle.targetPosition;
		const deltaLon = targetLon - sourceLon;
		const deltaLat = targetLat - sourceLat;
		const deltaAlt = targetAlt - sourceAlt;
		const yaw = (Math.atan2(deltaLon, deltaLat) * 180) / Math.PI;
		const pitch = -Math.min(45, Math.max(-45, (deltaAlt / 45_000) * 32));

		return {
			position: particle.sourcePosition,
			color: particle.color,
			scale: [particle.width * 9_000, particle.width * 9_000, 18_000 + particle.width * 42_000],
			orientation: [pitch, 0, yaw]
		};
	});

	return new ScenegraphLayer<RainSceneInstance>({
		id: 'precipitation-rain-layer',
		data: instances,
		scenegraph: '/models/rain-drop.gltf',
		getPosition: (instance) => instance.position,
		getColor: (instance) => instance.color,
		getScale: (instance) => instance.scale,
		getOrientation: (instance) => instance.orientation,
		sizeScale: 1,
		pickable: false,
		opacity: 0.95,
		updateTriggers: {
			getPosition: timeSeconds,
			getScale: timeSeconds
		}
	});
};
