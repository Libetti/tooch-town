import { boostPrecipitationIntensity, type PrecipCell } from '$lib/weather/precipitation';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const GRID_STEP_DEGREES = 4;
const GRID_BATCH_SIZE = 150;
const CACHE_TTL_MS = 180_000;
const REQUEST_TIMEOUT_MS = 15_000;

export type PrecipGridResponse = {
	generatedAt: string;
	ttlSeconds: number;
	cells: PrecipCell[];
};

type CacheRecord = {
	expiresAtMs: number;
	value: PrecipGridResponse;
};

let cacheRecord: CacheRecord | null = null;
let inFlightFetch: Promise<PrecipGridResponse> | null = null;

const buildGlobalGrid = (): Array<{ lon: number; lat: number }> => {
	const points: Array<{ lon: number; lat: number }> = [];

	for (let lat = -88; lat <= 88; lat += GRID_STEP_DEGREES) {
		for (let lon = -180; lon <= 176; lon += GRID_STEP_DEGREES) {
			points.push({ lon, lat });
		}
	}

	return points;
};

const GRID_POINTS = buildGlobalGrid();

const chunk = <T>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const parseBatchPayload = (payload: unknown): PrecipCell[] => {
	const rows = Array.isArray(payload) ? payload : [payload];
	const cells: PrecipCell[] = [];

	for (const row of rows) {
		if (!row || typeof row !== 'object') continue;
		const objectRow = row as {
			latitude?: unknown;
			longitude?: unknown;
			current?: { precipitation?: unknown };
			hourly?: { precipitation?: unknown[] };
		};

		const lat = Number(objectRow.latitude);
		const lon = Number(objectRow.longitude);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		let precipitationMmPerHour = Number(objectRow.current?.precipitation);
		if (!Number.isFinite(precipitationMmPerHour)) {
			precipitationMmPerHour = Number(objectRow.hourly?.precipitation?.[0]);
		}
		if (!Number.isFinite(precipitationMmPerHour) || precipitationMmPerHour <= 0) continue;

		cells.push({
			lon,
			lat,
			precipitationMmPerHour,
			visualIntensity: boostPrecipitationIntensity(precipitationMmPerHour)
		});
	}

	return cells;
};

const fetchBatch = async (
	fetchFn: typeof fetch,
	batch: Array<{ lon: number; lat: number }>
): Promise<PrecipCell[]> => {
	const latitudes = batch.map((point) => point.lat).join(',');
	const longitudes = batch.map((point) => point.lon).join(',');
	const query = new URLSearchParams({
		latitude: latitudes,
		longitude: longitudes,
		current: 'precipitation',
		timezone: 'UTC',
		forecast_days: '1'
	});

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetchFn(`${OPEN_METEO_URL}?${query.toString()}`, {
			headers: { accept: 'application/json' },
			signal: controller.signal
		});
		if (!response.ok) return [];
		const payload = await response.json();
		return parseBatchPayload(payload);
	} catch {
		return [];
	} finally {
		clearTimeout(timeout);
	}
};

const fetchAllCells = async (fetchFn: typeof fetch): Promise<PrecipCell[]> => {
	const batches = chunk(GRID_POINTS, GRID_BATCH_SIZE);
	const settled = await Promise.allSettled(batches.map((batch) => fetchBatch(fetchFn, batch)));

	const cells = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

	return cells.sort((a, b) => {
		if (a.lat === b.lat) return a.lon - b.lon;
		return a.lat - b.lat;
	});
};

const fetchPrecipGrid = async (
	fetchFn: typeof fetch,
	nowMs: number
): Promise<PrecipGridResponse> => {
	const cells = await fetchAllCells(fetchFn);
	return {
		generatedAt: new Date(nowMs).toISOString(),
		ttlSeconds: Math.floor(CACHE_TTL_MS / 1000),
		cells
	};
};

export const getPrecipGrid = async (
	fetchFn: typeof fetch,
	nowMs = Date.now()
): Promise<PrecipGridResponse> => {
	if (cacheRecord && cacheRecord.expiresAtMs > nowMs) return cacheRecord.value;
	if (inFlightFetch) return inFlightFetch;

	inFlightFetch = fetchPrecipGrid(fetchFn, nowMs)
		.then((value) => {
			cacheRecord = { expiresAtMs: nowMs + CACHE_TTL_MS, value };
			return value;
		})
		.finally(() => {
			inFlightFetch = null;
		});

	return inFlightFetch;
};

export const clearPrecipGridCacheForTests = (): void => {
	cacheRecord = null;
	inFlightFetch = null;
};

export const __internal = {
	CACHE_TTL_MS,
	GRID_POINTS,
	GRID_BATCH_SIZE
};
