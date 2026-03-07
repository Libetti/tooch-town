import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GOES_WEST_MOCK from '../../../mocks/goes-west.json';
import GOES_EAST_MOCK from '../../../mocks/goes-east.json';

const MOCK_LIGHTNING_DATA = { 'goes-west': GOES_WEST_MOCK, 'goes-east': GOES_EAST_MOCK };
const isValidSatellite = (value: string): value is 'goes-east' | 'goes-west' => {
	return value === 'goes-east' || value === 'goes-west';
};

export const GET: RequestHandler = async ({ fetch, url }) => {
	const apiBaseUrl = env.LIGHTNING_API_BASE_URL?.replace(/\/+$/, '');
	if (!apiBaseUrl) {
		return json({ error: 'LIGHTNING_API_BASE_URL is not configured' }, { status: 500 });
	}

	const satellite = url.searchParams.get('satellite') ?? 'goes-east';
	if (!isValidSatellite(satellite)) {
		return json({ error: 'Invalid satellite value' }, { status: 400 });
	}
	if (env.MOCK_LIGHTNING === 'true') {
		return json(MOCK_LIGHTNING_DATA[satellite]);
	}
	const limit = url.searchParams.get('limit');
	const upstreamUrl = new URL(`${apiBaseUrl}/lightning/recent`);
	upstreamUrl.searchParams.set('satellite', satellite);
	if (limit) upstreamUrl.searchParams.set('limit', limit);

	const upstreamResponse = await fetch(upstreamUrl.toString(), {
		headers: { accept: 'application/json' }
	});

	if (!upstreamResponse.ok) {
		return json(
			{ error: 'Failed to fetch lightning data', status: upstreamResponse.status },
			{ status: upstreamResponse.status }
		);
	}

	const body = await upstreamResponse.json();
	return json(body);
};
