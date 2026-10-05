import React from 'react';
import { render } from '@testing-library/react-native';
import {
  ScreenShell,
  SectionHeader,
  PremiumPanel,
  InfoCard,
  MetricTile,
  StatusPill,
  StateNotice,
  PrimaryButton,
  ActionRow,
  RoutePreview,
} from './MobilePrimitives';

describe('MobilePrimitives', () => {
  it('renders ScreenShell with children', () => {
    const { toJSON } = render(<ScreenShell><React.Fragment>Hello</React.Fragment></ScreenShell>);
    expect(JSON.stringify(toJSON())).toContain('Hello');
  });

  it('renders SectionHeader with title and body', () => {
    const { toJSON } = render(<SectionHeader eyebrow="EYEBROW" title="Title" body="Body text" />);
    expect(JSON.stringify(toJSON())).toContain('Title');
    expect(JSON.stringify(toJSON())).toContain('Body text');
  });

  it('renders PremiumPanel with children', () => {
    const { toJSON } = render(<PremiumPanel><React.Fragment>Premium</React.Fragment></PremiumPanel>);
    expect(JSON.stringify(toJSON())).toContain('Premium');
  });

  it('renders InfoCard with icon, title, and body', () => {
    const { toJSON } = render(<InfoCard icon="car" title="Ride" body="Book a ride" />);
    expect(JSON.stringify(toJSON())).toContain('Ride');
    expect(JSON.stringify(toJSON())).toContain('Book a ride');
  });

  it('renders MetricTile with label and value', () => {
    const { toJSON } = render(<MetricTile label="Distance" value="12 km" />);
    expect(JSON.stringify(toJSON())).toContain('Distance');
    expect(JSON.stringify(toJSON())).toContain('12 km');
  });

  it('renders StatusPill with label', () => {
    const { toJSON } = render(<StatusPill label="In Progress" />);
    expect(JSON.stringify(toJSON())).toContain('In Progress');
  });

  it('renders StateNotice with loading indicator', () => {
    const { getByTestId } = render(<StateNotice icon="car" title="Loading..." loading testID="state-notice" />);
    expect(getByTestId('state-notice')).toBeTruthy();
  });

  it('renders PrimaryButton with label and icon', () => {
    const { toJSON } = render(<PrimaryButton label="Continue" icon="arrow-forward" onPress={() => {}} />);
    expect(JSON.stringify(toJSON())).toContain('Continue');
  });

  it('renders ActionRow with label and value', () => {
    const { toJSON } = render(<ActionRow icon="car" label="Ride" value="2 km" onPress={() => {}} />);
    expect(JSON.stringify(toJSON())).toContain('Ride');
    expect(JSON.stringify(toJSON())).toContain('2 km');
  });

  it('renders RoutePreview with endpoints and stats', () => {
    const { toJSON } = render(<RoutePreview from="Amman" to="Zarqa" eta="25 min" distance="22 km" />);
    expect(JSON.stringify(toJSON())).toContain('Amman');
    expect(JSON.stringify(toJSON())).toContain('Zarqa');
    expect(JSON.stringify(toJSON())).toContain('25 min');
    expect(JSON.stringify(toJSON())).toContain('22 km');
  });
});
