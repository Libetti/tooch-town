import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

type Satellite = 'goes-east' | 'goes-west';

export type LightningStrikePayload = {
	id: string;
	satellite: Satellite;
	latitude: number;
	longitude: number;
	time: string;
	energy: number | null;
	confidence?: number;
	qualityFlag?: string;
	source?: string;
};

type LightningRecentResponse = {
	generatedAt: string;
	windowSeconds: number;
	strikes: LightningStrikePayload[];
};

type BufferedLightningStrike = {
	id: string;
	position: [number, number];
	baseWeight: number;
	eventTimeMs: number;
	bornAtMs: number;
};

type LightningFeature = {
	type: 'Feature';
	geometry: {
		type: 'Point';
		coordinates: [number, number];
	};
	properties: {
		id: string;
		weight: number;
		baseWeight: number;
	};
};

type LightningFeatureCollection = {
	type: 'FeatureCollection';
	features: LightningFeature[];
};

type MapLibreGeoJsonSource = {
	setData: (data: LightningFeatureCollection) => void;
};

type LightningLayerControllerOptions = {
	apiPath?: string;
	pollIntervalMs?: number;
	decayWindowMs?: number;
	limit?: number;
	maxBufferedStrikes?: number;
};

type LightningLayerController = {
	attach: (map: MapLibreMap) => void;
	start: () => void;
	stop: () => void;
};

const LIGHTNING_SOURCE_ID = 'lightning-source';
const LIGHTNING_LAYER_ID = 'lightning-heatmap';
const ENERGY_LOG10_MIN = -15.5;
const ENERGY_LOG10_MAX = -11;
const ENERGY_FLOOR_WEIGHT = 0.05;
const FADE_TICK_MS = 2_500;
const DEFAULT_DECAY_WINDOW_MS = 120_000;
const DEFAULT_LIMIT = 600;
const DEFAULT_MAX_BUFFERED_STRIKES = 900;

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const emptyFeatureCollection = (): LightningFeatureCollection => ({
	type: 'FeatureCollection',
	features: []
});

const buildHeatmapLayer = (): LayerSpecification => ({
	id: LIGHTNING_LAYER_ID,
	type: 'heatmap',
	source: LIGHTNING_SOURCE_ID,
	paint: {
		'heatmap-weight': ['coalesce', ['get', 'weight'], 0],
		'heatmap-intensity': 1.25,
		'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 2, 14, 5, 22],
		'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.65, 4, 0.85],
		'heatmap-color': [
			'interpolate',
			['linear'],
			['heatmap-density'],
			0,
			'rgba(0, 24, 66, 0)',
			0.2,
			'rgba(20, 80, 155, 0.45)',
			0.4,
			'rgba(77, 152, 205, 0.65)',
			0.6,
			'rgba(240, 196, 77, 0.8)',
			0.8,
			'rgba(255, 127, 45, 0.92)',
			1,
			'rgba(255, 63, 32, 1)'
		]
	}
});

export const normalizeEnergy = (energy: number | null): number => {
	if (typeof energy !== 'number' || !Number.isFinite(energy) || energy <= 0)
		return ENERGY_FLOOR_WEIGHT;
	const energyLog10 = Math.log10(Math.abs(energy));
	return (
		clamp((energyLog10 - ENERGY_LOG10_MIN) / (ENERGY_LOG10_MAX - ENERGY_LOG10_MIN), 0, 1) ||
		ENERGY_FLOOR_WEIGHT
	);
};

export const computeDecayFactor = (ageMs: number, decayWindowMs: number): number => {
	if (decayWindowMs <= 0) return 0;
	return clamp(1 - ageMs / decayWindowMs, 0, 1);
};

