import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { Coordinates } from 'maplibre-gl';
import type { RequestHandler } from './$types';

type Satellite = 'goes-east' | 'goes-west';

const isValidSatellite = (value: string): value is Satellite =>
	value === 'goes-east' || value === 'goes-west';

const parseBoundedPositiveInteger = (raw: string | null, max: number): number | undefined => {
	if (raw === null) return undefined;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return undefined;
	return parsed;
};

const parseTimestamp = (raw: string | null): string | undefined => {
	if (!raw) return undefined;
	const parsed = Date.parse(raw);
	if (!Number.isFinite(parsed)) return undefined;
	return new Date(parsed).toISOString();
};

type UpstreamCMIFrameModel = {
	frame_id: string;
	satellite: string;
	start_time: string;
	end_time: string;
	image_url: string;
	coordinates: Coordinates;
};

type UpstreamCMIFramesResponse = {
	satellite: string;
	count: number;
	poll_interval_seconds: number;
	frames: UpstreamCMIFrameModel[];
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

	const start = parseTimestamp(url.searchParams.get('start'));
	if (start === undefined) {
		return json({ error: 'Invalid start value' }, { status: 400 });
	}

	const end = parseTimestamp(url.searchParams.get('end'));
	if (end === undefined) {
		return json({ error: 'Invalid end value' }, { status: 400 });
	}

	if (Date.parse(start) >= Date.parse(end)) {
		return json({ error: 'start must be before end' }, { status: 400 });
	}

	const limit = parseBoundedPositiveInteger(url.searchParams.get('limit'), 1000);
	if (url.searchParams.has('limit') && limit === undefined) {
		return json({ error: 'Invalid limit value' }, { status: 400 });
	}

	const pollHint = parseBoundedPositiveInteger(url.searchParams.get('poll_hint'), 7200);
	if (url.searchParams.has('poll_hint') && pollHint === undefined) {
		return json({ error: 'Invalid poll_hint value' }, { status: 400 });
	}

	const upstreamUrl = new URL(`${apiBaseUrl}/imagery/cmi/ch13/frames`);
	upstreamUrl.searchParams.set('satellite', satellite);
	upstreamUrl.searchParams.set('start', start);
	upstreamUrl.searchParams.set('end', end);
	if (limit !== undefined) upstreamUrl.searchParams.set('limit', String(limit));
	if (pollHint !== undefined) upstreamUrl.searchParams.set('poll_hint', String(pollHint));

	const upstreamResponse = await fetch(upstreamUrl.toString(), {
		headers: { accept: 'application/json' }
	});

	if (!upstreamResponse.ok) {
		let detail: unknown;
		try {
			detail = await upstreamResponse.json();
		} catch {
			detail = undefined;
		}
		return json(
			{ error: 'Failed to fetch CMI frame metadata', status: upstreamResponse.status, detail },
			{ status: upstreamResponse.status }
		);
	}

	const body = (await upstreamResponse.json()) as UpstreamCMIFramesResponse;
	return json({
		...body,
		frames: body.frames.map((frame) => ({
			...frame,
			image_url: `/api/imagery/cmi/ch13/images/${encodeURIComponent(frame.satellite)}/${encodeURIComponent(frame.frame_id)}.png`
		}))
	});
};
