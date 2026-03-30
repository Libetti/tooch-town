import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getApiBaseUrl,
	getMockLatestFrame,
	parseSatellite,
	type UpstreamLatestFrameResponse
} from '../shared';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const satellite = parseSatellite(url.searchParams.get('satellite'));
	if (!satellite) {
		return json({ error: 'satellite must be either goes-east or goes-west' }, { status: 400 });
	}

	if (env.MOCK_LIGHTNING === 'true') {
		return json(getMockLatestFrame(satellite));
	}

	const apiBaseUrl = getApiBaseUrl();
	if (!apiBaseUrl) {
		return json({ error: 'LIGHTNING_API_BASE_URL is not configured' }, { status: 500 });
	}

	try {
		const upstreamUrl = new URL(`${apiBaseUrl}/lightning/latest-frame`);
		upstreamUrl.searchParams.set('satellite', satellite);

		const upstreamResponse = await fetch(upstreamUrl.toString(), {
			headers: { accept: 'application/json' }
		});

		if (!upstreamResponse.ok) {
			return json(
				{ error: 'Failed to fetch lightning frame data', status: upstreamResponse.status },
				{ status: upstreamResponse.status }
			);
		}

		const body = (await upstreamResponse.json()) as UpstreamLatestFrameResponse;
		return json(body);
	} catch {
		return json({ error: 'Failed to fetch lightning frame data', status: 500 }, { status: 500 });
	}
};
