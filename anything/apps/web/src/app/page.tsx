import AdminSignInForm from '@/components/admin-sign-in-form';

export default function HomePage() {
	return <AdminSignInForm defaultCallbackUrl="/admin" />;
}
