import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FormField } from '../components/FormField';
import {
  PrimaryButton,
  ScreenShell,
  SectionHeader,
  StateNotice,
  TextLink,
} from '../components/MobilePrimitives';
import { useAuth } from '../providers/AuthProvider';
import { colors, spacing } from '../theme';
import { validateEmail } from '../utils/security';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError('أدخل البريد الإلكتروني أولاً.');
      return;
    }
    if (!validateEmail(email)) {
      setError('أدخل بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        setError(resetError.message || 'فشل إعادة تعيين كلمة المرور.');
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور.');
    } finally {
      setLoading(false);
    }
  }, [email, resetPassword]);

  return (
    <ScreenShell
      footer={
        <PrimaryButton
          label="أرسل رابط إعادة التعيين"
          icon="paper-plane"
          loading={loading}
          disabled={success || !email.trim()}
          onPress={handleReset}
          testID="forgot-reset-button"
        />
      }
      testID="forgot-password-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title="نسيت كلمة المرور؟"
          body="أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور."
        />

        {error ? (
          <StateNotice icon="warning" title="تعذّر الإرسال" body={error} tone={colors.error} testID="forgot-error" />
        ) : null}

        {success ? (
          <StateNotice
            icon="checkmark-circle"
            title="تم الإرسال"
            body="إذا كان البريد مسجلاً لدينا، ستصلك رسالة إعادة التعيين خلال دقائق. تحقق أيضًا من مجلد الرسائل غير المرغوب فيها."
            tone={colors.success}
            testID="forgot-success"
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="البريد الإلكتروني"
            icon="mail-outline"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="name@example.com"
            onChangeText={setEmail}
            onSubmitEditing={handleReset}
            returnKeyType="send"
            testID="forgot-email"
            value={email}
          />
        </View>

        <TextLink label="العودة إلى تسجيل الدخول" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xl },
  form: { gap: spacing.md },
});
