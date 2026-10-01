import type { Dispatch, SetStateAction } from 'react';
import { Shield } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DS, r } from '../../../pages/waselServiceShared';
import { C } from '../../../utils/wasel-ds';
import { PACKAGE_RETURN_STEPS, PACKAGE_RETURN_STEPS_AR } from '../packagesContent';
import { tx } from '../../../locales/tx';

type ReturnComposerState = {
  from: string;
  to: string;
  weight: string;
  note: string;
  sent: boolean;
  trackingId: string;
  recipientName: string;
  recipientPhone: string;
};

type PackageReturnsPanelProps = {
  pkg: ReturnComposerState;
  setPkg: Dispatch<SetStateAction<ReturnComposerState>>;
  /** Tracking ID of the return this panel actually created, if any. */
  trackingId: string | null;
  createError: string | null;
  busyState: 'idle' | 'creating' | 'tracking';
  onCreateReturn: () => void;
  onReset: () => void;
};

export function PackageReturnsPanel({
  pkg,
  setPkg,
  trackingId,
  createError,
  busyState,
  onCreateReturn,
  onReset,
}: PackageReturnsPanelProps) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const returnSteps = ar ? PACKAGE_RETURN_STEPS_AR : PACKAGE_RETURN_STEPS;
  const phoneDigits = pkg.recipientPhone.replace(/[^\d]/g, '').length;
  const canCreate =
    pkg.from !== pkg.to &&
    pkg.recipientName.trim().length > 0 &&
    phoneDigits >= 9;

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{tx('packageReturnsPanel.r')}</div>
      <h3 style={{ color: C.text, fontWeight: 800, margin: '0 0 8px' }}>
        {tx('packageReturnsPanel.raje3_returns')}
      </h3>
      <p style={{ color: DS.sub, margin: '0 auto 24px', maxWidth: 480 }}>
        {tx(
          'packageReturnsPanel.return_e_commerce_items_through_the_same_shared_ride_network_create_a_return_request_match_it_to_a_posted_route_and_keep_one_tracking_id_from_pickup_to_dropoff',
        )}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          marginBottom: 24,
          textAlign: 'left',
        }}
      >
        {returnSteps.map(step => (
          <div
            key={step.title}
            style={{
              background: DS.card2,
              borderRadius: r(14),
              padding: '18px 16px',
              border: `1px solid ${DS.border}`,
            }}
          >
            <h4 style={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', margin: '0 0 6px' }}>
              {step.title}
            </h4>
            <p style={{ color: DS.muted, fontSize: '0.75rem', margin: 0 }}>{step.desc}</p>
          </div>
        ))}
      </div>

      {trackingId && (
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto 18px',
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
            data-testid="package-return-tracking-id"
            style={{ color: DS.cyan, fontWeight: 900, fontSize: '1.15rem', margin: 0 }}
          >
            {trackingId}
          </p>
          <p style={{ color: DS.sub, fontSize: '0.8rem', margin: '10px 0 0' }}>
            {ar
              ? 'طلب الإرجاع مُنشأ. افتح تبويب "تتبع طرد" لمتابعة الاستلام والتسليم.'
              : 'The return request is live. Open the Track Package tab to follow pickup and delivery.'}
          </p>
        </div>
      )}

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto 18px',
          display: 'grid',
          gap: 12,
          textAlign: 'left',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              color: DS.muted,
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {ar ? 'اسم المستلم' : 'Recipient name'}
          </label>
          <input
            data-testid="package-return-recipient-name"
            value={pkg.recipientName}
            onChange={event =>
              setPkg(previous => ({ ...previous, recipientName: event.target.value }))
            }
            placeholder={ar ? 'مثال: محل نون' : 'e.g. Noon store'}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: r(10),
              border: `1px solid ${DS.border}`,
              background: DS.card2,
              color: DS.text,
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              color: DS.muted,
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {ar ? 'هاتف المستلم' : 'Recipient phone'}
          </label>
          <input
            data-testid="package-return-recipient-phone"
            value={pkg.recipientPhone}
            onChange={event =>
              setPkg(previous => ({ ...previous, recipientPhone: event.target.value }))
            }
            placeholder={ar ? '07xxxxxxxx' : '07xxxxxxxx'}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: r(10),
              border: `1px solid ${DS.border}`,
              background: DS.card2,
              color: DS.text,
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <p style={{ color: DS.muted, fontSize: '0.75rem', margin: 0, lineHeight: 1.55 }}>
          {ar
            ? `سيتم الإرجاع من ${pkg.from} إلى ${pkg.to} بنفس الرقم الذي يظهر في التتبّع.`
            : `The return runs on the ${pkg.from} to ${pkg.to} corridor using the same tracking ID.`}
        </p>
      </div>

      {createError && (
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto 18px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: `${DS.gold}12`,
            border: `1px solid ${DS.gold}30`,
            borderRadius: r(14),
            padding: '12px 14px',
            color: C.text,
            fontSize: '0.84rem',
            textAlign: 'left',
          }}
        >
          <Shield size={16} color={DS.gold} />
          <span>{createError}</span>
        </div>
      )}

      {trackingId ? (
        <button
          onClick={onReset}
          style={{
            padding: '14px 32px',
            borderRadius: '99px',
            border: `1px solid ${DS.border}`,
            background: DS.card2,
            color: DS.gold,
            fontWeight: 800,
            fontFamily: DS.F,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          {ar ? 'ابدأ إرجاعاً آخر' : 'Start another return'}
        </button>
      ) : (
        <button
          disabled={busyState === 'creating' || !canCreate}
          onClick={() => { void onCreateReturn(); }}
          style={{
            padding: '14px 32px',
            borderRadius: '99px',
            border: 'none',
            background: canCreate ? DS.gradG : DS.card2,
            color: canCreate ? C.bgDeep : DS.muted,
            fontWeight: 800,
            fontFamily: DS.F,
            fontSize: '0.95rem',
            cursor:
              busyState === 'creating' ? 'wait' : canCreate ? 'pointer' : 'not-allowed',
            opacity: busyState === 'creating' ? 0.75 : 1,
            boxShadow: canCreate ? `0 4px 20px ${DS.gold}30` : 'none',
          }}
        >
          {busyState === 'creating'
            ? ar
              ? 'جاري بدء الإرجاع...'
              : 'Starting return...'
            : ar
              ? 'ابدأ إرجاعاً متصلاً'
              : 'Start a connected return'}
        </button>
      )}
    </div>
  );
}
