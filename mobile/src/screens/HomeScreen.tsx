import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { InfoCard, ScreenShell, SectionHeader } from '../components/MobilePrimitives';
import { RideCard, type RideCardProps } from '../components/domain/RideCard';
import { useOffline } from '../hooks/useOffline';
import { useAuth } from '../providers/AuthProvider';
import { rideLifecycle, type AvailableTrip } from '../services/ride';
import { colors, MIN_TOUCH, radii, shadows, spacing, typography } from '../theme';

type RootStackParamList = {
  Tabs: undefined;
  Safety: undefined;
  Trips: undefined;
  Bus: undefined;
  Driver: undefined;
  Notifications: undefined;
  LiveTracking: { rideId: string };
  Chat: { rideId: string; driverName: string };
  RateRide: { rideId: string; driverName: string };
  AdvancedSearch: undefined;
  SignIn: undefined;
  Map: undefined;
  Networks: undefined;
  Wallet: undefined;
  ScheduledRide: undefined;
  Packages: undefined;
  TrustCenter: undefined;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'صباح الخير،';
  if (hour >= 12 && hour < 18) return 'نهارك سعيد،';
  return 'مساء الخير،';
}

// --- Skeleton Loader ---
const HomeSkeleton = React.memo(() => (
  <View style={styles.skeletonContainer} accessible accessibilityLabel="جارٍ تحميل الشاشة الرئيسية">
    <View style={styles.skeletonHeader}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonTextBlock}>
        <View style={styles.skeletonLineShort} />
        <View style={styles.skeletonLineLong} />
      </View>
    </View>
    <View style={styles.skeletonCard} />
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonCardSmall} />
      <View style={styles.skeletonCardSmall} />
      <View style={styles.skeletonCardSmall} />
      <View style={styles.skeletonCardSmall} />
    </View>
    <View style={styles.skeletonCard} />
    <View style={styles.skeletonCard} />
  </View>
));

// --- Header ---
const HomeHeader = React.memo(({
  displayName,
  avatarUrl,
  unreadCount,
  onNotificationsPress,
}: {
  displayName: string;
  avatarUrl?: string | null;
  unreadCount: number;
  onNotificationsPress: () => void;
}) => (
  <View style={styles.homeHeader}>
    {avatarUrl ? (
      <Image
        style={styles.avatar}
        source={{ uri: avatarUrl }}
        accessible
        accessibilityLabel={`صورة ${displayName}`}
      />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback]} accessibilityElementsHidden>
        <Ionicons name="person" size={24} color={colors.primary} />
      </View>
    )}
    <View style={styles.headerText}>
      <Text style={styles.welcomeText}>{greetingForNow()}</Text>
      <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
    </View>
    <Pressable
      style={styles.notificationButton}
      onPress={onNotificationsPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `${unreadCount} إشعارات غير مقروءة` : 'الإشعارات'}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
      {unreadCount > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>
            {unreadCount > 9 ? '9+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </Pressable>
  </View>
));

// --- Smart Search (navigates to AdvancedSearch on tap) ---
const SmartSearch = React.memo(({ onPress }: { onPress: () => void }) => (
  <Pressable
    style={({ pressed }: { pressed: boolean }) => [styles.searchContainer, pressed && styles.searchContainerPressed]}
    onPress={onPress}
    accessible
    accessibilityRole="button"
    accessibilityLabel="إلى أين تريد أن تذهب؟ ابحث عن وجهة"
    testID="home-search"
  >
    <SectionHeader eyebrow="ابدأ رحلتك" title="إلى أين تريد أن تذهب؟" size="md" />
    <View style={styles.searchInputs}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>من</Text>
        <Text style={styles.inputField}>موقعي الحالي</Text>
      </View>
      <View style={styles.inputSeparator} />
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>إلى</Text>
        <Text style={[styles.inputField, styles.inputFieldPlaceholder]}>ابحث عن وجهة...</Text>
      </View>
    </View>
    <View style={styles.searchCta}>
      <Text style={styles.searchCtaText}>ابحث الآن</Text>
      <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
    </View>
  </Pressable>
));

