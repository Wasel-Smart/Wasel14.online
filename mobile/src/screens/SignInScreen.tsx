import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BrandMark } from '../components/BrandMark';
import { FormField } from '../components/FormField';
import {
  LabelDivider,
  PrimaryButton,
  ScreenShell,
  StateNotice,
  TextLink,
} from '../components/MobilePrimitives';
import { useAuth } from '../providers/AuthProvider';
import { useLanguage } from '../contexts/LanguageContext';
import { biometricAuth } from '../services/biometricAuth';
import { colors, spacing, typography } from '../theme';
import { validateEmail } from '../utils/security';

const MAX_SIGNIN_ATTEMPTS = 5;
const SIGNIN_WINDOW_MS = 60_000;

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

declare global {
  var __signinRateLimit: Record<string, RateLimitRecord> | undefined;
}

function checkSignInRateLimit(email: string): boolean {
  const key = `signin:${email}`;
  const now = Date.now();
  const store = global.__signinRateLimit ?? {};
  const record = store[key];
  if (!record || now > record.resetAt) {
    global.__signinRateLimit = { ...store, [key]: { count: 1, resetAt: now + SIGNIN_WINDOW_MS } };
    return true;
  }
  record.count += 1;
  if (record.count > MAX_SIGNIN_ATTEMPTS) {
    return false;
  }
  return true;
}

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  PhoneAuth: undefined;
};

type AuthNavProp = NativeStackNavigationProp<AuthStackParamList>;

const SignInScreen = React.memo(function SignInScreen() {
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<AuthNavProp>();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    void biometricAuth.initialize().then(() => {
      // Only offer biometrics when this user has actually enabled them for Wasel;
      // device capability alone would lead to a silent failure on tap.
      setBiometricAvailable(biometricAuth.isSupported() && biometricAuth.isEnabled());
    });
  }, []);

  const busy = loading || oauthLoading !== null || biometricLoading;

  const handleBiometricSignIn = useCallback(async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const success = await biometricAuth.signInWithBiometrics();
      if (!success) {
        setError('فشل التحقق البيومتري.');
      }
    } catch {
      setError('حدث خطأ أثناء التحقق البيومتري.');
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  const handleSignIn = useCallback(async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (!validateEmail(email)) {
      setError('أدخل بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    if (!checkSignInRateLimit(email)) {
      setError('محاولات كثيرة جدًا. انتظر دقيقة قبل المحاولة مرة أخرى.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.signInErrorBody');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, t]);

  const handleGoogle = useCallback(async () => {
    setOauthLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.googleError');
      setError(message);
    } finally {
      setOauthLoading(null);
    }
  }, [signInWithGoogle, t]);

  const handleFacebook = useCallback(async () => {
    setOauthLoading('facebook');
    setError(null);
    try {
      await signInWithFacebook();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.facebookError');
      setError(message);
    } finally {
      setOauthLoading(null);
    }
  }, [signInWithFacebook, t]);

  return (
    <ScreenShell
      footer={
        <>
          <PrimaryButton
            label={t('auth.signInButton')}
            icon="log-in"
            loading={loading}
            disabled={!email.trim() || !password.trim() || busy}
            onPress={handleSignIn}
            testID="sign-in-button"
          />
          <View style={styles.signUpRow}>
            <Text style={styles.signUpPrompt}>ليس لديك حساب؟</Text>
            <TextLink
              label="أنشئ حسابًا"
              onPress={() => navigation.navigate('SignUp')}
              testID="sign-up-link"
            />
          </View>
        </>
      }
      testID="sign-in-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BrandMark size={56} />
          <Text accessibilityRole="header" style={styles.title}>
            مرحبًا بعودتك
          </Text>
          <Text style={styles.subtitle}>سجّل الدخول لمتابعة رحلاتك وطرودك.</Text>
        </View>

        <View style={styles.form}>
          <FormField
            label={t('auth.emailLabel')}
            icon="mail-outline"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="name@example.com"
            returnKeyType="next"
            blurOnSubmit={false}
            testID="email-input"
            value={email}
          />
          <FormField
            ref={passwordRef}
            label={t('auth.passwordLabel')}
            icon="lock-closed-outline"
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
            placeholder="••••••••"
            returnKeyType="done"
            secureTextEntry
            revealable
            testID="password-input"
            value={password}
          />
          <TextLink
            label="نسيت كلمة المرور؟"
            align="start"
            onPress={() => navigation.navigate('ForgotPassword')}
            testID="forgot-password-link"
          />
        </View>

        {error ? (
          <StateNotice
            icon="warning"
            title={t('auth.signInError')}
            body={error}
            tone={colors.error}
            testID="sign-in-error"
          />
        ) : null}

        <LabelDivider label="أو تابع باستخدام" />

        <View style={styles.social}>
          {biometricAvailable ? (
            <PrimaryButton
              label="تسجيل الدخول بالبصمة"
              icon="finger-print"
              variant="outline"
              loading={biometricLoading}
              disabled={busy}
              onPress={handleBiometricSignIn}
              testID="biometric-sign-in-button"
            />
          ) : null}
          <PrimaryButton
            label={t('auth.continueWithGoogle')}
            icon="logo-google"
            variant="outline"
            loading={oauthLoading === 'google'}
            disabled={busy}
            onPress={handleGoogle}
            testID="google-sign-in-button"
          />
          <View style={styles.socialRow}>
            <View style={styles.socialCell}>
              <PrimaryButton
                label="الهاتف"
                icon="phone-portrait"
                variant="outline"
                disabled={busy}
                onPress={() => navigation.navigate('PhoneAuth')}
                testID="phone-sign-in-button"
              />
            </View>
            <View style={styles.socialCell}>
              <PrimaryButton
                label="فيسبوك"
                icon="logo-facebook"
                variant="outline"
                loading={oauthLoading === 'facebook'}
                disabled={busy}
                onPress={handleFacebook}
                testID="facebook-sign-in-button"
              />
            </View>
          </View>
        </View>

        <View accessible style={styles.trust}>
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
            <Text style={styles.trustText}>{t('auth.secureSession')}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
});

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xl },
  brand: { alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.sm },
  title: { ...typography.heading, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  social: { gap: spacing.sm },
  socialRow: { flexDirection: 'row', gap: spacing.sm },
  socialCell: { flex: 1 },
  signUpRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  signUpPrompt: { ...typography.body, color: colors.textSecondary },
  trust: { alignItems: 'center' },
  trustRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  trustText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});

export default SignInScreen;
