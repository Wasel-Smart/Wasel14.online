import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FormField } from '../components/FormField';
import {
  InfoCard,
  PrimaryButton,
  ScreenShell,
  SectionHeader,
  StateNotice,
  TextLink,
} from '../components/MobilePrimitives';
import { useAuth } from '../providers/AuthProvider';
import { colors, radii, spacing, typography } from '../theme';
import { validateEmail, validatePhone } from '../utils/security';

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'phone', string>>;

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: colors.muted };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const map = [
    { score: 0, label: '', color: colors.muted },
    { score: 1, label: 'ضعيفة', color: colors.error },
    { score: 2, label: 'متوسطة', color: colors.warning },
    { score: 3, label: 'جيدة', color: colors.primary },
    { score: 4, label: 'قوية', color: colors.success },
    { score: 5, label: 'ممتازة', color: colors.success },
  ];
  return map[Math.min(score, 5)] ?? { score: 0, label: '', color: colors.muted };
}

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'الاسم الكامل مطلوب.';
    if (!email.trim()) errors.email = 'البريد الإلكتروني مطلوب.';
    else if (!validateEmail(email)) errors.email = 'يرجى إدخال بريد إلكتروني صحيح.';
    if (password.length < 8) errors.password = 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.';
    if (phone.trim() && !validatePhone(phone)) errors.phone = 'يجب أن يكون الرقم بصيغة +962XXXXXXXXX.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim(), phone.trim() || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, phone, signUp]);

  return (
    <ScreenShell
      footer={
        <PrimaryButton
          label="إنشاء حساب"
          icon="person-add"
          loading={loading}
          disabled={success || !name.trim() || !email.trim() || !password}
          onPress={handleSubmit}
          testID="sign-up-button"
        />
      }
      testID="sign-up-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title="أنشئ حسابك في واصل"
          body="رحلات وطرود وشبكات نقل — كل ذلك بحساب واحد."
        />

        {error ? (
          <StateNotice
            icon="warning"
            title="تعذّر إنشاء الحساب"
            body={error}
            tone={colors.error}
            testID="sign-up-error"
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="الاسم الكامل"
            icon="person-outline"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={fieldErrors.name}
            onChangeText={setName}
            onSubmitEditing={() => emailRef.current?.focus()}
            returnKeyType="next"
            blurOnSubmit={false}
            testID="sign-up-name"
            value={name}
          />
          <FormField
            ref={emailRef}
            label="البريد الإلكتروني"
            icon="mail-outline"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="name@example.com"
            error={fieldErrors.email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            returnKeyType="next"
            blurOnSubmit={false}
            testID="sign-up-email"
            value={email}
          />
          <View style={styles.passwordBlock}>
            <FormField
              ref={passwordRef}
              label="كلمة المرور"
              icon="lock-closed-outline"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              hint="8 أحرف على الأقل، ويفضّل إضافة أرقام ورموز."
              error={fieldErrors.password}
              onChangeText={setPassword}
              onSubmitEditing={() => phoneRef.current?.focus()}
              returnKeyType="next"
              blurOnSubmit={false}
              secureTextEntry
              revealable
              testID="sign-up-password"
              value={password}
            />
            {password.length > 0 ? (
              <View accessible accessibilityLabel={`قوة كلمة المرور: ${strength.label}`} style={styles.strengthRow}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      { width: `${(strength.score / 5) * 100}%`, backgroundColor: strength.color },
                    ]}
                  />
                </View>
                {strength.label ? (
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <FormField
            ref={phoneRef}
            label="رقم الهاتف (اختياري)"
            icon="call-outline"
            autoCapitalize="none"
            autoComplete="tel"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="+962 79 123 4567"
            error={fieldErrors.phone}
            onChangeText={setPhone}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            testID="sign-up-phone"
            value={phone}
          />
        </View>

        {success ? (
          <InfoCard
            icon="checkmark-circle"
            title="تم إنشاء الحساب"
            body="تم إنشاء حسابك بنجاح. سجّل دخولك الآن."
            tone={colors.success}
          />
        ) : null}

        <TextLink label="لديك حساب بالفعل؟ سجّل الدخول" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xl },
  form: { gap: spacing.md },
  passwordBlock: { gap: spacing.xs },
  strengthRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  strengthTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  strengthFill: { borderRadius: radii.pill, height: '100%' },
  strengthLabel: { ...typography.caption, fontWeight: '700', minWidth: 48, textAlign: 'right' },
});
