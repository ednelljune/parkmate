'use client';

import { useState } from 'react';
import useAuth from '@/utils/useAuth';
import logo from '@/__create/parkmate-logo.png';

export default function SignIn() {
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const { signInWithCredentials } = useAuth();

	const onSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		if (!email || !password) {
			setError('Please fill in all fields');
			setLoading(false);
			return;
		}

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const callbackUrl = urlParams.get('callbackUrl') || '/';

			await signInWithCredentials({
				email,
				password,
				callbackUrl,
				redirect: true,
			});
		} catch (err) {
			const errorMessages = {
				'Invalid login credentials':
					'Incorrect email or password. Try again or reset your password.',
				'Email not confirmed':
					'Check your inbox and confirm your email address before signing in.',
				'Auth session missing!':
					'Sign-in did not complete. Please try again.',
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
							placeholder="Enter your password"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						/>
					</div>

					{error && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
					>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>

					<p className="mt-3 text-center text-sm text-gray-600">
						Don't have an account?{' '}
						<a
							href={`/account/signup${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
						>
							Sign up
						</a>
					</p>
				</div>
			</form>
		</div>
	);
}
