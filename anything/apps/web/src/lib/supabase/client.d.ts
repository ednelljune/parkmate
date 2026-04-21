export const isSupabaseConfigured: boolean;
export const supabase: any;

export function getSupabaseBrowserClient(): any;
export function normalizeSupabaseUser(user: any): {
	id: string | null;
	email: string | null;
	name: string | null;
	image: string | null;
} | null;
