import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FindRidePackagePanel } from '../FindRidePackagePanel';
import { createConnectedPackage } from '../../../../services/journeyLogistics';

vi.mock('leaflet', () => ({}));
vi.mock('../../../../components/MapWrapper', () => ({
  MapWrapper: () => <div data-testid="map-wrapper" />,
}));

vi.mock('../../../../services/journeyLogistics', () => ({
  createConnectedPackage: vi.fn(),
}));

vi.mock('../../../../services/notifications.js', () => ({
  notificationsAPI: { createNotification: vi.fn(() => Promise.resolve({ success: true })) },
}));

const createConnectedPackageMock = vi.mocked(createConnectedPackage);

function Harness() {
  const [pkg, setPkg] = useState({
    from: 'Amman',
    to: 'Aqaba',
    weight: '<1 kg',
    note: '',
    sent: false,
  });
  const copy = {
    tabRide: 'Ride',
    tabPackage: 'Package',
    pageSub: '',
    pageAction: '',
    packageTitle: 'Package service',
    packageSent: 'Package request sent',
    packageHint: 'We are matching your package to a trusted ride headed to',
    packageReset: 'Send another package',
    packageFlow: [{ title: 'Sender', desc: 'Pick the route and weight.' }],
    notifyMe: '',
    noResultsIcon: '',
    packageIcon: 'Parcel',
  };
  const t = {
    from: 'From',
    to: 'To',
    weight: 'Weight',
    note: 'Note',
    notePh: 'Fragile',
    deliveryRoute: 'Route',
    deliveryHint: 'Shared ride delivery',
    packageFriendly: 'Shared',
    sendPackageBtn: 'Send package with ride',
  };

  return <FindRidePackagePanel ar={false} copy={copy} t={t} pkg={pkg} setPkg={setPkg} />;
}

describe('FindRidePackagePanel', () => {
  beforeEach(() => {
    createConnectedPackageMock.mockReset();
    createConnectedPackageMock.mockResolvedValue({
      id: 'pkg-1',
      trackingId: 'PKG-REALTRACK1',
      handoffCode: 'HC-ABC123',
      from: 'Amman',
      to: 'Aqaba',
      weight: '<1 kg',
      note: '',
      packageType: 'delivery',
      matchedRideId: 'ride-9',
      matchedDriver: 'Hyundai Captain',
      status: 'matched',
      createdAt: '2026-01-01T00:00:00.000Z',
      verification: {},
      timeline: [],
    });
  });

  it('creates a real connected package and surfaces the real tracking id', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /send package with ride/i }));

    await waitFor(() => {
      expect(createConnectedPackageMock).toHaveBeenCalledTimes(1);
    });
    expect(createConnectedPackageMock).toHaveBeenCalledWith({
      from: 'Amman',
      to: 'Aqaba',
      weight: '<1 kg',
      note: '',
    });

    // The success panel must show the ID the service returned, not a local flag.
    const tracking = await screen.findByTestId('find-ride-package-tracking-id');
    expect(tracking.textContent).toBe('PKG-REALTRACK1');
    expect(screen.getByText('HC-ABC123')).toBeTruthy();
  }, 20_000);

  it('surfaces the failure and stays on the form when creation throws', async () => {
    createConnectedPackageMock.mockRejectedValue(new Error('Sender and receiver cities must be different.'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /send package with ride/i }));

    const error = await screen.findByTestId('find-ride-package-error');
    expect(error.textContent).toContain('Sender and receiver cities must be different.');
    expect(screen.queryByTestId('find-ride-package-tracking-id')).toBeNull();
    expect(screen.getByRole('button', { name: /send package with ride/i })).toBeTruthy();
  }, 20_000);
});
