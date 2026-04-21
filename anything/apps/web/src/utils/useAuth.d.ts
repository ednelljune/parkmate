declare type AuthCredentialsOptions = {
	email: string;
	password: string;
	callbackUrl?: string;
	redirect?: boolean;
};

declare type OAuthOptions = {
	callbackUrl?: string;
	redirect?: boolean;
};

declare type AuthResult = {
	session?: unknown;
	requiresEmailConfirmation?: boolean;
};

declare function useAuth(): {
	signInWithCredentials(options: AuthCredentialsOptions): Promise<AuthResult>;
	signUpWithCredentials(options: AuthCredentialsOptions): Promise<AuthResult>;
	signInWithGoogle(options?: OAuthOptions): Promise<unknown>;
	signInWithFacebook(options?: OAuthOptions): Promise<unknown>;
	signInWithTwitter(options?: OAuthOptions): Promise<unknown>;
	signOut(): Promise<void>;
};

export default useAuth;
