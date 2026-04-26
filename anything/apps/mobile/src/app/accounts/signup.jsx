import { useAuthStore } from '@/utils/auth/store';
import { signInWithCredentials } from '@/utils/auth/credentialsAuth';
import { Redirect, router, useNavigation } from 'expo-router';
import { Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  BackHandler,
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
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_PALETTE } from '@/theme/brandColors';
const errorMessages = {
  'User already registered': 'This email is already registered. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
};

export default function Signup() {
  const navigation = useNavigation();
  const { session, isReady, setSession } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);
  const allowScreenExitRef = useRef(false);

  const routeToLogin = useCallback(() => {
    allowScreenExitRef.current = true;
    router.replace('/accounts/login');
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      allowScreenExitRef.current = false;

      const beforeRemoveSubscription = navigation.addListener('beforeRemove', (event) => {
        if (allowScreenExitRef.current) {
          return;
        }

        event.preventDefault();
        routeToLogin();
      });

      const backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
        routeToLogin();
        return true;
      });

      return () => {
        beforeRemoveSubscription();
        backHandlerSubscription.remove();
      };
    }, [navigation, routeToLogin])
  );

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
        allowScreenExitRef.current = true;
        setSession(data.session);
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
      <LinearGradient
        colors={['#061521', '#0B1F33']}
        style={StyleSheet.absoluteFill}
      />
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
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              resizeMode="contain"
              source={require('../../../assets/images/parkmate-logo-current.png')}
              style={styles.logoImage}
            />
          </View>
          <Text style={styles.brand}>
            <Text style={styles.brandPark}>Park</Text>
            <Text style={styles.brandMate}>Mate</Text>
          </Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Join the community of drivers sharing real-time parking wins and map activity.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formFields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setFullName}
                placeholder="Driver Name"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                style={styles.input}
                value={fullName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="driver@parkmate.com"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Secure Password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
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
                    <EyeOff color="rgba(255, 255, 255, 0.5)" size={20} />
                  ) : (
                    <Eye color="rgba(255, 255, 255, 0.5)" size={20} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}
          {success ? <Text style={styles.successBox}>{success}</Text> : null}

          <Pressable disabled={loading} onPress={onSubmit} style={styles.buttonContainer}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text onPress={routeToLogin} style={styles.linkText}>
              Sign in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#061521',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
  },
  scrollContentKeyboard: {
    paddingTop: 40,
  },
  backdropOrbLarge: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
  },
  backdropOrbSmall: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 44,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoImage: {
    height: 52,
    width: 52,
  },
  brand: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  brandPark: {
    color: '#FFFFFF',
  },
  brandMate: {
    color: '#FEF08A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  formFields: {
    gap: 20,
    marginBottom: 28,
  },
  fieldGroup: {
    gap: 10,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordField: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 16,
    paddingVertical: 18,
  },
  passwordToggle: {
    padding: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 20,
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
    padding: 16,
    textAlign: 'center',
    overflow: 'hidden',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 20,
    color: '#6EE7B7',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
    padding: 16,
    textAlign: 'center',
    overflow: 'hidden',
  },
  buttonContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
    marginTop: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  linkText: {
    color: '#10B981',
    fontWeight: '900',
  },
});
