import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

let browserClient: SupabaseClient<Database> | undefined;

export const hasSupabaseAuthConfig = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY);

export const getSupabaseBrowserClient = () => {
	if (!hasSupabaseAuthConfig) {
		throw new Error('Supabase auth is not configured.');
	}

	if (!browserClient) {
		browserClient = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		});
	}

	return browserClient;
};
