import type { CreateMusingInput, Musing } from '$lib/musings/types';

type MusingResponse<T> = { data: T; error: null } | { data: null; error: string };

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

const requestMusings = async <T>(
	init: RequestInit,
	fallback: string
): Promise<MusingResponse<T>> => {
	try {
		const headers = new Headers(init.headers);
		if (init.body && !headers.has('content-type')) {
			headers.set('content-type', 'application/json');
		}

		const response = await fetch('/api/musings', {
			...init,
			headers
		});
		const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

		if (!response.ok || !body?.data) {
			return {
				data: null,
				error: body?.error ?? fallback
			};
		}

		return { data: body.data, error: null };
	} catch (error) {
		return { data: null, error: getErrorMessage(error, fallback) };
	}
};

export const listMusings = async (): Promise<MusingResponse<Musing[]>> =>
	requestMusings<Musing[]>(
		{
			method: 'GET'
		},
		'Unable to load musings right now.'
	);

export const createMusing = async (input: CreateMusingInput): Promise<MusingResponse<Musing>> =>
	requestMusings<Musing>(
		{
			method: 'POST',
			body: JSON.stringify({
				title: input.title,
				body: input.body
			})
		},
		'Unable to publish your thought right now.'
	);
