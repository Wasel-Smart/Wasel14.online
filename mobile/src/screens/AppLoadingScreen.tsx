import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { BrandMark } from '../components/BrandMark';
import { colors, motion, spacing, typography } from '../theme';

const AppLoadingScreen = React.memo(function AppLoadingScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, rise]);

  return (
    <View
      accessibilityLabel="جاري تجهيز تطبيق واصل"
      accessibilityLiveRegion="polite"
      style={styles.container}
      testID="app-loading-screen"
    >
      <StatusBar style="light" />
      <Animated.View style={[styles.center, { opacity, transform: [{ translateY: rise }] }]}>
        <BrandMark size={96} />
        <Text style={styles.title}>واصل</Text>
        <Text style={styles.subtitle}>نجهّز رحلتك بأمان</Text>
      </Animated.View>
      <ActivityIndicator color={colors.primary} size="small" style={styles.loader} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  center: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.display.fontSize,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  loader: {
    marginTop: spacing.xxl,
  },
});

export default AppLoadingScreen;
