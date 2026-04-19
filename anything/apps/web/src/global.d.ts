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
