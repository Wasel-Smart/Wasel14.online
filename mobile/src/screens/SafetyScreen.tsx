import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  InfoCard,
  PremiumPanel,
  PrimaryButton,
  ScreenShell,
  SectionHeader,
  StateNotice,
  StatusPill,
} from '../components/MobilePrimitives';
import { useAuth } from '../providers/AuthProvider';
import {
  addContact as saveContact,
  callEmergency,
  EMERGENCY_NUMBER,
  loadContacts,
  removeContact,
  sendSos,
  smsContacts,
  type EmergencyContact,
  type SosResult,
} from '../services/safety';
import { validatePhone } from '../utils/security';
import { colors, radii, spacing } from '../theme';

type SosStage = 'idle' | 'confirm' | 'sending' | 'sent' | 'fallback';

const CHECKLIST = [
  { id: 'driver', label: 'تأكد من اسم السائق ورقم اللوحة' },
  { id: 'share', label: 'شارك المشوار مع جهة اتصال' },
  { id: 'phone', label: 'شحن الهاتف فوق ٢٠٪' },
  { id: 'seatbelt', label: 'اربط حزام الأمان' },
];

function normalizeJordanPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+962${digits.slice(1)}`;
  return digits;
}

const SafetyScreen = React.memo(function SafetyScreen() {
  const { user } = useAuth();
  const [sosStage, setSosStage] = useState<SosStage>('idle');
  const [sosResult, setSosResult] = useState<SosResult | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [addingContact, setAddingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [checklistDone, setChecklistDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadContacts().then(setContacts);
  }, []);

  const completedCount = CHECKLIST.filter(c => checklistDone[c.id]).length;

  const triggerSOS = useCallback(async () => {
    if (sosStage === 'idle') {
      setSosStage('confirm');
      return;
    }
    if (sosStage !== 'confirm') return;

    setSosStage('sending');
    const result = await sendSos();
    setSosResult(result);
    setSosStage(result.status === 'sent' ? 'sent' : 'fallback');
  }, [sosStage]);

  const resetSos = useCallback(() => {
    setSosStage('idle');
    setSosResult(null);
  }, []);

  const addContact = useCallback(async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('معلومات ناقصة', 'اكتب الاسم ورقم الهاتف.');
      return;
    }
    const phone = normalizeJordanPhone(newPhone);
    if (!validatePhone(phone)) {
      Alert.alert('رقم غير صالح', 'اكتب رقماً صحيحاً مثل 0791234567 أو +962791234567.');
      return;
    }
    setContacts(await saveContact(newName, phone));
    setNewName('');
    setNewPhone('');
    setAddingContact(false);
  }, [newName, newPhone]);

  const deleteContact = useCallback(async (id: string) => {
    setContacts(await removeContact(id));
  }, []);

  const toggleChecklist = useCallback((id: string) => {
    setChecklistDone(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const sosTitle =
    sosStage === 'sent'
      ? 'تم إرسال SOS'
      : sosStage === 'fallback'
      ? 'تعذّر الإرسال — اتصل مباشرة'
      : sosStage === 'sending'
      ? 'جاري الإرسال…'
      : sosStage === 'confirm'
      ? 'تأكيد SOS؟'
      : 'إرسال SOS';

  const sosBody =
    sosStage === 'sent'
      ? sosResult?.status === 'sent' && sosResult.located
        ? 'انسجّل بلاغك مع موقعك وبيوصل لفريق الدعم.'
        : 'انسجّل بلاغك (بدون موقع — فعّل خدمة الموقع).'
      : sosStage === 'fallback'
      ? `ما قدرنا نوصّل التنبيه لدعم واصل. اتصل بالطوارئ ${EMERGENCY_NUMBER} أو راسل جهات الاتصال الآن.`
      : sosStage === 'confirm'
      ? 'هذا بيسجّل بلاغ طوارئ فوراً مع موقعك.'
      : 'اضغط لتسجيل بلاغ طوارئ فوري. في الخطر الشديد اتصل بالطوارئ مباشرة.';

  return (
    <ScreenShell testID="safety-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <StatusPill
            label={user ? 'حساب موثق' : 'وضع الزائر'}
            tone={user ? colors.green : colors.amber}
            icon={user ? 'shield-checkmark' : 'warning'}
          />
          <StatusPill
            label={`${completedCount}/${CHECKLIST.length} فحوصات`}
            tone={completedCount === CHECKLIST.length ? colors.green : colors.amber}
            icon="checkmark-circle"
          />
        </View>

        <SectionHeader
          eyebrow="مركز الأمان"
          title="خليك آمن بكل مشوار"
          body="قائمة قبل المشوار وجهات الطوارئ وSOS بمكان واحد."
        />

        <PremiumPanel>
          <SectionHeader eyebrow="طوارئ" title={sosTitle} body={sosBody} size="md" />
          <View style={styles.sosRow}>
            <PrimaryButton
              label={`اتصل بالطوارئ ${EMERGENCY_NUMBER}`}
              icon="call"
              tone={colors.red}
              onPress={() => void callEmergency()}
              testID="call-emergency-button"
            />
            {sosStage !== 'sent' && sosStage !== 'fallback' && (
              <PrimaryButton
                label={sosStage === 'confirm' ? 'أكّد إرسال SOS الآن' : 'شغّل SOS'}
                icon="warning"
                tone={colors.red}
                loading={sosStage === 'sending'}
                disabled={sosStage === 'sending'}
                onPress={() => void triggerSOS()}
                testID="sos-button"
              />
            )}
            {sosStage === 'fallback' && contacts.length > 0 && (
              <PrimaryButton
                label="راسل جهات الاتصال"
                icon="chatbubble"
                tone={colors.primary}
                onPress={() =>
                  void smsContacts(contacts, sosResult?.status === 'fallback' ? sosResult.coords : undefined)
                }
                testID="sms-contacts-button"
              />
            )}
            {(sosStage === 'confirm' || sosStage === 'sent' || sosStage === 'fallback') && (
              <PrimaryButton
                label={sosStage === 'confirm' ? 'إلغاء' : 'إعادة ضبط'}
                icon={sosStage === 'confirm' ? 'close' : 'refresh'}
                variant="outline"
                onPress={resetSos}
              />
            )}
          </View>
        </PremiumPanel>

        <SectionHeader eyebrow="قائمة التحقق" title="قبل كل مشوار" body="اضغط كل بند بعد ما تتأكد منه." size="md" />
        {CHECKLIST.map(item => (
          <PrimaryButton
            key={item.id}
            label={item.label}
            icon={checklistDone[item.id] ? 'checkmark-circle' : 'ellipse-outline'}
            tone={checklistDone[item.id] ? colors.green : colors.primary}
            variant={checklistDone[item.id] ? 'solid' : 'outline'}
            onPress={() => toggleChecklist(item.id)}
          />
        ))}

        <SectionHeader
          eyebrow="جهات الطوارئ"
          title={contacts.length > 0 ? `${contacts.length} جهات اتصال` : 'لسه ما في جهات اتصال'}
          body="بنعرض لك خيار مراسلتهم إذا تعذّر تسجيل بلاغ SOS."
          size="md"
        />

        {contacts.map(contact => (
          <View key={contact.id} style={styles.contactBlock}>
            <StateNotice icon="person" title={contact.name} body={contact.phone} tone={colors.primary} />
            <PrimaryButton
              label="احذف"
              icon="trash"
              variant="outline"
              tone={colors.red}
              onPress={() => void deleteContact(contact.id)}
            />
          </View>
        ))}

        {addingContact ? (
          <PremiumPanel>
            <View style={styles.form}>
              <TextInput
                accessibilityLabel="اسم جهة الاتصال"
                placeholder="اسم جهة الاتصال"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
              />
              <TextInput
                accessibilityLabel="رقم الهاتف"
                placeholder="رقم الهاتف (07xxxxxxxx)"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <PrimaryButton label="احفظ جهة الاتصال" icon="checkmark" onPress={() => void addContact()} />
              <PrimaryButton label="إلغاء" icon="close" variant="outline" onPress={() => setAddingContact(false)} />
            </View>
          </PremiumPanel>
        ) : contacts.length < 5 ? (
          <PrimaryButton
            label="أضف جهة طوارئ"
            icon="person-add"
            onPress={() => setAddingContact(true)}
            testID="add-contact-button"
          />
        ) : null}

        <InfoCard
          icon="location"
          title="مشاركة الموقع مع SOS"
          body="بنسجّل موقعك الحالي مع البلاغ، بشرط تفعيل إذن الموقع."
          tone={colors.primary}
        />
      </ScrollView>
    </ScreenShell>
  );
});

const styles = StyleSheet.create({
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  sosRow: { gap: spacing.sm, marginTop: spacing.md },
  form: { gap: spacing.sm },
  contactBlock: { gap: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.lineInput,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
});

export default SafetyScreen;
