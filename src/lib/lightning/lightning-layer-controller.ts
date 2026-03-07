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

const MIN_TTL_SEC = 8;
const ENERGY_LOG10_MIN = -15;
const ENERGY_LOG10_MAX = -11;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeEnergy = (energy: number | null): number => {
	if (typeof energy !== 'number' || !Number.isFinite(energy) || energy <= 0) return 0;
	const energyLog10 = Math.log10(Math.abs(energy));
	return clamp((energyLog10 - ENERGY_LOG10_MIN) / (ENERGY_LOG10_MAX - ENERGY_LOG10_MIN), 0, 1);
};

const scaleFromIntensity = (intensityNorm: number): number => {
	// Keep visible separation between weak/strong strikes even with pixel clamping.
	return 0.6 + intensityNorm * 3.4;
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
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let running = false;

	const publishLayers = (): void => {
		const visibleStrikes = strikes;
		if (visibleStrikes.length === 0) {
			layersStore.set([]);
			return;
		}

		layersStore.set([
			new ScenegraphLayer<LightningStrike>({
				id: 'lightning-scenegraph',
				data: visibleStrikes,
				scenegraph: scenegraphPath,
				pickable: false,
				sizeScale: 1,
				sizeMinPixels: 16,
				sizeMaxPixels: 16,
				getPosition: (strike) => [strike.position[0], strike.position[1], 8_000],
				getOrientation: () => [0,180,30],
				getScale: (strike) => [strike.baseScale, strike.baseScale, strike.baseScale],
				getColor: () => [255, 255, 255, 255],
				_lighting: 'pbr'
			})
		]);
	};

	const mapResponseToStrikes = (
		satellite: Satellite,
		response: LightningRecentResponse
	): LightningStrike[] => {
		const nextStrikes: LightningStrike[] = [];
		const ingestTimeMs = Date.now();

		for (const feature of response.features) {
			const strikeId = `${satellite}:${feature.id}`;
			if (seenStrikeIds.has(strikeId)) continue;

			const parsedFeatureTimeMs = Date.parse(feature.time);
			const timestampMs = Number.isFinite(parsedFeatureTimeMs)
				? Math.min(parsedFeatureTimeMs, ingestTimeMs)
				: ingestTimeMs;
			if (!Number.isFinite(feature.latitude) || !Number.isFinite(feature.longitude)) continue;

			const intensityNorm = normalizeEnergy(feature.energy);
			nextStrikes.push({
				id: strikeId,
				position: [feature.longitude, feature.latitude, 0],
				intensityNorm,
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

		if (additions.length > 0) {
			strikes = [...strikes, ...additions];
		}
		publishLayers();
	};

	const start = (): void => {
		if (running) return;
		running = true;

		void pollLightning();
		pollIntervalId = setInterval(() => {
			void pollLightning();
		}, pollIntervalMs);
	};

	const stop = (): void => {
		running = false;
		if (pollIntervalId !== undefined) {
			clearInterval(pollIntervalId);
			pollIntervalId = undefined;
		}
	};

	return {
		layers: { subscribe: layersStore.subscribe },
		start,
		stop
	};
};
