import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Satellite = 'goes-east' | 'goes-west';

const isValidSatellite = (value: string): value is Satellite =>
	value === 'goes-east' || value === 'goes-west';

const parsePositiveInteger = (raw: string | null): number | undefined => {
	if (raw === null) return undefined;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
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

	const limit = parsePositiveInteger(url.searchParams.get('limit'));
	if (url.searchParams.has('limit') && limit === undefined) {
		return json({ error: 'Invalid limit value' }, { status: 400 });
	}

	const pollHint = parsePositiveInteger(url.searchParams.get('poll_hint'));
	if (url.searchParams.has('poll_hint') && pollHint === undefined) {
		return json({ error: 'Invalid poll_hint value' }, { status: 400 });
	}

	const upstreamUrl = new URL(`${apiBaseUrl}/imagery/cmi/ch13/frames`);
	upstreamUrl.searchParams.set('satellite', satellite);
	if (limit !== undefined) upstreamUrl.searchParams.set('limit', String(limit));
	if (pollHint !== undefined) upstreamUrl.searchParams.set('poll_hint', String(pollHint));

	const upstreamResponse = await fetch(upstreamUrl.toString(), {
		headers: { accept: 'application/json' }
	});

	if (!upstreamResponse.ok) {
		return json(
			{ error: 'Failed to fetch CMI frame metadata', status: upstreamResponse.status },
			{ status: upstreamResponse.status }
		);
	}

	const body = await upstreamResponse.json();
	return json(body);
};
