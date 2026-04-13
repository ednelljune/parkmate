import React from 'react';
import { useState } from 'react';
import useAuth from '@/utils/useAuth';
import logo from '@/__create/parkmate-logo.png';

export default function SignUp() {
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const { signUpWithCredentials } = useAuth();

	const onSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccess(null);

		if (!email || !password) {
			setError('Please fill in all fields');
			setLoading(false);
			return;
		}

		if (password.length < 6) {
			setError('Password must be at least 6 characters');
			setLoading(false);
			return;
		}

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const callbackUrl = urlParams.get('callbackUrl') || '/';

			const result = await signUpWithCredentials({
				email,
				password,
				callbackUrl,
				redirect: true,
			});

			if (result?.requiresEmailConfirmation) {
				setSuccess('Check your email to confirm your account, then sign in.');
				setLoading(false);
			}
		} catch (err) {
			const errorMessages = {
				'User already registered':
					'This email is already registered. Try signing in instead.',
				'Password should be at least 6 characters':
					'Password must be at least 6 characters.',
			};

			setError(
				errorMessages[err.message] || 'Something went wrong. Please try again.',
			);
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-3">
			<form
				noValidate
				onSubmit={onSubmit}
				className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl"
			>
				<div className="mb-5 text-center">
					<img src={logo} alt="ParkMate logo" className="mx-auto h-14 w-14" />
				</div>

				<div className="space-y-3.5">
					<div className="space-y-2">
						<label className="block text-sm font-semibold text-gray-700">
							Email
						</label>
						<input
							required
							name="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="your@email.com"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						/>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-semibold text-gray-700">
							Password
						</label>
						<input
							required
							name="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="At least 6 characters"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						/>
					</div>

					{error && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					)}

					{success && (
						<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
							{success}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
					>
						{loading ? 'Creating account...' : 'Create Account'}
					</button>

					<p className="mt-3 text-center text-sm text-gray-600">
						Already have an account?{' '}
						<a
							href={`/account/signin${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
						>
							Sign in
						</a>
					</p>
				</div>
			</form>
		</div>
	);
}
