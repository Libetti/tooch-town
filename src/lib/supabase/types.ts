import type { Database as GeneratedDatabase } from '$lib/supabase/database.types';

export type Database = GeneratedDatabase;
export type PublicSchema = Database['public'];
export type Tables = PublicSchema['Tables'];

export type TableRow<Name extends keyof Tables> = Tables[Name]['Row'];
export type TableInsert<Name extends keyof Tables> = Tables[Name]['Insert'];
export type TableUpdate<Name extends keyof Tables> = Tables[Name]['Update'];

export type ProfileRow = TableRow<'profiles'>;
export type ProfileInsert = TableInsert<'profiles'>;
export type ProfileUpdate = TableUpdate<'profiles'>;
export type MusingRow = TableRow<'musings'>;
export type MusingInsert = TableInsert<'musings'>;
export type MusingUpdate = TableUpdate<'musings'>;
