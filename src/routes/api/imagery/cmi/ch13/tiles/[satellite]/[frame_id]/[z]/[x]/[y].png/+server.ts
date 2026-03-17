import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Satellite = 'goes-east' | 'goes-west';

const isValidSatellite = (value: string): value is Satellite =>
	value === 'goes-east' || value === 'goes-west';

const isValidTileCoordinate = (value: string): boolean => /^[0-9]+$/.test(value);

const copiedHeaders = [
	'cache-control',
	'content-type',
	'content-length',
	'etag',
	'expires',
	'last-modified'
];

export const GET: RequestHandler = async ({ fetch, params }) => {
	const apiBaseUrl = env.LIGHTNING_API_BASE_URL?.replace(/\/+$/, '');
	if (!apiBaseUrl) {
		return json({ error: 'LIGHTNING_API_BASE_URL is not configured' }, { status: 500 });
	}

	const { satellite, frame_id: frameId, z, x, y } = params;
	if (!satellite || !isValidSatellite(satellite)) {
		return json({ error: 'Invalid satellite value' }, { status: 400 });
	}
	if (!frameId) {
		return json({ error: 'Invalid frame_id value' }, { status: 400 });
	}
	if (!z || !x || !y || !isValidTileCoordinate(z) || !isValidTileCoordinate(x) || !isValidTileCoordinate(y)) {
		return json({ error: 'Invalid tile coordinate' }, { status: 400 });
	}

	const upstreamUrl = new URL(
		`${apiBaseUrl}/imagery/cmi/ch13/tiles/${encodeURIComponent(satellite)}/${encodeURIComponent(frameId)}/${z}/${x}/${y}.png`
	);
	const upstreamResponse = await fetch(upstreamUrl.toString(), {
		headers: { accept: 'image/png' }
	});

	if (!upstreamResponse.ok) {
		return json(
			{ error: 'Failed to fetch CMI tile image', status: upstreamResponse.status },
			{ status: upstreamResponse.status }
		);
	}

	const headers = new Headers();
	for (const headerName of copiedHeaders) {
		const value = upstreamResponse.headers.get(headerName);
		if (value) headers.set(headerName, value);
	}
	if (!headers.has('content-type')) {
		headers.set('content-type', 'image/png');
	}

	return new Response(upstreamResponse.body, {
		status: 200,
		headers
	});
};
