import 'react-router';
declare module '*.jsx' {
	const Component: any;
	export default Component;
	export const meta: any;
	export const links: any;
	export const loader: any;
	export const action: any;
	export const ErrorBoundary: any;
	export const HydrateFallback: any;
	export const headers: any;
}
declare module 'virtual:load-fonts.jsx' {
	export function LoadFonts(): null;
}
declare module 'react-router' {
	interface AppLoadContext {
		// add context properties here
	}
}
declare module 'npm:stripe' {
	import Stripe from 'stripe';
	export default Stripe;
}
declare module '@/utils/useAuth' {
	type AuthCredentialsOptions = {
		email: string;
		password: string;
		callbackUrl?: string;
		redirect?: boolean;
	};

	type OAuthOptions = {
		callbackUrl?: string;
		redirect?: boolean;
	};

	type AuthResult = {
		session?: unknown;
		requiresEmailConfirmation?: boolean;
	};

	export default function useAuth(): {
		signInWithCredentials(options: AuthCredentialsOptions): Promise<AuthResult>;
		signUpWithCredentials(options: AuthCredentialsOptions): Promise<AuthResult>;
		signInWithGoogle(options?: OAuthOptions): Promise<unknown>;
		signInWithFacebook(options?: OAuthOptions): Promise<unknown>;
		signInWithTwitter(options?: OAuthOptions): Promise<unknown>;
		signOut(): Promise<void>;
	};
}
declare module '@/lib/supabase/client' {
	export const isSupabaseConfigured: boolean;
	export const supabase: any;
	export function getSupabaseBrowserClient(): any;
	export function normalizeSupabaseUser(user: any): {
		id: string | null;
		email: string | null;
		name: string | null;
		image: string | null;
	} | null;
}
