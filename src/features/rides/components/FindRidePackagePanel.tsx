import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { MapWrapper } from '../../../components/MapWrapper';
import { CITIES } from '../../../pages/waselCoreRideData';
import { DS, midpoint, pill, r, resolveCityCoord } from '../../../pages/waselServiceShared';
import { FIND_RIDE_PACKAGE_WEIGHTS, type FindRideStaticCopy } from '../findRideContent';
import { createConnectedPackage, type PackageRequest } from '../../../services/journeyLogistics';
import { notificationsAPI } from '../../../services/notifications.js';

type PackageState = {
  from: string;
  to: string;
  weight: string;
  note: string;
  sent: boolean;
};

type FindRidePackagePanelProps = {
  ar: boolean;
  copy: FindRideStaticCopy;
  t: {
    from: string;
    to: string;
    weight: string;
    note: string;
    notePh: string;
    deliveryRoute: string;
    deliveryHint: string;
    packageFriendly: string;
    sendPackageBtn: string;
  };
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
};

export function FindRidePackagePanel({ ar, copy, t, pkg, setPkg }: FindRidePackagePanelProps) {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<PackageRequest | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (creating) { return; }

    if (pkg.from === pkg.to) {
      setCreateError(ar ? 'اختار مدينتين مختلفتين للطرد.' : 'Pick two different cities for the package.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const packageRequest = await createConnectedPackage({
        from: pkg.from,
        to: pkg.to,
        weight: pkg.weight,
        note: pkg.note,
      });

      setCreated(packageRequest);
      setPkg(previous => ({ ...previous, sent: true }));

      void notificationsAPI
        .createNotification({
          title: ar ? 'تم إنشاء طلب الطرد' : 'Package request created',
          message: packageRequest.matchedRideId
            ? ar
              ? `رقم التتبع: ${packageRequest.trackingId}. تمت المطابقة مع رحلة مباشرة.`
              : `Tracking ID: ${packageRequest.trackingId}. Matched to a live ride.`
            : ar
              ? `رقم التتبع: ${packageRequest.trackingId}. نبحث عن أقرب رحلة مطابقة.`
              : `Tracking ID: ${packageRequest.trackingId}. Searching for the next matching ride.`,
          type: 'booking',
          priority: 'high',
          action_url: '/app/packages',
        })
        .catch(() => {});
    } catch (error) {
      setCreated(null);
      setPkg(previous => ({ ...previous, sent: false }));
      setCreateError(
        error instanceof Error
          ? error.message
          : ar
            ? 'لم نتمكن من إنشاء طلب الطرد الآن.'
            : 'We could not create the package request right now.',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setCreated(null);
    setCreateError(null);
    setPkg(previous => ({ ...previous, sent: false }));
  };

  return (
    <div
      style={{
        background: DS.card,
        borderRadius: r(20),
        padding: 28,
        border: `1px solid ${DS.border}`,
      }}
    >
      {created ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>{copy.packageIcon}</div>
          <h3 style={{ color: DS.green, fontWeight: 900, fontSize: '1.3rem' }}>
            {copy.packageSent}
          </h3>
          <p style={{ color: DS.sub, marginTop: 8 }}>
            {copy.packageHint} {created.to}.
          </p>
          <div
            style={{
              maxWidth: 380,
              margin: '18px auto 0',
              background: DS.card2,
              borderRadius: r(16),
              padding: '16px 20px',
              border: `1px solid ${DS.border}`,
              textAlign: 'left',
            }}
          >
            <p style={{ color: DS.muted, fontSize: '0.72rem', margin: '0 0 4px' }}>
              {ar ? 'رقم التتبع' : 'Tracking ID'}
            </p>
            <p
              data-testid="find-ride-package-tracking-id"
              style={{
                color: DS.cyan,
                fontWeight: 900,
                fontSize: '1.15rem',
                margin: '0 0 12px',
              }}
            >
              {created.trackingId}
            </p>
            <p style={{ color: DS.muted, fontSize: '0.72rem', margin: '0 0 4px' }}>
              {ar ? 'رمز التسليم' : 'Handoff code'}
            </p>
            <p style={{ color: DS.gold, fontWeight: 800, fontSize: '1rem', margin: '0 0 12px' }}>
              {created.handoffCode}
            </p>
            <p style={{ color: DS.sub, fontSize: '0.8rem', margin: 0 }}>
              {created.matchedRideId
                ? ar
                  ? `تم التعيين إلى ${created.matchedDriver ?? 'كابتن متصل'} على رحلة مباشرة.`
                  : `Assigned to ${created.matchedDriver ?? 'a connected captain'} on a live ride.`
                : ar
                  ? 'بانتظار أقرب رحلة مطابقة على نفس المسار.'
                  : 'Waiting for the next matching ride on this corridor.'}
            </p>
          </div>
          <button
            onClick={handleReset}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              borderRadius: '99px',
              border: `1px solid ${DS.border}`,
              background: DS.card2,
              color: DS.cyan,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {copy.packageReset}
          </button>
        </div>
      ) : (
        <>
          <h3 style={{ color: DS.text, fontWeight: 800, marginBottom: 20 }}>{copy.packageTitle}</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 18,
            }}
          >
            {copy.packageFlow.map(step => (
              <div
                key={step.title}
                style={{
                  borderRadius: r(14),
                  padding: '12px 13px',
                  border: `1px solid ${DS.border}`,
                  background: DS.card2,
                }}
              >
                <div
                  style={{ color: DS.text, fontWeight: 800, fontSize: '0.84rem', marginBottom: 4 }}
                >
                  {step.title}
                </div>
                <div style={{ color: DS.sub, fontSize: '0.74rem', lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
            {[
              { label: t.from, value: pkg.from, key: 'from' as const },
              { label: t.to, value: pkg.to, key: 'to' as const },
            ].map(field => (
              <div key={field.label}>
                <label
                  style={{
                    display: 'block',
                    color: DS.muted,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: 0,
                    textTransform: ar ? undefined : 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {field.label}
                </label>
                <select
                  value={field.value}
                  onChange={event =>
                    setPkg(previous => ({ ...previous, [field.key]: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: r(10),
                    border: `1px solid ${DS.border}`,
                    background: DS.card2,
                    color: DS.text,
                    fontFamily: DS.F,
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                >
                  {CITIES.map(city => (
                    <option key={city} value={city} style={{ background: DS.card }}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label
                style={{
                  display: 'block',
                  color: DS.muted,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: 0,
                  textTransform: ar ? undefined : 'uppercase',
                  marginBottom: 6,
                }}
              >
                {t.weight}
              </label>
              <select
                value={pkg.weight}
                onChange={event =>
                  setPkg(previous => ({ ...previous, weight: event.target.value }))
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: r(10),
                  border: `1px solid ${DS.border}`,
                  background: DS.card2,
                  color: DS.text,
                  fontFamily: DS.F,
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                {FIND_RIDE_PACKAGE_WEIGHTS.map(weight => (
                  <option key={weight} style={{ background: DS.card }}>
                    {weight}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  color: DS.muted,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: 0,
                  textTransform: ar ? undefined : 'uppercase',
                  marginBottom: 6,
                }}
              >
                {t.note}
              </label>
              <input
                placeholder={t.notePh}
                value={pkg.note}
                onChange={event => setPkg(previous => ({ ...previous, note: event.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: r(10),
                  border: `1px solid ${DS.border}`,
                  background: DS.card2,
                  color: DS.text,
                  fontFamily: DS.F,
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              background: DS.card2,
              borderRadius: r(14),
              padding: 12,
              border: `1px solid ${DS.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p
                  style={{
                    color: DS.muted,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    margin: '0 0 4px',
                  }}
                >
                  {t.deliveryRoute}
                </p>
                <p style={{ color: DS.sub, fontSize: '0.8rem', margin: 0 }}>{t.deliveryHint}</p>
              </div>
              <span style={{ ...pill(DS.gold), fontSize: '0.72rem' }}>{t.packageFriendly}</span>
            </div>
            <MapWrapper
              mode="static"
              center={midpoint(resolveCityCoord(pkg.from), resolveCityCoord(pkg.to))}
              pickupLocation={resolveCityCoord(pkg.from)}
              dropoffLocation={resolveCityCoord(pkg.to)}
              height={180}
              showMosques={false}
              showRadars={false}
            />
          </div>

          {createError && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                background: `${DS.gold}12`,
                border: `1px solid ${DS.gold}30`,
                borderRadius: r(14),
                padding: '12px 14px',
                color: DS.text,
                fontSize: '0.84rem',
                textAlign: 'left',
              }}
            >
              <Shield size={16} color={DS.gold} />
              <span data-testid="find-ride-package-error">{createError}</span>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={creating}
            onClick={() => { void handleCreate(); }}
            style={{
              marginTop: 20,
              width: '100%',
              height: 52,
              borderRadius: r(14),
              border: 'none',
              background: DS.gradGold,
              color: DS.text,
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: creating ? 'wait' : 'pointer',
              opacity: creating ? 0.75 : 1,
            }}
          >
            {copy.packageIcon}{' '}
            {creating
              ? ar
                ? 'جاري إنشاء طلب الطرد...'
                : 'Creating package request...'
              : t.sendPackageBtn}
          </motion.button>
        </>
      )}
    </div>
  );
}
