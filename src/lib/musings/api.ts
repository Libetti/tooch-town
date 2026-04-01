import type { CreateMusingInput, Musing } from '$lib/musings/types';
import { getSupabaseBrowserClient, hasSupabaseAuthConfig } from '$lib/supabase/client';
import type { MusingInsert, MusingRow } from '$lib/supabase/types';

type MusingResponse<T> = { data: T; error: null } | { data: null; error: string };

type CreateStoredMusingInput = CreateMusingInput & {
	authorId: string;
	authorLabel: string;
};

const mapMusingRow = (row: MusingRow): Musing => ({
	id: row.id,
	title: row.title,
	body: row.body,
	authorLabel: row.author_label,
	createdAt: row.created_at
});

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		typeof error === 'object' &&
		error &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}

	if (error instanceof Error && error.message) return error.message;
	return fallback;
};

export const listMusings = async (): Promise<MusingResponse<Musing[]>> => {
	if (!hasSupabaseAuthConfig) {
		return { data: null, error: 'Supabase auth is not configured.' };
	}

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase
			.from('musings')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			return { data: null, error: getErrorMessage(error, 'Unable to load musings right now.') };
		}

		return { data: data.map(mapMusingRow), error: null };
	} catch (error) {
		return { data: null, error: getErrorMessage(error, 'Unable to load musings right now.') };
	}
};

export const createMusing = async (
	input: CreateStoredMusingInput
): Promise<MusingResponse<Musing>> => {
	if (!hasSupabaseAuthConfig) {
		return { data: null, error: 'Supabase auth is not configured.' };
	}

	const authorLabel = input.authorLabel.trim();
	const body = input.body.trim();
	const title = input.title?.trim() ?? '';

	if (!authorLabel) {
		return { data: null, error: 'We could not determine who is posting this thought.' };
	}

	if (!body) {
		return { data: null, error: 'Write a thought before publishing.' };
	}

	const record: MusingInsert = {
		author_id: input.authorId,
		author_label: authorLabel,
		body,
		title: title || null
	};

	try {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase.from('musings').insert(record).select().single();

		if (error) {
			return {
				data: null,
				error: getErrorMessage(error, 'Unable to publish your thought right now.')
			};
		}

		return { data: mapMusingRow(data), error: null };
	} catch (error) {
		return {
			data: null,
			error: getErrorMessage(error, 'Unable to publish your thought right now.')
		};
	}
};
