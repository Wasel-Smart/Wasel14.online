/**
 * Safety service — real SOS dispatch + persisted emergency contacts.
 *
 * SOS writes a row to public.safety_incidents (RLS decides who may insert).
 * "sent" is only reported when that insert succeeded; otherwise the caller
 * gets a `fallback` result so the UI can offer a direct call / SMS instead of
 * claiming help was notified.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { supabase } from '../lib/config';
import { getUserIdentity } from './identity';

export const EMERGENCY_NUMBER = '911';

const CONTACTS_KEY = 'wasel.safety.contacts.v1';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export type SosResult =
  | { status: 'sent'; incidentId?: string; located: boolean }
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
  return next;
}

export async function removeContact(id: string): Promise<EmergencyContact[]> {
  const next = (await loadContacts()).filter(c => c.id !== id);
  await saveContacts(next);
  return next;
}

async function currentCoords(): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
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

/** Resolves the public.users.id for the signed-in auth user (reporter_id references it). */
async function resolveReporterId(): Promise<string | null> {
  try {
    return (await getUserIdentity()).publicId;
  } catch {
    return null;
  }
}

export async function sendSos(tripId?: string): Promise<SosResult> {
  const coords = await currentCoords();
  const fallback = (reason: string): SosResult => ({
    status: 'fallback',
    reason,
    located: Boolean(coords),
    coords: coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined,
  });

  try {
    const reporterId = await resolveReporterId();
    if (!reporterId) return fallback('not_signed_in');

    const { data, error } = await supabase
      .from('safety_incidents')
      .insert({
        reporter_id: reporterId,
        trip_id: tripId ?? null,
        incident_type: 'sos',
        severity: 'critical',
        description: 'SOS triggered from the Wasel mobile app',
        // PostGIS geography accepts EWKT text; longitude first.
        ...(coords ? { location: `SRID=4326;POINT(${coords.longitude} ${coords.latitude})` } : {}),
        evidence: {
          source: 'mobile_sos',
          platform: Platform.OS,
          accuracy_m: coords?.accuracy ?? null,
          triggered_at: new Date().toISOString(),
        },
      } as never)
      .select('id')
      .single();

    if (error) return fallback(error.message);
    return { status: 'sent', incidentId: (data as { id?: string } | null)?.id, located: Boolean(coords) };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : 'unknown_error');
  }
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
