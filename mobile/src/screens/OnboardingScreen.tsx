import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton, TextLink } from '../components/MobilePrimitives';
import { colors, motion, radii, spacing, typography } from '../theme';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tone: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'car-sport',
    title: 'تنقّل بين المدن بذكاء',
    body: 'شارك الرحلة مع سائقين موثوقين، واحجز مقعدك في ثوانٍ وبسعر عادل.',
    tone: colors.primary,
  },
  {
    icon: 'cube',
    title: 'أرسل طرودك مع المسافرين',
    body: 'وصّل طردك مع رحلات قائمة بالفعل، وتابع حالته خطوة بخطوة حتى التسليم.',
    tone: colors.secondary,
  },
  {
    icon: 'shield-checkmark',
    title: 'أمانك أولاً، دائماً',
    body: 'سائقون موثّقون، ومشاركة مباشرة للرحلة مع من تثق بهم، ودعم متاح عند الحاجة.',
    tone: colors.primary,
  },
];

/**
 * First-run value proposition. Three short slides, always skippable, and the
 * final CTA leads into sign-in. Uses a single-slide-at-a-time layout (not a
 * horizontal pager) so it behaves identically in RTL and LTR.
 */
export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = SLIDES[index] as Slide;
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, fade]);

  const next = useCallback(() => {
    if (isLast) {
      onDone();
    } else {
      setIndex((i) => i + 1);
    }
  }, [isLast, onDone]);

  return (
    <View style={styles.container} testID="onboarding-screen">
      <View style={styles.top}>
        <BrandMark size={44} />
        {!isLast ? (
          <TextLink label="تخطي" onPress={onDone} tone={colors.textMuted} testID="onboarding-skip" />
        ) : (
          <View />
        )}
      </View>

      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.slide, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
      >
        <View style={[styles.iconRing, { borderColor: `${slide.tone}40`, backgroundColor: `${slide.tone}14` }]}>
          <View style={[styles.iconCore, { backgroundColor: `${slide.tone}26` }]}>
            <Ionicons name={slide.icon} size={64} color={slide.tone} />
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {slide.title}
        </Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <View accessible accessibilityLabel={`الخطوة ${index + 1} من ${SLIDES.length}`} style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
        <PrimaryButton
          label={isLast ? 'ابدأ الآن' : 'التالي'}
          icon={isLast ? 'checkmark' : 'arrow-forward'}
          onPress={next}
          testID="onboarding-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    padding: spacing.lg,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slide: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  iconRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 220,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 220,
  },
  iconCore: {
    alignItems: 'center',
    borderRadius: 999,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottom: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: colors.lineStrong,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 26,
  },
});
