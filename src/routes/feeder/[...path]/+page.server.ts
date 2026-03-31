import { error } from '@sveltejs/kit';

export const load = () => {
	error(404, 'Feeder page not found');
};
