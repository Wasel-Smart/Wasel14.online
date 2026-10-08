import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, hitSlop, MIN_TOUCH, radii, readableTextOn, shadows, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Chevron that points "forward" in both LTR and RTL layouts. */
const forwardChevron: IconName = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

function triggerLightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export const ScreenShell = React.memo(function ScreenShell({
  children,
  footer,
  testID,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.shell}
      testID={testID}
    >
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
});

/**
 * Section heading. `size="lg"` is a screen title; `size="md"` is an in-page
 * section title. (React Native <Text> does not interpret HTML, so no escaping
 * is applied — the old escaping showed literal "&amp;" to users.)
 */
export const SectionHeader = React.memo(function SectionHeader({
  eyebrow,
  title,
  body,
  tone,
  size = 'lg',
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  tone?: string;
  size?: 'lg' | 'md';
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, tone ? { color: tone } : undefined]}>{eyebrow}</Text>
      ) : null}
      <Text accessibilityRole="header" style={size === 'md' ? styles.titleMd : styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
});

export const PremiumPanel = React.memo(function PremiumPanel({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: string;
}) {
  return (
    <View style={[styles.panel, style]} testID={testID}>
      {children}
    </View>
  );
});

export const InfoCard = React.memo(function InfoCard({
  icon,
  title,
  body,
  tone = colors.primary,
  style,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
  /** When provided the card is a real button: pressed state, chevron, haptic. */
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: `${tone}20`, borderColor: `${tone}40` }]}>
        <Ionicons name={icon} size={22} color={tone} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      {onPress ? <Ionicons name={forwardChevron} size={18} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
        style,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
});

export const MetricTile = React.memo(function MetricTile({
  label,
  value,
  tone = colors.textPrimary,
  testID,
}: {
  label: string;
  value: string;
  tone?: string;
  testID?: string;
}) {
  return (
    <View style={styles.metric} testID={testID}>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
});

export const InlineStat = React.memo(function InlineStat({
  label,
  value,
  tone = colors.primary,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={styles.inlineStat}>
      <Text style={[styles.inlineValue, { color: tone }]}>{value}</Text>
      <Text style={styles.inlineLabel}>{label}</Text>
    </View>
  );
});

export const StatusPill = React.memo(function StatusPill({
  label,
  tone = colors.primary,
  icon = 'ellipse',
}: {
  label: string;
  tone?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, { borderColor: `${tone}50`, backgroundColor: `${tone}15` }]}>
      <Ionicons name={icon} size={12} color={tone} />
      <Text style={[styles.pillText, { color: tone }]}>{label}</Text>
    </View>
  );
});

export const RoutePreview = React.memo(function RoutePreview({
  from,
  to,
  eta,
  distance,
  tone = colors.secondary,
}: {
  from: string;
  to: string;
  eta: string;
  distance: string;
  tone?: string;
}) {
  return (
    <View style={styles.routePreview}>
      <View style={styles.routeLine}>
        <View style={[styles.routeDot, { borderColor: tone }]} />
        <View style={[styles.routeConnector, { backgroundColor: `${tone}66` }]} />
        <View style={[styles.routeDot, styles.routeDotFilled, { backgroundColor: tone }]} />
      </View>
      <View style={styles.routeCopy}>
        <View style={styles.routeEndpoints}>
          <Text style={styles.routeCity}>{from}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          <Text style={styles.routeCity}>{to}</Text>
        </View>
        <View style={styles.routeStats}>
          <InlineStat label="وقت الوصول" value={eta} tone={tone} />
          <InlineStat label="المسافة" value={distance} tone={colors.info} />
        </View>
      </View>
    </View>
  );
});

export const StateNotice = React.memo(function StateNotice({
  icon,
  title,
  body,
  tone = colors.primary,
  loading,
  testID,
}: {
  icon: IconName;
  title: string;
  body?: string;
  tone?: string;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderColor: `${tone}40`, backgroundColor: `${tone}15` }]}
      testID={testID}
    >
      <View style={[styles.noticeIcon, { backgroundColor: `${tone}20` }]}>
        {loading ? <ActivityIndicator color={tone} /> : <Ionicons name={icon} size={20} color={tone} />}
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        {body ? <Text style={styles.noticeBody}>{body}</Text> : null}
      </View>
    </View>
  );
});

/**
 * The one button component for the app.
 *  - solid   : the single main action on a screen (brand-filled, readable text)
 *  - outline : secondary actions (social sign-in, alternatives)
 *  - ghost   : tertiary actions
 * Label color is computed from the fill so contrast is always legible.
 */
