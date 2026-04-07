import { useAuthStore } from '@/utils/auth/store';
import { signInWithCredentials } from '@/utils/auth/credentialsAuth';
import { Link, Redirect, router } from 'expo-router';
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
  'User already registered': 'This email is already registered. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
};

export default function Signup() {
  const { session, isReady, setSession } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);

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
    setSuccess(null);

    if (!fullName.trim() || !email || !password) {
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
      const data = await signInWithCredentials({
        fullName,
        email,
        password,
        mode: 'signup',
      });

      if (data.session) {
        setSession(data.session);
        router.replace('/');
      } else {
        setSuccess('Check your email to confirm your account, then sign in.');
      }
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
              source={require('../../../assets/images/parkmate-logo.png')}
              style={styles.logoImage}
            />
            <Text style={styles.brand}>
              <Text style={styles.brandPark}>Park</Text>
              <Text style={styles.brandMate}>Mate</Text>
            </Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join drivers sharing real-time parking wins around you.</Text>
          </View>

          <View style={styles.formFields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                value={fullName}
              />
            </View>

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
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}
          {success ? <Text style={styles.successBox}>{success}</Text> : null}

          <Pressable disabled={loading} onPress={onSubmit} style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            Already have an account? <Link href="/accounts/login" style={styles.linkText}>Sign in</Link>
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
    padding: 16,
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
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(2, 132, 199, 0.24)',
  },
  backdropOrbSmall: {
    position: 'absolute',
    bottom: 60,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 28,
    maxWidth: 420,
    padding: 32,
    shadowColor: '#04111d',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoImage: {
    height: 62,
    marginBottom: 10,
    width: 62,
  },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandPark: {
    color: '#0f172a',
  },
  brandMate: {
    color: '#ca8a04',
  },
  title: {
    color: '#082032',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'center',
  },
  formFields: {
    gap: 12,
    marginBottom: 18,
  },
  fieldGroup: {
    marginBottom: 0,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 12,
    borderWidth: 1,
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 18,
    padding: 12,
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#047857',
    fontSize: 14,
    marginBottom: 18,
    padding: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
  linkText: {
    color: '#059669',
    fontWeight: '700',
  },
});
