export type PrecipCell = {
	lon: number;
	lat: number;
	precipitationMmPerHour: number;
	visualIntensity: number;
};

export type RainParticle = {
	sourcePosition: [number, number, number];
	targetPosition: [number, number, number];
	color: [number, number, number, number];
	width: number;
	speed: number;
};

export type RainLayerConfig = {
	minPrecipMmPerHour: number;
	perCellParticleCap: number;
	globalParticleCap: number;
	baseAltitudeMeters: number;
	maxAltitudeMeters: number;
	baseLengthMeters: number;
	maxLengthMeters: number;
	minOpacity: number;
	maxOpacity: number;
	windTiltDegrees: number;
	gridStepDegrees: number;
};

export type RainAnimationState = {
	activePerCellCap: number;
	activeMinPrecipMmPerHour: number;
	frameBudgetMs: number;
	lastFrameTimeMs: number;
};

export const DEFAULT_RAIN_LAYER_CONFIG: RainLayerConfig = {
	minPrecipMmPerHour: 0.05,
	perCellParticleCap: 24,
	globalParticleCap: 20_000,
	baseAltitudeMeters: 8_000,
	maxAltitudeMeters: 45_000,
	baseLengthMeters: 2_000,
	maxLengthMeters: 11_000,
	minOpacity: 110,
	maxOpacity: 240,
	windTiltDegrees: 14,
	gridStepDegrees: 4
};

export const createRainAnimationState = (
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG
): RainAnimationState => ({
	activePerCellCap: config.perCellParticleCap,
	activeMinPrecipMmPerHour: config.minPrecipMmPerHour,
	frameBudgetMs: 1000 / 30,
	lastFrameTimeMs: 1000 / 30
});

const clamp = (value: number, min: number, max: number): number => {
	if (value < min) return min;
	if (value > max) return max;
	return value;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const seededHash = (value: string): number => {
	let hash = 1779033703 ^ value.length;
	for (let i = 0; i < value.length; i += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(i), 3432918353);
		hash = (hash << 13) | (hash >>> 19);
	}

	return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = Math.imul(t ^ (t >>> 15), t | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
};

export const boostPrecipitationIntensity = (precipMmPerHour: number): number => {
	if (!Number.isFinite(precipMmPerHour) || precipMmPerHour <= 0) return 0;

	// Heavy dramatic curve: even light rain becomes visible, then saturates gradually.
	const normalized = clamp(precipMmPerHour / 3.5, 0, 1);
	const boosted = Math.pow(normalized, 0.38);
	return clamp(boosted, 0, 1);
};

export const buildFallbackPrecipCells = (): PrecipCell[] => {
	const cells: PrecipCell[] = [];

	for (let lat = -56; lat <= 56; lat += 8) {
		for (let lon = -180; lon <= 180; lon += 8) {
			const waveA = Math.sin(toRadians(lon * 1.7 + lat * 0.9));
			const waveB = Math.cos(toRadians(lon * 0.55 - lat * 2.1));
			const score = waveA * 0.62 + waveB * 0.48;
			if (score < 0.5) continue;

			const strength = clamp((score - 0.5) / 0.5, 0, 1);
			const precipitationMmPerHour = 0.25 + strength * 1.8;
			const visualIntensity = clamp(
				boostPrecipitationIntensity(precipitationMmPerHour) * 1.22,
				0,
				1
			);

			cells.push({
				lon,
				lat,
				precipitationMmPerHour,
				visualIntensity
			});
		}
	}

	return cells;
};

export const updateRainAnimationState = (
	state: RainAnimationState,
	frameTimeMs: number,
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG
): RainAnimationState => {
	const sampledFrame = Number.isFinite(frameTimeMs) ? frameTimeMs : state.frameBudgetMs;
	const smoothedFrame = state.lastFrameTimeMs * 0.75 + sampledFrame * 0.25;

	let activePerCellCap = state.activePerCellCap;
	let activeMinPrecipMmPerHour = state.activeMinPrecipMmPerHour;

	if (smoothedFrame > state.frameBudgetMs * 1.18) {
		if (activePerCellCap > 8) {
			activePerCellCap = Math.max(8, activePerCellCap - 2);
		} else {
			activeMinPrecipMmPerHour = 0.2;
		}
	}

	if (smoothedFrame < state.frameBudgetMs * 0.85) {
		if (activeMinPrecipMmPerHour > config.minPrecipMmPerHour) {
			activeMinPrecipMmPerHour = config.minPrecipMmPerHour;
		} else if (activePerCellCap < config.perCellParticleCap) {
			activePerCellCap = Math.min(config.perCellParticleCap, activePerCellCap + 1);
		}
	}

	return {
		activePerCellCap,
		activeMinPrecipMmPerHour,
		frameBudgetMs: state.frameBudgetMs,
		lastFrameTimeMs: smoothedFrame
	};
};

export const generateRainParticles = (
	cells: PrecipCell[],
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG,
	timeSeconds = 0,
	overrides?: { perCellParticleCap?: number; minPrecipMmPerHour?: number }
): RainParticle[] => {
	if (!cells.length) return [];

	const particles: RainParticle[] = [];
	const perCellCap = overrides?.perCellParticleCap ?? config.perCellParticleCap;
	const minPrecipMmPerHour = overrides?.minPrecipMmPerHour ?? config.minPrecipMmPerHour;
	const halfCell = config.gridStepDegrees / 2;
	const tilt = toRadians(config.windTiltDegrees);

	for (const cell of cells) {
		if (particles.length >= config.globalParticleCap) break;
		if (cell.precipitationMmPerHour < minPrecipMmPerHour) continue;

		const intensity = clamp(
			cell.visualIntensity || boostPrecipitationIntensity(cell.precipitationMmPerHour),
			0,
			1
		);
		if (intensity <= 0) continue;

		const requestedCount = Math.ceil(intensity * perCellCap);
		const count = clamp(requestedCount, 1, perCellCap);
		const altitude =
			config.baseAltitudeMeters +
			intensity * (config.maxAltitudeMeters - config.baseAltitudeMeters);
		const length =
			config.baseLengthMeters + intensity * (config.maxLengthMeters - config.baseLengthMeters);
		const opacity = Math.round(
			config.minOpacity + intensity * (config.maxOpacity - config.minOpacity)
		);

		for (let i = 0; i < count; i += 1) {
			if (particles.length >= config.globalParticleCap) break;

			const rng = mulberry32(seededHash(`${cell.lon}:${cell.lat}:${i}`));
			const lonOffset = (rng() * 2 - 1) * halfCell;
			const latOffset = (rng() * 2 - 1) * halfCell;
			const lon = clamp(cell.lon + lonOffset, -180, 180);
			const lat = clamp(cell.lat + latOffset, -90, 90);

			const speed = 0.35 + intensity * 2.1;
			const cycle = (rng() + timeSeconds * speed * 0.18) % 1;
			const headAltitude = clamp(altitude * (1 - cycle), length * 1.1, altitude);
			const tailAltitude = headAltitude + length;

			const latTilt = (Math.cos(tilt) * length) / 110_574;
			const lonTilt =
				(Math.sin(tilt) * length) / (Math.max(0.05, Math.cos(toRadians(lat))) * 111_320);

			particles.push({
				sourcePosition: [lon, lat, headAltitude],
				targetPosition: [lon + lonTilt, lat + latTilt, tailAltitude],
				color: [122, 185, 255, opacity],
				width: 2.2 + intensity * 2.2,
				speed
			});
		}
	}

	return particles;
};
