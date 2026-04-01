import { json } from '@sveltejs/kit';
import { getAuthErrorMessage, jsonSupabaseConfigError } from '$lib/server/auth';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	loadCurrentProfileRow,
	loadSupabaseSession
} from '$lib/server/supabase';
import type { MusingInsert, MusingRow } from '$lib/supabase/types';
import type { RequestHandler } from './$types';

type CreateMusingBody = {
	title?: string | null;
	body?: string;
};

const mapMusingRow = (row: MusingRow) => ({
	id: row.id,
	title: row.title,
	body: row.body,
	authorLabel: row.author_label,
	createdAt: row.created_at
});

export const GET: RequestHandler = async () => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase
			.from('musings')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			return json(
				{ error: getAuthErrorMessage(error, 'Unable to load musings right now.') },
				{ status: 500 }
			);
		}

		return json({ data: data.map(mapMusingRow) });
	} catch {
		return json({ error: 'Unable to load musings right now.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: CreateMusingBody;

	try {
		body = (await request.json()) as CreateMusingBody;
	} catch {
		return json({ error: 'Invalid musing payload.' }, { status: 400 });
	}

	const title = body.title?.trim() ?? '';
	const text = body.body?.trim() ?? '';

	if (!text) {
		return json({ error: 'Write a thought before publishing.' }, { status: 400 });
	}

	const { session, client } = await loadSupabaseSession(cookies);
	if (!session?.user || !client) {
		return json({ error: 'Sign in before publishing a thought.' }, { status: 401 });
	}

	try {
		const profileRow = await loadCurrentProfileRow(client, session.user.id);
		const record: MusingInsert = {
			author_id: session.user.id,
			author_label:
				profileRow?.username?.trim() || session.user.email || session.user.phone || 'Account',
			body: text,
			title: title || null
		};

		const { data, error } = await client.from('musings').insert(record).select().single();
		if (error) {
			return json(
				{ error: getAuthErrorMessage(error, 'Unable to publish your thought right now.') },
				{ status: 400 }
			);
		}

		return json({ data: mapMusingRow(data) });
	} catch (error) {
		return json(
			{ error: getAuthErrorMessage(error, 'Unable to publish your thought right now.') },
			{ status: 500 }
		);
	}
};
