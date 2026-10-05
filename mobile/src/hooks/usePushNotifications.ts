import { useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { apiClient } from '../lib/api';
import { mobileAuth } from '../services/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationPreferences = {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  tripUpdates: boolean;
  bookingRequests: boolean;
  messages: boolean;
  promotions: boolean;
  prayerReminders: boolean;
  criticalAlerts: boolean;
  preferredLanguage: 'en' | 'ar';
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inApp: true,
  push: true,
  email: false,
  sms: false,
  whatsapp: false,
  tripUpdates: true,
  bookingRequests: true,
  messages: true,
  promotions: false,
  prayerReminders: true,
  criticalAlerts: true,
  preferredLanguage: 'en',
};

function normalizePreferences(row: Record<string, unknown> | null | undefined): NotificationPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    inApp: row.in_app_enabled !== false,
    push: row.push_enabled !== false,
    email: row.email_enabled === true,
    sms: row.sms_enabled === true,
    whatsapp: row.whatsapp_enabled === true,
    tripUpdates: row.trip_updates_enabled !== false,
    bookingRequests: row.booking_requests_enabled !== false,
    messages: row.messages_enabled !== false,
    promotions: row.promotions_enabled === true,
    prayerReminders: row.prayer_reminders_enabled !== false,
    criticalAlerts: row.critical_alerts_enabled !== false,
    preferredLanguage: row.preferred_language === 'ar' ? 'ar' : 'en',
  };
}

export function usePushNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({ ...DEFAULT_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!Device.isDevice) {
        console.log('[PushNotifications] Must use physical device');
        setLoading(false);
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Notifications', 'Enable notifications for ride updates');
        setLoading(false);
        return;
      }

      const projectId = Constants.easConfig?.projectId;
      const tokenResult = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      const token = tokenResult.data;
      if (mounted) setPushToken(token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Wasel Ride Updates',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#72C70D',
        });
      }

      const user = mobileAuth.getUser();
      if (user) {
        await apiClient.post('notifications/push-token', {
          token,
          userId: user.id,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
          deviceId: Constants.installationId,
        });
      }

      setInitialized(true);
      setLoading(false);
    }

    void initialize();

    const tokenSubscription = Notifications.addPushTokenListener(({ data }: { data: any }) => {
      if (mounted) setPushToken(data);
    });

    return () => {
      mounted = false;
      tokenSubscription.remove();
    };
  }, []);

  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      const user = mobileAuth.getUser();
      if (!user) return false;

      try {
        await apiClient.patch('communications/preferences', newPreferences);
        setPreferences(prev => ({ ...prev, ...newPreferences }));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  return {
    preferences,
    loading,
    initialized,
    pushToken,
    updatePreferences,
  };
}
