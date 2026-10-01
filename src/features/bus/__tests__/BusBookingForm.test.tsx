import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BusBookingForm } from '../components/BusBookingForm';
import { setCurrentLang } from '../../../locales/tx';
import type { BusRoute } from '../../../services/bus';

const ROUTE: BusRoute = {
  id: 'route-1',
  from: 'Amman',
  to: 'Aqaba',
  company: 'Wasel Bus',
  serviceLevel: 'Standard',
  price: 8,
  scheduleDays: 'Daily',
  seats: 12,
  pickupPoint: 'Wasel Hub',
  dropoffPoint: 'Aqaba Terminal',
  dep: '08:00',
  arr: '13:00',
  amenities: ['wifi', 'ac'],
  color: '#0ea5e9',
  via: ['Madaba'],
  duration: '5h',
  frequency: 'Daily',
  punctuality: 'On time',
  summary: 'Amman to Aqaba via Madaba',
};

function renderForm(overrides: Partial<Parameters<typeof BusBookingForm>[0]> = {}) {
  const props: Parameters<typeof BusBookingForm>[0] = {
    activeBus: ROUTE,
    scheduleMode: 'schedule-later',
    setScheduleMode: vi.fn(),
    selectedDeparture: '08:00',
    setSelectedDeparture: vi.fn(),
    departureTimes: ['08:00', '10:00'],
    passengers: 1,
    setPassengers: vi.fn(),
    seatPreference: 'window',
    setSeatPreference: vi.fn(),
    tripDate: '2026-01-01',
    setTripDate: vi.fn(),
    today: '2026-01-01',
    totalPrice: 8,
    bookingDisabled: false,
    bookingBusy: false,
    bookingComplete: false,
    bookingTicketCode: null,
    bookingSource: null,
    handleBusBooking: vi.fn(),
    openBusSupport: vi.fn(),
    ar: false,
    ...overrides,
  };

  render(<BusBookingForm {...props} />);
  return props;
}

describe('BusBookingForm schedule-later date', () => {
  beforeEach(() => {
    setCurrentLang('en');
  });

  it('lets the user change the booking date instead of swallowing the change', () => {
    const props = renderForm();

    const dateInput = screen.getByLabelText('Booking date') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-01-01');

    fireEvent.change(dateInput, { target: { value: '2026-02-03' } });

    expect(props.setTripDate).toHaveBeenCalledWith('2026-02-03');
  });

  it('hides the date field in depart-now mode', () => {
    renderForm({ scheduleMode: 'depart-now' });
    expect(screen.queryByLabelText('Booking date')).toBeNull();
  });
});

describe('BusBookingForm localisation', () => {
  beforeEach(() => {
    setCurrentLang('ar');
  });

  it('renders Arabic labels instead of English-only literals', () => {
    renderForm();

    expect(screen.getByLabelText('تاريخ الحجز')).toBeTruthy();
    expect(screen.getByText('غادر الآن')).toBeTruthy();
    expect(screen.getByText('احجز لاحقًا')).toBeTruthy();
    expect(screen.getByText('سعر المقعد')).toBeTruthy();
    expect(screen.getByText('أيام التشغيل')).toBeTruthy();
    expect(screen.getByText('المتاح في هذه الحافلة')).toBeTruthy();
    expect(screen.getByText('احجز المقعد')).toBeTruthy();
  });

  it('interpolates the seat count in Arabic', () => {
    renderForm({ activeBus: { ...ROUTE, seats: 3 } });
    expect(screen.getByText('3 مقعد')).toBeTruthy();
  });
});