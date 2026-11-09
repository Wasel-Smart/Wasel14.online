import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  credentialSchema,
  phoneSchema,
  jordanPhoneSchema,
  nameSchema,
  signUpSchema,
  signInSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
  amountSchema,
  topUpSchema,
  withdrawSchema,
  transferSchema,
  coordinatesSchema,
  locationSchema,
  rideSearchSchema,
  rideBookingSchema,
  rideCancellationSchema,
  rideRatingSchema,
  packageSizeSchema,
  packageWeightSchema,
  packageTrackingSchema,
  notificationPreferencesSchema,
  supportTicketSchema,
  validate,
  validateField,
  validationSchemas,
} from '@/utils/validationSchemas';

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });
  it('lowercases email', () => {
    const r = emailSchema.safeParse('USER@EXAMPLE.COM');
    expect(r.success && r.data).toBe('user@example.com');
  });
  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('credentialSchema', () => {
  it('accepts valid password', () => {
    expect(credentialSchema.safeParse('Password1').success).toBe(true);
  });
  it('rejects too short', () => {
    expect(credentialSchema.safeParse('Pass1').success).toBe(false);
  });
  it('rejects no digit', () => {
    expect(credentialSchema.safeParse('PasswordOnly').success).toBe(false);
  });
  it('rejects no letter', () => {
    expect(credentialSchema.safeParse('12345678').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('accepts international format', () => {
    expect(phoneSchema.safeParse('+962791234567').success).toBe(true);
  });
  it('rejects letters', () => {
    expect(phoneSchema.safeParse('abc').success).toBe(false);
  });
});

describe('jordanPhoneSchema', () => {
  it('accepts +962 format', () => {
    expect(jordanPhoneSchema.safeParse('+962791234567').success).toBe(true);
  });
  it('accepts 07x format', () => {
    expect(jordanPhoneSchema.safeParse('0791234567').success).toBe(true);
  });
  it('rejects non-Jordan number', () => {
    expect(jordanPhoneSchema.safeParse('+1234567890').success).toBe(false);
  });
});

describe('nameSchema', () => {
  it('accepts valid name', () => {
    expect(nameSchema.safeParse('Ahmad').success).toBe(true);
  });
  it('rejects single char', () => {
    expect(nameSchema.safeParse('A').success).toBe(false);
  });
  it('rejects empty', () => {
    expect(nameSchema.safeParse('').success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('accepts valid signup', () => {
    const r = signUpSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      fullName: 'Ahmad Ali',
    });
    expect(r.success).toBe(true);
  });
  it('rejects missing email', () => {
    expect(signUpSchema.safeParse({ password: 'Password1', fullName: 'Ahmad' }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts valid signin', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'pass' }).success).toBe(true);
  });
  it('rejects empty password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(resetPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('accepts matching passwords', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(r.success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'Different1',
    });
    expect(r.success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts partial update', () => {
    expect(profileUpdateSchema.safeParse({ firstName: 'Ahmad' }).success).toBe(true);
  });
  it('accepts empty object', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true);
  });
  it('rejects invalid gender', () => {
    expect(profileUpdateSchema.safeParse({ gender: 'unknown' }).success).toBe(false);
  });
});

describe('amountSchema', () => {
  it('accepts valid amount', () => {
    expect(amountSchema.safeParse(5.5).success).toBe(true);
  });
  it('rejects zero', () => {
    expect(amountSchema.safeParse(0).success).toBe(false);
  });
  it('rejects negative', () => {
    expect(amountSchema.safeParse(-1).success).toBe(false);
  });
  it('rejects over max', () => {
    expect(amountSchema.safeParse(10001).success).toBe(false);
  });
});

describe('topUpSchema', () => {
  it('accepts valid top-up', () => {
    expect(topUpSchema.safeParse({ amount: 10, paymentMethod: 'card' }).success).toBe(true);
  });
  it('rejects invalid payment method', () => {
    expect(topUpSchema.safeParse({ amount: 10, paymentMethod: 'crypto' }).success).toBe(false);
  });
});

describe('withdrawSchema', () => {
  it('accepts valid withdrawal', () => {
    expect(withdrawSchema.safeParse({ amount: 10, bankAccount: 'JO12345' }).success).toBe(true);
  });
});

describe('transferSchema', () => {
  it('accepts valid transfer', () => {
    expect(
      transferSchema.safeParse({
        amount: 5,
        recipientId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });
  it('rejects invalid uuid', () => {
    expect(transferSchema.safeParse({ amount: 5, recipientId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('coordinatesSchema', () => {
  it('accepts valid coords', () => {
    expect(coordinatesSchema.safeParse({ lat: 31.9, lng: 35.9 }).success).toBe(true);
  });
  it('rejects out-of-range lat', () => {
    expect(coordinatesSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
  });
  it('rejects out-of-range lng', () => {
    expect(coordinatesSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(false);
  });
});

describe('locationSchema', () => {
  const validLocation = {
    address: 'Amman, Jordan',
    coordinates: { lat: 31.9, lng: 35.9 },
  };
  it('accepts valid location', () => {
    expect(locationSchema.safeParse(validLocation).success).toBe(true);
  });
  it('rejects missing address', () => {
    expect(locationSchema.safeParse({ coordinates: { lat: 31.9, lng: 35.9 } }).success).toBe(false);
  });
});

describe('rideSearchSchema', () => {
  const loc = { address: 'A', coordinates: { lat: 31.9, lng: 35.9 } };
  it('accepts valid search', () => {
    expect(rideSearchSchema.safeParse({ pickup: loc, dropoff: loc }).success).toBe(true);
  });
  it('rejects too many passengers', () => {
    expect(rideSearchSchema.safeParse({ pickup: loc, dropoff: loc, passengers: 9 }).success).toBe(false);
  });
});

describe('rideBookingSchema', () => {
  it('accepts valid booking', () => {
    expect(
      rideBookingSchema.safeParse({
        rideId: '550e8400-e29b-41d4-a716-446655440000',
        passengers: 1,
      }).success,
    ).toBe(true);
  });
});

describe('rideCancellationSchema', () => {
  it('accepts valid cancellation', () => {
    expect(
      rideCancellationSchema.safeParse({
        rideId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'emergency',
      }).success,
    ).toBe(true);
  });
  it('rejects invalid reason', () => {
    expect(
      rideCancellationSchema.safeParse({
        rideId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'bored',
      }).success,
    ).toBe(false);
  });
});

describe('rideRatingSchema', () => {
  it('accepts valid rating', () => {
    expect(
      rideRatingSchema.safeParse({
        rideId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 5,
      }).success,
    ).toBe(true);
  });
  it('rejects rating out of range', () => {
    expect(
      rideRatingSchema.safeParse({
        rideId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 6,
      }).success,
    ).toBe(false);
  });
});

describe('packageSizeSchema', () => {
  it('accepts valid sizes', () => {
    for (const size of ['small', 'medium', 'large', 'extra_large']) {
      expect(packageSizeSchema.safeParse(size).success).toBe(true);
    }
  });
  it('rejects invalid size', () => {
    expect(packageSizeSchema.safeParse('huge').success).toBe(false);
  });
});

describe('packageWeightSchema', () => {
  it('accepts valid weight', () => {
    expect(packageWeightSchema.safeParse(5).success).toBe(true);
  });
  it('rejects over 50kg', () => {
    expect(packageWeightSchema.safeParse(51).success).toBe(false);
  });
  it('rejects zero', () => {
    expect(packageWeightSchema.safeParse(0).success).toBe(false);
  });
});

describe('packageTrackingSchema', () => {
  it('accepts tracking number', () => {
    expect(packageTrackingSchema.safeParse({ trackingNumber: 'PKG-123' }).success).toBe(true);
  });
  it('rejects empty tracking number', () => {
    expect(packageTrackingSchema.safeParse({ trackingNumber: '' }).success).toBe(false);
  });
});

describe('notificationPreferencesSchema', () => {
  it('accepts defaults', () => {
    const result = notificationPreferencesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: true,
        sms: true,
        push: true,
        whatsapp: false,
        categories: {
          rideUpdates: true,
          packageUpdates: true,
          paymentUpdates: true,
          promotions: false,
          systemUpdates: true,
        },
      });
    }
  });
  it('accepts explicit values', () => {
    expect(
      notificationPreferencesSchema.safeParse({
        email: false,
        sms: true,
        push: false,
        whatsapp: true,
        categories: { rideUpdates: true, packageUpdates: false, paymentUpdates: true, promotions: true, systemUpdates: false },
      }).success,
    ).toBe(true);
  });
});

describe('supportTicketSchema', () => {
  it('accepts valid ticket', () => {
    expect(
      supportTicketSchema.safeParse({
        category: 'payment',
        subject: 'Payment issue',
        description: 'My payment was charged twice for the same ride.',
      }).success,
    ).toBe(true);
  });
  it('rejects short description', () => {
    expect(
      supportTicketSchema.safeParse({
        category: 'payment',
        subject: 'Issue',
        description: 'Short',
      }).success,
    ).toBe(false);
  });
  it('rejects invalid category', () => {
    expect(
      supportTicketSchema.safeParse({
        category: 'unknown',
        subject: 'Some subject here',
        description: 'Some description that is long enough to pass validation.',
      }).success,
    ).toBe(false);
  });
});

describe('validate helper', () => {
  it('returns success with data', () => {
    const r = validate(emailSchema, 'a@b.com');
    expect(r.success).toBe(true);
    if (r.success) {expect(r.data).toBe('a@b.com');}
  });
  it('returns errors on failure', () => {
    const r = validate(emailSchema, 'bad');
    expect(r.success).toBe(false);
    if (!r.success) {expect(Object.keys(r.errors).length).toBeGreaterThan(0);}
  });
});

describe('validateField helper', () => {
  it('returns null on success', () => {
    expect(validateField(emailSchema, 'a@b.com')).toBeNull();
  });
  it('returns error message on failure', () => {
    expect(validateField(emailSchema, 'bad')).toBeTruthy();
  });
});

describe('validationSchemas registry', () => {
  it('exports all expected keys', () => {
    const keys = [
      'signUp', 'signIn', 'resetPassword', 'changePassword',
      'profileUpdate', 'topUp', 'withdraw', 'transfer',
      'rideSearch', 'rideOffer', 'rideBooking', 'rideCancellation', 'rideRating',
      'package', 'packageTracking', 'notificationPreferences', 'supportTicket',
    ];
    for (const key of keys) {
      expect(validationSchemas).toHaveProperty(key);
    }
  });
});