// --- Quick Action ---
const QuickActionCard = React.memo(({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) => (
  <Pressable
    style={({ pressed }: { pressed: boolean }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    onPress={onPress}
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.quickActionIcon}>
      <Ionicons name={icon} size={26} color={colors.primary} />
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={2}>{label}</Text>
  </Pressable>
));

const quickActions: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: keyof RootStackParamList;
}> = [
  { label: 'ابحث عن رحلة', icon: 'search-outline', screen: 'AdvancedSearch' },
  { label: 'أرسل طرد', icon: 'cube-outline', screen: 'Packages' },
  { label: 'اعرض رحلة', icon: 'add-circle-outline', screen: 'Driver' },
  { label: 'الخريطة', icon: 'map-outline', screen: 'Map' },
];

// --- Popular route (live from API; hidden when nothing is available) ---
const RecommendedRideSection = React.memo(({
  trip,
  onReserve,
}: {
  trip: AvailableTrip | null;
  onReserve: () => void;
}) => {
  if (!trip) return null;

  const rideCardProps: RideCardProps = {
    driver: {
      name: trip.driver.name,
      rating: trip.driver.rating,
      isVerified: trip.driver.verified,
    },
    trip: {
      from: trip.from,
      to: trip.to,
      departureTime: trip.time,
      availableSeats: trip.seats,
    },
    onReserve,
    onPress: onReserve,
  };

  return (
    <View style={styles.recommendationSection}>
      <SectionHeader
        eyebrow="مسار شائع"
        title="رحلات متاحة الآن"
        body="احجز مقعدك قبل أن تمتلئ الرحلة."
        size="md"
      />
      <RideCard {...rideCardProps} />
    </View>
  );
});

// --- Main Screen ---

const HomeScreen = React.memo(() => {
  const { user, loading } = useAuth();
  const { isOnline } = useOffline();
  const navigation = useNavigation<NavProp>();
  const [recommendedTrip, setRecommendedTrip] = useState<AvailableTrip | null>(null);

  const displayName = useMemo(
    () => user?.user_metadata?.name || user?.email?.split('@')[0] || 'صديقي',
    [user?.email, user?.user_metadata?.name],
  );

  // Load a popular-route trip from the API on mount (real data, not mock)
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    rideLifecycle.searchTrips('عمّان', 'العقبة', 1)
      .then(trips => {
        if (!cancelled && trips.length > 0) setRecommendedTrip(trips[0] ?? null);
      })
      .catch(() => { /* No recommendation available — section simply stays hidden */ });
    return () => { cancelled = true; };
  }, [isOnline]);

  const goSearch = useCallback(() => navigation.navigate('AdvancedSearch'), [navigation]);
  const goNotifications = useCallback(() => navigation.navigate('Notifications'), [navigation]);

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <ScreenShell testID="home-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HomeHeader
          displayName={displayName}
          avatarUrl={user?.user_metadata?.avatar_url}
          unreadCount={0}
          onNotificationsPress={goNotifications}
        />

        <SmartSearch onPress={goSearch} />

        <View style={styles.quickActionsContainer}>
          {quickActions.map(action => (
            <QuickActionCard
              key={action.screen}
              label={action.label}
              icon={action.icon}
              onPress={() => navigation.navigate(action.screen as never)}
            />
          ))}
        </View>

        <RecommendedRideSection trip={recommendedTrip} onReserve={goSearch} />

        <SectionHeader
          eyebrow="خدمات واصل"
          title="كل ما تحتاجه للتنقل والتوصيل"
          size="md"
        />

        <View style={styles.infoCardsContainer}>
          <InfoCard
            icon="car-sport"
            title="مشاوير موثوقة"
            body="اعثر على مشوار مناسب وتابع الرحلة حتى الوصول."
            tone={colors.primary}
            onPress={goSearch}
          />
          <InfoCard
            icon="cube"
            title="توصيل طرود مع تتبع"
            body="أنشئ طلب توصيل وتابع حالة الطرد حتى التسليم."
            tone={colors.primary}
            onPress={() => navigation.navigate('Packages' as never)}
          />
          <InfoCard
            icon="git-network"
            title="شبكة وخطوط مشتركة"
            body="استعرض الخطوط والمجموعات النشطة لخيارات نقل أكثر."
            tone={colors.secondary}
            onPress={() => navigation.navigate('Networks')}
          />
          <InfoCard
            icon="shield-checkmark"
            title="مركز الأمان"
            body="مشاركة الرحلة والوصول السريع للمساعدة عند الحاجة."
            tone={colors.secondary}
            onPress={() => navigation.navigate('Safety')}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
});

const SKELETON_BG = colors.surfaceElevated;

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  // Header
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  welcomeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  displayName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  notificationButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    end: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },

  // Search
  searchContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadows.lift,
  },
  searchContainerPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  searchInputs: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  inputGroup: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 4,
  },
  inputField: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inputFieldPlaceholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  inputSeparator: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: spacing.md,
  },
  searchCta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  searchCtaText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },

  // Quick actions
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickActionPressed: {
    backgroundColor: colors.surfaceElevated,
    transform: [{ scale: 0.98 }],
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Recommendation
  recommendationSection: {
    gap: spacing.md,
  },

  // Info cards
  infoCardsContainer: {
    gap: spacing.md,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xl,
    backgroundColor: colors.bg,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: SKELETON_BG,
  },
  skeletonTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  skeletonLineShort: {
    height: 12,
    width: '40%',
    borderRadius: radii.sm,
    backgroundColor: SKELETON_BG,
  },
  skeletonLineLong: {
    height: 16,
    width: '70%',
    borderRadius: radii.sm,
    backgroundColor: SKELETON_BG,
  },
  skeletonCard: {
    height: 120,
    borderRadius: radii.xl,
    backgroundColor: SKELETON_BG,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skeletonCardSmall: {
    flex: 1,
    height: 80,
    borderRadius: radii.lg,
    backgroundColor: SKELETON_BG,
  },
});

export default HomeScreen;
