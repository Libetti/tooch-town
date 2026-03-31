import type { Musing } from '$lib/musings/types';

export const sampleMusings: Musing[] = [
	{
		id: 'storm-chasing',
		title: 'The map is half the hobby',
		body: 'I keep telling myself I am building tools for practical reasons, but the truth is that I mostly enjoy staring at moving weather layers and pretending I am in a command center.',
		authorLabel: 'Anthony',
		createdAt: '2026-03-27T19:20:00.000Z'
	},
	{
		id: 'garage-projects',
		title: 'Projects should feel a little unnecessary',
		body: 'If a side project is too sensible, I lose interest. The best ones feel like they started from a joke and somehow turned into infrastructure.',
		authorLabel: 'Anthony',
		createdAt: '2026-03-22T13:45:00.000Z'
	},
	{
		id: 'night-flying',
		title: 'Late-night building sessions are suspiciously productive',
		body: 'There is a very specific hour where my standards drop just enough for me to stop overthinking and finally ship the feature.',
		authorLabel: 'Anthony',
		createdAt: '2026-03-15T02:15:00.000Z'
	}
];
