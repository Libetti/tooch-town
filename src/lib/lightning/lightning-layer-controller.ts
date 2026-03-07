import type { DeckProps } from '@deck.gl/core';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { writable, type Readable } from 'svelte/store';

type Satellite = 'goes-east' | 'goes-west';

type LightningFeature = {
	id: string;
	latitude: number;
	longitude: number;
	time: string;
	energy: number | null;
};

type LightningRecentResponse = {
	satellite: string;
	count: number;
	features: LightningFeature[];
};

type LightningStrike = {
	id: string;
	position: [number, number, number];
	intensityNorm: number;
	ttlSec: number;
	baseScale: number;
	timestampMs: number;
};

type LightningLayerControllerOptions = {
	apiPath?: string;
	scenegraphPath?: string;
	pollIntervalMs?: number;
	cleanupIntervalMs?: number;
};

type LightningLayerController = {
	layers: Readable<DeckProps['layers']>;
	start: () => void;
	stop: () => void;
};

const MIN_TTL_SEC = 45;
const MAX_TTL_SEC = 180;
const FADE_START_SEC = 15;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeEnergy = (energy: number | null): number => {
	if (typeof energy !== 'number' || !Number.isFinite(energy)) return 0;
	return clamp(Math.log10(Math.abs(energy) + 1) / 4, 0, 1);
};

const ttlFromIntensity = (intensityNorm: number): number => {
	return MIN_TTL_SEC + intensityNorm * (MAX_TTL_SEC - MIN_TTL_SEC);
};

const scaleFromIntensity = (intensityNorm: number): number => {
	// Keep intensity-based relative size while ScenegraphLayer clamps pixel size across zooms.
	return 0.8 + intensityNorm * 1.7;
};

const getStrikeAlpha = (strike: LightningStrike, currentTimeMs: number): number => {
	const ageSec = (currentTimeMs - strike.timestampMs) / 1000;
	if (ageSec <= FADE_START_SEC) return 255;
	if (ageSec >= strike.ttlSec) return 0;

	const fadeDurationSec = Math.max(1, strike.ttlSec - FADE_START_SEC);
	const fadeProgress = (ageSec - FADE_START_SEC) / fadeDurationSec;
	return Math.round(255 * (1 - clamp(fadeProgress, 0, 1)));
};

export const createLightningLayerController = ({
	apiPath = '/api/lightning/recent',
	scenegraphPath = '/models/lightning-bolt.gltf',
	pollIntervalMs = 30_000,
	cleanupIntervalMs = 1_000
}: LightningLayerControllerOptions): LightningLayerController => {
	const layersStore = writable<DeckProps['layers']>([]);

	const normalizedApiPath = apiPath.trim() || '/api/lightning/recent';
	const seenStrikeIds = new Set<string>();

	let strikes: LightningStrike[] = [];
	let nowMs = Date.now();
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let cleanupIntervalId: ReturnType<typeof setInterval> | undefined;
	let running = false;

	const publishLayers = (): void => {
		if (strikes.length === 0) {
			layersStore.set([]);
			return;
		}

		layersStore.set([
			new ScenegraphLayer<LightningStrike>({
				id: 'lightning-scenegraph',
				data: strikes,
				scenegraph: scenegraphPath,
				pickable: false,
				sizeScale: 1,
				sizeMinPixels: 24,
				sizeMaxPixels: 24,
				getPosition: (strike) => [strike.position[0], strike.position[1], 8_000],
				getOrientation: () => [0,180,30],
				getScale: (strike) => [strike.baseScale, strike.baseScale, strike.baseScale],
				getColor: (strike) => [255, 255, 255, getStrikeAlpha(strike, nowMs)],
				_lighting: 'pbr'
			})
		]);
	};

	const removeExpiredStrikes = (referenceTimeMs: number): void => {
		strikes = strikes.filter((strike) => {
			const ageMs = referenceTimeMs - strike.timestampMs;
			return ageMs < strike.ttlSec * 1_000;
		});
	};

	const mapResponseToStrikes = (
		satellite: Satellite,
		response: LightningRecentResponse
	): LightningStrike[] => {
		const nextStrikes: LightningStrike[] = [];

		for (const feature of response.features) {
			const strikeId = `${satellite}:${feature.id}`;
			if (seenStrikeIds.has(strikeId)) continue;

			const timestampMs = Date.parse(feature.time);
			if (!Number.isFinite(timestampMs)) continue;
			if (!Number.isFinite(feature.latitude) || !Number.isFinite(feature.longitude)) continue;

			const intensityNorm = normalizeEnergy(feature.energy);
			nextStrikes.push({
				id: strikeId,
				position: [feature.longitude, feature.latitude, 0],
				intensityNorm,
				ttlSec: ttlFromIntensity(intensityNorm),
				baseScale: scaleFromIntensity(intensityNorm),
				timestampMs
			});
			seenStrikeIds.add(strikeId);
		}

		return nextStrikes;
	};

	const fetchSatelliteStrikes = async (satellite: Satellite): Promise<LightningStrike[]> => {
		const query = new URLSearchParams({ satellite });
		const response = await fetch(`${normalizedApiPath}?${query.toString()}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${satellite} lightning data`);
		}

		const payload = (await response.json()) as LightningRecentResponse;
		return mapResponseToStrikes(satellite, payload);
	};

	const pollLightning = async (): Promise<void> => {
		const requests = await Promise.allSettled([
			fetchSatelliteStrikes('goes-east'),
			fetchSatelliteStrikes('goes-west')
		]);

		const additions: LightningStrike[] = [];
		for (const request of requests) {
			if (request.status === 'fulfilled') additions.push(...request.value);
		}

		nowMs = Date.now();
		if (additions.length > 0) {
			strikes = [...strikes, ...additions];
		}
		removeExpiredStrikes(nowMs);
		publishLayers();
	};

	const start = (): void => {
		if (running) return;
		running = true;

		void pollLightning();
		pollIntervalId = setInterval(() => {
			void pollLightning();
		}, pollIntervalMs);

		cleanupIntervalId = setInterval(() => {
			nowMs = Date.now();
			removeExpiredStrikes(nowMs);
			publishLayers();
		}, cleanupIntervalMs);
	};

	const stop = (): void => {
		running = false;
		if (pollIntervalId !== undefined) {
			clearInterval(pollIntervalId);
			pollIntervalId = undefined;
		}
		if (cleanupIntervalId !== undefined) {
			clearInterval(cleanupIntervalId);
			cleanupIntervalId = undefined;
		}
	};

	return {
		layers: { subscribe: layersStore.subscribe },
		start,
		stop
	};
};