export const createLightningLayerController = ({
	apiPath = '/api/lightning/recent',
	pollIntervalMs = 15_000,
	decayWindowMs = DEFAULT_DECAY_WINDOW_MS,
	limit = DEFAULT_LIMIT,
	maxBufferedStrikes = DEFAULT_MAX_BUFFERED_STRIKES
}: LightningLayerControllerOptions): LightningLayerController => {
	const normalizedApiPath = apiPath.trim() || '/api/lightning/recent';
	const normalizedDecayWindowMs = Math.max(5_000, decayWindowMs);

	let strikesById = new globalThis.Map<string, BufferedLightningStrike>();
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let fadeIntervalId: ReturnType<typeof setInterval> | undefined;
	let mapRef: MapLibreMap | undefined;
	let styleLoadHandler: (() => void) | undefined;
	let running = false;

	const getSource = (): MapLibreGeoJsonSource | undefined => {
		if (!mapRef) return undefined;
		return mapRef.getSource(LIGHTNING_SOURCE_ID) as unknown as MapLibreGeoJsonSource | undefined;
	};

	const ensureMapArtifacts = (): void => {
		if (!mapRef) return;
		if (!mapRef.getSource(LIGHTNING_SOURCE_ID)) {
			mapRef.addSource(LIGHTNING_SOURCE_ID, {
				type: 'geojson',
				data: emptyFeatureCollection()
			});
		}
		if (!mapRef.getLayer(LIGHTNING_LAYER_ID)) {
			mapRef.addLayer(buildHeatmapLayer());
		}
	};

	const removeMapArtifacts = (): void => {
		if (!mapRef) return;
		if (mapRef.getLayer(LIGHTNING_LAYER_ID)) {
			mapRef.removeLayer(LIGHTNING_LAYER_ID);
		}
		if (mapRef.getSource(LIGHTNING_SOURCE_ID)) {
			mapRef.removeSource(LIGHTNING_SOURCE_ID);
		}
	};

	const toBufferedStrike = (
		strike: LightningStrikePayload,
		nowMs: number
	): BufferedLightningStrike | undefined => {
		if (!Number.isFinite(strike.latitude) || !Number.isFinite(strike.longitude)) return undefined;
		const id =
			strike.id.trim() ||
			`${strike.satellite}:${strike.longitude}:${strike.latitude}:${strike.time}`;
		const parsedTimeMs = Date.parse(strike.time);
		const eventTimeMs = Number.isFinite(parsedTimeMs) ? Math.min(parsedTimeMs, nowMs) : nowMs;
		return {
			id,
			position: [strike.longitude, strike.latitude],
			baseWeight: normalizeEnergy(strike.energy),
			eventTimeMs,
			bornAtMs: nowMs
		};
	};

	const upsertStrikes = (incomingStrikes: LightningStrikePayload[]): void => {
		const nowMs = Date.now();
		for (const incomingStrike of incomingStrikes) {
			const nextStrike = toBufferedStrike(incomingStrike, nowMs);
			if (!nextStrike) continue;
			const existing = strikesById.get(nextStrike.id);
			if (!existing || nextStrike.eventTimeMs > existing.eventTimeMs) {
				strikesById.set(nextStrike.id, nextStrike);
			}
		}

		if (strikesById.size > maxBufferedStrikes) {
			const oldestFirst = [...strikesById.values()].sort((a, b) => a.bornAtMs - b.bornAtMs);
			const overflowCount = strikesById.size - maxBufferedStrikes;
			for (let index = 0; index < overflowCount; index += 1) {
				const oldestStrike = oldestFirst[index];
				if (oldestStrike) strikesById.delete(oldestStrike.id);
			}
		}
	};

	const removeExpiredStrikes = (nowMs: number): void => {
		for (const [strikeId, strike] of strikesById.entries()) {
			const ageMs = Math.max(0, nowMs - strike.bornAtMs);
			if (ageMs >= normalizedDecayWindowMs) {
				strikesById.delete(strikeId);
			}
		}
	};

	const publishSourceData = (): void => {
		const nowMs = Date.now();
		removeExpiredStrikes(nowMs);
		const source = getSource();
		if (!source) return;

		const features: LightningFeature[] = [];
		for (const strike of strikesById.values()) {
			const ageMs = Math.max(0, nowMs - strike.bornAtMs);
			const decayedWeight = strike.baseWeight * computeDecayFactor(ageMs, normalizedDecayWindowMs);
			if (decayedWeight <= 0) continue;
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: strike.position },
				properties: { id: strike.id, weight: decayedWeight, baseWeight: strike.baseWeight }
			});
		}

		source.setData({
			type: 'FeatureCollection',
			features
		});
	};

	const fetchRecentStrikes = async (): Promise<LightningStrikePayload[]> => {
		const query = new URLSearchParams({
			windowSeconds: String(Math.round(normalizedDecayWindowMs / 1000))
		});
		if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
			query.set('limit', String(Math.floor(limit)));
		}
		const response = await fetch(`${normalizedApiPath}?${query.toString()}`);
		if (!response.ok) {
			throw new Error('Failed to fetch lightning heatmap data');
		}

		const payload = (await response.json()) as LightningRecentResponse;
		if (!Array.isArray(payload.strikes)) return [];
		return payload.strikes;
	};

	const pollLightning = async (): Promise<void> => {
		try {
			const incomingStrikes = await fetchRecentStrikes();
			if (incomingStrikes.length > 0) {
				upsertStrikes(incomingStrikes);
			}
		} catch {
			// Keep rendering existing decaying strikes if polling temporarily fails.
		}
		publishSourceData();
	};

	const attach = (map: MapLibreMap): void => {
		if (mapRef === map) return;
		if (mapRef && styleLoadHandler) mapRef.off('style.load', styleLoadHandler);
		mapRef = map;
		styleLoadHandler = () => {
			if (!running) return;
			ensureMapArtifacts();
			publishSourceData();
		};
		mapRef.on('style.load', styleLoadHandler);
		if (running) {
			ensureMapArtifacts();
			publishSourceData();
		}
	};

	const start = (): void => {
		if (running) return;
		running = true;

		ensureMapArtifacts();
		void pollLightning();
		pollIntervalId = setInterval(() => {
			void pollLightning();
		}, pollIntervalMs);
		fadeIntervalId = setInterval(() => {
			publishSourceData();
		}, FADE_TICK_MS);
	};

	const stop = (): void => {
		running = false;
		if (pollIntervalId !== undefined) {
			clearInterval(pollIntervalId);
			pollIntervalId = undefined;
		}
		if (fadeIntervalId !== undefined) clearInterval(fadeIntervalId);
		fadeIntervalId = undefined;
		strikesById = new globalThis.Map<string, BufferedLightningStrike>();
		const source = getSource();
		source?.setData(emptyFeatureCollection());
		removeMapArtifacts();
	};

	return {
		attach,
		start,
		stop
	};
};
