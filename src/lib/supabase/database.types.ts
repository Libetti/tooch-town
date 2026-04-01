export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			musings: {
				Row: {
					id: string;
					author_id: string;
					author_label: string;
					title: string | null;
					body: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					author_id: string;
					author_label: string;
					title?: string | null;
					body: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					author_id?: string;
					author_label?: string;
					title?: string | null;
					body?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					id: string;
					username: string;
					username_normalized: string;
					first_name: string;
					last_name: string;
					country: string;
					state: string;
					city: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					username: string;
					username_normalized: string;
					first_name: string;
					last_name: string;
					country: string;
					state: string;
					city: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					username?: string;
					username_normalized?: string;
					first_name?: string;
					last_name?: string;
					country?: string;
					state?: string;
					city?: string;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
