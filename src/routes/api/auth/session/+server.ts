import { json } from '@sveltejs/kit';
import { buildAuthSnapshot } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		return json(await buildAuthSnapshot(cookies));
	} catch {
		return json(
			{
				configured: true,
				session: null,
				profile: null,
				error: 'Unable to load your account right now.'
			},
			{ status: 500 }
		);
	}
};
