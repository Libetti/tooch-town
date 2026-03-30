import { env } from '$env/dynamic/private';
import GOES_WEST_MOCK from '../../mocks/goes-west.json';
import GOES_EAST_MOCK from '../../mocks/goes-east.json';

export type Satellite = 'goes-east' | 'goes-west';

export type UpstreamStrikeFeature = {
	id: string;
	latitude: number;
	longitude: number;
	time: string;
	energy: number | null;
	confidence?: number;
	qualityFlag?: string;
	source?: string;
};

export type UpstreamLatestFrameResponse = {
	frame_id: string;
	satellite: Satellite;
	start_time: string;
	end_time: string;
	flash_count: number;
	updated_at: string;
};

export type UpstreamLatestPointsResponse = {
	frame_id: string;
	satellite: Satellite;
	start_time: string;
	end_time: string;
	updated_at: string;
	count: number;
	features: UpstreamStrikeFeature[];
};

type MockLightningPointsResponse = {
	satellite: Satellite;
	count: number;
	features: UpstreamStrikeFeature[];
};

export const SATELLITES: Satellite[] = ['goes-east', 'goes-west'];

const MOCK_LIGHTNING_DATA: Record<Satellite, MockLightningPointsResponse> = {
	'goes-west': GOES_WEST_MOCK as MockLightningPointsResponse,
	'goes-east': GOES_EAST_MOCK as MockLightningPointsResponse
};

export const parsePositiveInt = (value: string | null): number | undefined => {
	if (value === null) return undefined;
	if (!/^\d+$/.test(value)) return undefined;
	const numericValue = Number.parseInt(value, 10);
	if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
	return numericValue;
};

export const parseSatellite = (value: string | null): Satellite | undefined =>
	value === 'goes-east' || value === 'goes-west' ? value : undefined;

export const getApiBaseUrl = (): string | undefined =>
	env.LIGHTNING_API_BASE_URL?.replace(/\/+$/, '');

const getMockFrameMeta = (satellite: Satellite) => {
	const sortedFeatures = [...MOCK_LIGHTNING_DATA[satellite].features]
		.filter((feature) => typeof feature.time === 'string' && feature.time.length > 0)
		.sort((left, right) => Date.parse(left.time) - Date.parse(right.time));

	const firstFeature = sortedFeatures[0];
	const lastFeature = sortedFeatures.at(-1);
	const startTime = firstFeature?.time ?? new Date().toISOString();
	const endTime = lastFeature?.time ?? startTime;
	const compactTimestamp = endTime.replace(/[^0-9A-Za-z]/g, '');

	return {
		frame_id: `mock-${satellite}-${compactTimestamp}`,
		start_time: startTime,
		end_time: endTime,
		updated_at: endTime,
		flash_count: sortedFeatures.length
	};
};

export const getMockLatestFrame = (satellite: Satellite): UpstreamLatestFrameResponse => ({
	satellite,
	...getMockFrameMeta(satellite)
});

export const getMockLatestPoints = (
	satellite: Satellite,
	limit?: number
): UpstreamLatestPointsResponse => {
	const frameMeta = getMockFrameMeta(satellite);
	const features =
		typeof limit === 'number'
			? MOCK_LIGHTNING_DATA[satellite].features.slice(0, limit)
			: MOCK_LIGHTNING_DATA[satellite].features;

	return {
		...frameMeta,
		satellite,
		count: features.length,
		features
	};
};
