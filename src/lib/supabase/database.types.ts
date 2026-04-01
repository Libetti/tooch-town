export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
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
