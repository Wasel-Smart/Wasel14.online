import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, MIN_TOUCH, radii, spacing, typography } from '../theme';

type FormFieldProps = TextInputProps & {
  /** Visible label shown above the input (also used as the accessibility label). */
  label: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** When true renders a show/hide toggle (use with secureTextEntry). */
  revealable?: boolean;
};

/**
 * Labelled text field with a visible focus ring, inline error and optional
 * password reveal. A persistent label (not just a placeholder) is what makes
 * forms usable for first-time users and screen readers.
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, hint, icon, revealable, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = Boolean(secureTextEntry) && !revealed;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          error ? styles.boxError : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          secureTextEntry={hidden}
          style={[styles.input, style]}
          onFocus={(e: unknown) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e: unknown) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            hitSlop={12}
            onPress={() => setRevealed((v) => !v)}
            style={styles.reveal}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...typography.label, color: colors.textSecondary },
  box: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: spacing.md,
  },
  boxFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  boxError: { borderColor: colors.error },
  input: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    minHeight: MIN_TOUCH,
    paddingVertical: 0,
    textAlign: 'auto',
  },
  reveal: { alignItems: 'center', justifyContent: 'center', minHeight: MIN_TOUCH, minWidth: 32 },
  error: { ...typography.caption, color: colors.error },
  hint: { ...typography.caption, color: colors.textMuted },
});

export default FormField;
