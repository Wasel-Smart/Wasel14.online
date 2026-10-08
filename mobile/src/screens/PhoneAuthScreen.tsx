import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
import { colors, spacing } from '../theme';
import { validatePhone } from '../utils/security';

const RESEND_SECONDS = 30;

export default function PhoneAuthScreen() {
  const { signInWithPhone, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'enter-phone' | 'verify-otp'>('enter-phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Resend countdown — stops users hammering "resend" and tells them when they can.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendOtp = useCallback(async () => {
    setError(null);
    if (!phone.trim()) {
      setError('رقم الهاتف مطلوب.');
      return;
    }
    if (!validatePhone(phone)) {
      setError('يجب أن يكون الرقم بصيغة +962XXXXXXXXX.');
      return;
    }
    setLoading(true);
    try {
      const { error: otpError } = await signInWithPhone(phone);
      if (otpError) {
        setError(otpError.message || 'فشل إرسال رمز التحقق.');
        return;
      }
      setOtp('');
      setStep('verify-otp');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إرسال رمز التحقق.');
    } finally {
      setLoading(false);
    }
  }, [phone, signInWithPhone]);

  const handleVerifyOtp = useCallback(async () => {
    setError(null);
    if (!otp.trim()) {
      setError('رمز التحقق مطلوب.');
      return;
    }
    if (otp.length < 4) {
      setError('يجب أن يتكون رمز التحقق من 4 أرقام على الأقل.');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await verifyOtp(phone, otp);
      if (verifyError) {
        setError(verifyError.message || 'رمز التحقق غير صحيح.');
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحقق.');
    } finally {
      setLoading(false);
    }
  }, [otp, phone, verifyOtp]);

  const isOtpStep = step === 'verify-otp';

  return (
    <ScreenShell
      footer={
        isOtpStep ? (
          <PrimaryButton
            label="تحقق"
            icon="checkmark"
            loading={loading}
            disabled={success || otp.length < 4}
            onPress={handleVerifyOtp}
            testID="verify-otp-button"
          />
        ) : (
          <PrimaryButton
            label="أرسل رمز التحقق"
            icon="paper-plane"
            loading={loading}
            disabled={success || !phone.trim()}
            onPress={sendOtp}
            testID="send-otp-button"
          />
        )
      }
      testID="phone-auth-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          eyebrow={isOtpStep ? 'الخطوة 2 من 2' : 'الخطوة 1 من 2'}
          title={isOtpStep ? 'أدخل رمز التحقق' : 'أدخل رقم هاتفك'}
          body={
            isOtpStep
              ? `أرسلنا رمزًا عبر رسالة نصية إلى ${phone}.`
              : 'سنرسل لك رمز تحقق عبر رسالة نصية لتسجيل الدخول.'
          }
        />

        {error ? (
          <StateNotice
            icon="warning"
            title={isOtpStep ? 'خطأ في التحقق' : 'تعذّر المتابعة'}
            body={error}
            tone={colors.error}
            testID="phone-error"
          />
        ) : null}

        {isOtpStep ? (
          <View style={styles.form}>
            <FormField
              label="رمز التحقق"
              icon="keypad-outline"
              autoComplete="sms-otp"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(v: string) => setOtp(v.replace(/\D/g, ''))}
              onSubmitEditing={handleVerifyOtp}
              placeholder="000000"
              textContentType="oneTimeCode"
              testID="otp-input"
              value={otp}
            />
            {success ? (
              <InfoCard
                icon="checkmark-circle"
                title="تم التحقق بنجاح"
                body="تم تسجيل دخولك عبر الهاتف."
                tone={colors.success}
              />
            ) : null}
            {secondsLeft > 0 ? (
              <StateNotice icon="time-outline" title={`يمكنك إعادة الإرسال بعد ${secondsLeft} ثانية`} tone={colors.info} />
            ) : (
              <TextLink label="أعد إرسال الرمز" onPress={sendOtp} testID="resend-otp-button" />
            )}
            <TextLink
              label="تغيير رقم الهاتف"
              tone={colors.textMuted}
              onPress={() => {
                setError(null);
                setStep('enter-phone');
              }}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <FormField
              label="رقم الهاتف"
              icon="call-outline"
              autoCapitalize="none"
              autoComplete="tel"
              hint="مثال: +962 79 123 4567"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              onSubmitEditing={sendOtp}
              placeholder="+962 79 123 4567"
              textContentType="telephoneNumber"
              testID="phone-input"
              value={phone}
            />
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
});
