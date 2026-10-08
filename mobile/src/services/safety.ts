/**
 * Safety service — real SOS dispatch + persisted emergency contacts.
 *
 * SOS is only reported as "sent" when the server accepted it. If the server
 * cannot be reached the caller gets a `fallback` result so the UI can offer
 * a direct call / SMS instead of claiming help was notified.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { apiClient } from '../lib/api';
import { mobileAuth } from './auth';

export const EMERGENCY_NUMBER = '911';

const CONTACTS_KEY = 'wasel.safety.contacts.v1';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export type SosResult =
  | { status: 'sent'; sosId?: string; located: boolean }
  | { status: 'fallback'; reason: string; located: boolean; coords?: { latitude: number; longitude: number } };

export async function loadContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is EmergencyContact => c && typeof c.id === 'string' && typeof c.phone === 'string')
      : [];
  } catch {
    return [];
  }
}

async function saveContacts(contacts: EmergencyContact[]): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export async function addContact(name: string, phone: string): Promise<EmergencyContact[]> {
  const contacts = await loadContacts();
  const next = [...contacts, { id: `c_${Date.now()}`, name: name.trim(), phone: phone.trim() }].slice(0, 5);
  await saveContacts(next);
  void syncContactsToServer(next);
  return next;
}

export async function removeContact(id: string): Promise<EmergencyContact[]> {
  const next = (await loadContacts()).filter(c => c.id !== id);
  await saveContacts(next);
  void syncContactsToServer(next);
  return next;
}

async function syncContactsToServer(contacts: EmergencyContact[]): Promise<void> {
  if (!mobileAuth.getUser()) return;
  try {
    await apiClient.put('safety/emergency-contacts', { contacts });
  } catch {
    // Local copy is the source of truth for SOS fallback; server sync is best effort.
  }
}

async function currentCoords(): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync();
    const pos =
      last ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    };
  } catch {
    return null;
  }
}

export function mapsLink(coords: { latitude: number; longitude: number }): string {
  return `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
}

export async function sendSos(rideId?: string): Promise<SosResult> {
  const coords = await currentCoords();
  const contacts = await loadContacts();

  const { data, error, status } = await apiClient.post<{ id?: string; sosId?: string }>(
    'safety/sos',
    {
      rideId,
      location: coords,
      contacts: contacts.map(c => ({ name: c.name, phone: c.phone })),
      triggeredAt: new Date().toISOString(),
    },
    { retries: 0, timeout: 10_000 },
  );

  if (!error && status >= 200 && status < 300) {
    return { status: 'sent', sosId: data?.sosId ?? data?.id, located: Boolean(coords) };
  }

  return {
    status: 'fallback',
    reason: error ?? `HTTP ${status}`,
    located: Boolean(coords),
    coords: coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined,
  };
}

export function callEmergency(): Promise<void> {
  return Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
}

/** Opens the SMS composer addressed to every saved contact with the location link. */
export async function smsContacts(
  contacts: EmergencyContact[],
  coords?: { latitude: number; longitude: number },
): Promise<void> {
  if (contacts.length === 0) return;
  const body = coords
    ? `واصل SOS: أحتاج مساعدة. موقعي: ${mapsLink(coords)}`
    : 'واصل SOS: أحتاج مساعدة. تواصلوا معي فوراً.';
  const numbers = contacts.map(c => c.phone).join(Platform.OS === 'ios' ? ',' : ';');
  const sep = Platform.OS === 'ios' ? '&' : '?';
  await Linking.openURL(`sms:${numbers}${sep}body=${encodeURIComponent(body)}`);
}
