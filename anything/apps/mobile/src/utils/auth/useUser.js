import { useCallback } from 'react';
import { useAuth } from './useAuth';

export const useUser = () => {
	const { user, isReady } = useAuth();
	const fetchUser = useCallback(async () => {
		return user;
	}, [user]);
	return { user, data: user, loading: !isReady, refetch: fetchUser };
};

export default useUser;
