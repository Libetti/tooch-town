import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GOES_WEST_MOCK from '../../../mocks/goes-west.json';
import GOES_EAST_MOCK from '../../../mocks/goes-east.json';

type Satellite = 'goes-east' | 'goes-west';

type UpstreamStrikeFeature = {
	id: string;
	latitude: number;
	longitude: number;
	time: string;
	energy: number | null;
	confidence?: number;
	qualityFlag?: string;
	source?: string;
};

type UpstreamRecentResponse = {
	satellite: Satellite;
	count: number;
	features: UpstreamStrikeFeature[];
};

type UnifiedStrike = {
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

const SATELLITES: Satellite[] = ['goes-east', 'goes-west'];
const DEFAULT_WINDOW_SECONDS = 120;
const MOCK_LIGHTNING_DATA: Record<Satellite, UpstreamRecentResponse> = {
	'goes-west': GOES_WEST_MOCK as UpstreamRecentResponse,
	'goes-east': GOES_EAST_MOCK as UpstreamRecentResponse
};

const parsePositiveInt = (value: string | null): number | undefined => {
	if (value === null) return undefined;
	if (!/^\d+$/.test(value)) return undefined;
	const numericValue = Number.parseInt(value, 10);
	if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
	return numericValue;
};

const mapUpstreamToUnified = (
	satellite: Satellite,
	payload: UpstreamRecentResponse
): UnifiedStrike[] => {
	if (!Array.isArray(payload.features)) return [];
	return payload.features
		.filter((feature) => Number.isFinite(feature.latitude) && Number.isFinite(feature.longitude))
		.map((feature) => ({
			id: `${satellite}:${feature.id}`,
			satellite,
			latitude: feature.latitude,
			longitude: feature.longitude,
			time: feature.time,
			energy: feature.energy,
			confidence: feature.confidence,
			qualityFlag: feature.qualityFlag,
			source: feature.source
		}));
};

const sortMostRecentFirst = (left: UnifiedStrike, right: UnifiedStrike): number => {
	const leftTime = Date.parse(left.time);
	const rightTime = Date.parse(right.time);
	const leftMs = Number.isFinite(leftTime) ? leftTime : 0;
	const rightMs = Number.isFinite(rightTime) ? rightTime : 0;
	return rightMs - leftMs;
};

export const GET: RequestHandler = async ({ fetch, url }) => {
	const windowSeconds = parsePositiveInt(url.searchParams.get('windowSeconds'));
	if (url.searchParams.has('windowSeconds') && windowSeconds === undefined) {
		return json({ error: 'windowSeconds must be a positive integer' }, { status: 400 });
	}

	const limit = parsePositiveInt(url.searchParams.get('limit'));
	if (url.searchParams.has('limit') && limit === undefined) {
		return json({ error: 'limit must be a positive integer' }, { status: 400 });
	}
	const resolvedWindowSeconds = windowSeconds ?? DEFAULT_WINDOW_SECONDS;

	const apiBaseUrl = env.LIGHTNING_API_BASE_URL?.replace(/\/+$/, '');
	const withResponseShape = (strikes: UnifiedStrike[]) => {
		return json({
			generatedAt: new Date().toISOString(),
			windowSeconds: resolvedWindowSeconds,
			strikes: typeof limit === 'number' ? strikes.slice(0, limit) : strikes
		});
	};

	if (env.MOCK_LIGHTNING === 'true') {
		const combinedMockStrikes = SATELLITES.flatMap((satellite) =>
			mapUpstreamToUnified(satellite, MOCK_LIGHTNING_DATA[satellite])
		).sort(sortMostRecentFirst);
		return withResponseShape(combinedMockStrikes);
	}

	if (!apiBaseUrl) {
		return json({ error: 'LIGHTNING_API_BASE_URL is not configured' }, { status: 500 });
	}

	try {
		const mergedStrikes = (
			await Promise.all(
				SATELLITES.map(async (satellite) => {
					const upstreamUrl = new URL(`${apiBaseUrl}/lightning/recent`);
					upstreamUrl.searchParams.set('satellite', satellite);
					upstreamUrl.searchParams.set('windowSeconds', String(resolvedWindowSeconds));
					if (typeof limit === 'number') upstreamUrl.searchParams.set('limit', String(limit));

					const upstreamResponse = await fetch(upstreamUrl.toString(), {
						headers: { accept: 'application/json' }
					});

					if (!upstreamResponse.ok) {
						throw new Error(String(upstreamResponse.status));
					}

					const body = (await upstreamResponse.json()) as UpstreamRecentResponse;
					return mapUpstreamToUnified(satellite, body);
				})
			)
		)
			.flat()
			.sort(sortMostRecentFirst);

		return withResponseShape(mergedStrikes);
	} catch (error: unknown) {
		const status = Number.parseInt(error instanceof Error ? error.message : '500', 10) || 500;
		return json({ error: 'Failed to fetch lightning data', status }, { status });
	}
};