export function PrimaryButton({
  label,
  icon = 'arrow-forward',
  loading,
  disabled,
  tone = colors.primary,
  variant = 'solid',
  onPress,
  testID,
}: {
  label: string;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  tone?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
}) {
  const isDisabled = Boolean(disabled || loading);

  const handlePress = React.useCallback(
    (event: GestureResponderEvent) => {
      if (isDisabled) return;
      triggerLightHaptic();
      onPress?.(event);
    },
    [isDisabled, onPress],
  );

  const isSolid = variant === 'solid';
  const fill = isSolid ? (isDisabled ? colors.surfaceElevated : tone) : 'transparent';
  const border =
    variant === 'outline' ? (isDisabled ? colors.line : colors.lineStrong) : 'transparent';
  const labelColor = isDisabled
    ? colors.textMuted
    : isSolid
      ? readableTextOn(tone)
      : variant === 'outline'
        ? colors.textPrimary
        : tone;
  const iconColor = isDisabled ? colors.textMuted : isSolid ? readableTextOn(tone) : tone;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(loading), disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={hitSlop}
      onPress={handlePress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        variant === 'ghost' ? styles.buttonGhost : null,
        {
          backgroundColor: fill,
          borderColor: border,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: pressed && !isDisabled ? 0.9 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={isSolid ? readableTextOn(tone) : tone} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: labelColor }]}>{label}</Text>
          <Ionicons name={icon} size={18} color={iconColor} />
        </>
      )}
    </Pressable>
  );
}

/** Inline text link for low-emphasis navigation (e.g. "Forgot password?"). */
export function TextLink({
  label,
  onPress,
  tone = colors.primary,
  testID,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  tone?: string;
  testID?: string;
  align?: 'center' | 'start';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="link"
      hitSlop={hitSlop}
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.link,
        align === 'start' ? styles.linkStart : null,
        pressed ? { opacity: 0.6 } : null,
      ]}
      testID={testID}
    >
      <Text style={[styles.linkText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal rule with a centred caption, e.g. "or continue with". */
export function LabelDivider({ label }: { label: string }) {
  return (
    <View accessible={false} style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function ActionRow({
  destructive,
  icon,
  label,
  onPress,
  value,
}: {
  destructive?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void | Promise<void>;
  value?: string;
}) {
  const tone = destructive ? colors.error : colors.textPrimary;

  const handlePress = React.useCallback(() => {
    triggerLightHaptic();
    void onPress();
  }, [onPress]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={hitSlop}
      onPress={handlePress}
      style={({ pressed }: { pressed: boolean }) => [styles.action, pressed ? styles.actionPressed : null]}
    >
      <Ionicons name={icon} size={18} color={tone} />
      <Text style={[styles.actionText, destructive ? styles.destructiveText : null]}>{label}</Text>
      {value ? <Text style={styles.actionValue}>{value}</Text> : null}
      <Ionicons name={forwardChevron} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  titleMd: {
    ...typography.lead,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  panel: {
    ...shadows.lift,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  card: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 16,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.surface,
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  cardBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metric: {
    ...shadows.card,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 84,
    padding: spacing.md,
  },
  metricValue: {
    ...typography.heading,
    fontWeight: '900',
  },
  metricLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
  },
  inlineStat: {
    gap: 2,
    minWidth: 86,
  },
  inlineValue: {
    ...typography.subtitle,
    fontWeight: '900',
  },
  inlineLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '800',
  },
  routePreview: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  routeLine: {
    alignItems: 'center',
    paddingTop: 3,
    width: 20,
  },
  routeDot: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  routeDotFilled: {
    borderWidth: 0,
  },
  routeConnector: {
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  routeCopy: {
    flex: 1,
    gap: spacing.md,
  },
  routeEndpoints: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  routeCity: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '900',
  },
  routeStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  notice: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  noticeIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  noticeCopy: {
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  noticeBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  buttonGhost: {
    minHeight: MIN_TOUCH,
  },
  buttonText: {
    ...typography.button,
  },
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
  },
  linkStart: {
    alignSelf: 'flex-start',
  },
  linkText: {
    ...typography.body,
    fontWeight: '700',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dividerLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  action: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  actionPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  actionText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '800',
  },
  actionValue: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '800',
  },
  destructiveText: {
    color: colors.error,
  },
});
