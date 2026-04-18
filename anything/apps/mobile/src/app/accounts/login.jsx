import { useAuthStore } from '@/utils/auth/store';
import { signInWithCredentials } from '@/utils/auth/credentialsAuth';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
const errorMessages = {
  'Invalid login credentials': 'Incorrect email or password. Try again or reset your password.',
  'Email not confirmed': 'Check your inbox and confirm your email address before signing in.',
  'Auth session missing!': 'Sign-in did not complete. Please try again.',
};

export default function Login() {
  const params = useLocalSearchParams();
  const { session, isReady, setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);
  const confirmed = Array.isArray(params.confirmed) ? params.confirmed[0] : params.confirmed;
  const showConfirmedMessage = confirmed === '1' || confirmed === 'true';

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
      });
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  if (session) {
    return <Redirect href="/" />;
  }

  const onSubmit = async () => {
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const data = await signInWithCredentials({
        email: normalizedEmail,
        password,
        mode: 'signin',
      });

      setSession(data.session);
      router.replace('/');
    } catch (submitError) {
      setError(
        errorMessages[submitError?.message] ||
          submitError?.message ||
          'Something went wrong. Please try again.'
      );
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <View style={styles.backdropOrbLarge} />
      <View style={styles.backdropOrbSmall} />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible ? styles.scrollContentKeyboard : null,
        ]}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Image
              resizeMode="contain"
              source={require('../../../assets/images/parkmate-logo-current.png')}
              style={styles.logoImage}
            />
            <Text style={styles.brand}>
              <Text style={styles.brandPark}>Park</Text>
              <Text style={styles.brandMate}>Mate</Text>
            </Text>
            <Text style={styles.subtitle}>Jump back into live spots, timers, and local alerts.</Text>
          </View>

          <View style={styles.formFields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.passwordToggle}
                >
                  {showPassword ? (
                    <EyeOff color="#6b7280" size={18} />
                  ) : (
                    <Eye color="#6b7280" size={18} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}
          {showConfirmedMessage ? (
            <Text style={styles.successBox}>Email confirmed. Sign in to continue.</Text>
          ) : null}

          <Pressable disabled={loading} onPress={onSubmit} style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            Don't have an account? <Link href="/accounts/signup" style={styles.linkText}>Sign up</Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#082032',
    overflow: 'hidden',
    padding: 18,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingBottom: 24,
  },
  backdropOrbLarge: {
    position: 'absolute',
    top: -80,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(2, 132, 199, 0.24)',
  },
  backdropOrbSmall: {
    position: 'absolute',
    bottom: 70,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 24,
    maxWidth: 380,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: '#04111d',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoImage: {
    height: 58,
    marginBottom: 10,
    width: 58,
  },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  brandPark: {
    color: '#0f172a',
  },
  brandMate: {
    color: '#ca8a04',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  formFields: {
    gap: 12,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 0,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordField: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    paddingLeft: 14,
    paddingRight: 12,
  },
  passwordInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  passwordToggle: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginLeft: 10,
    width: 24,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 12,
    borderWidth: 1,
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 12,
    padding: 11,
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#047857',
    fontSize: 13,
    marginBottom: 12,
    padding: 11,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
  linkText: {
    color: '#059669',
    fontWeight: '700',
  },
});
