import { hasSupabaseAuthConfig } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	hasSupabaseAuthConfig,
	initialCenter: [-75.5663, 39.662] as [number, number]
});
