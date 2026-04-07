import { useCallback } from 'react';
import { useSupabaseAuth } from './supabase-auth';

export const useUser = () => {
	const { user, isLoading } = useSupabaseAuth();
	const refetch = useCallback(async () => user, [user]);

	return {
		user,
		data: user,
		loading: isLoading,
		refetch,
	};
};

export default useUser;
