import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getApiBaseUrl,
	getMockLatestPoints,
	parsePositiveInt,
	parseSatellite,
	type UpstreamLatestPointsResponse
} from '../shared';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const satellite = parseSatellite(url.searchParams.get('satellite'));
	if (!satellite) {
		return json({ error: 'satellite must be either goes-east or goes-west' }, { status: 400 });
	}

	const limit = parsePositiveInt(url.searchParams.get('limit'));
	if (url.searchParams.has('limit') && limit === undefined) {
		return json({ error: 'limit must be a positive integer' }, { status: 400 });
	}

	if (env.MOCK_LIGHTNING === 'true') {
		return json(getMockLatestPoints(satellite, limit));
	}

	const apiBaseUrl = getApiBaseUrl();
	if (!apiBaseUrl) {
		return json({ error: 'LIGHTNING_API_BASE_URL is not configured' }, { status: 500 });
	}

	try {
		const upstreamUrl = new URL(`${apiBaseUrl}/lightning/latest-points`);
		upstreamUrl.searchParams.set('satellite', satellite);
		if (typeof limit === 'number') upstreamUrl.searchParams.set('limit', String(limit));

		const upstreamResponse = await fetch(upstreamUrl.toString(), {
			headers: { accept: 'application/json' }
		});

		if (!upstreamResponse.ok) {
			return json(
				{ error: 'Failed to fetch lightning point data', status: upstreamResponse.status },
				{ status: upstreamResponse.status }
			);
		}

		const body = (await upstreamResponse.json()) as UpstreamLatestPointsResponse;
		return json(body);
	} catch {
		return json({ error: 'Failed to fetch lightning point data', status: 500 }, { status: 500 });
	}
};
