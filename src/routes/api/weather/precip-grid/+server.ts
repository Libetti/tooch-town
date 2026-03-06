import { json } from '@sveltejs/kit';
import { getPrecipGrid } from '$lib/server/weather/precipGrid';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	const body = await getPrecipGrid(fetch);
	return json(body, {
		headers: {
			'cache-control': 'public, max-age=60'
		}
	});
};
