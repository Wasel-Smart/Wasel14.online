import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepCard } from '../StepCard';

describe('StepCard badge', () => {
  it('renders the badge as plain text when no action is attached', () => {
    render(
      <StepCard title="Driver documents" subtitle="sub" state="not_started" icon={<span />} badgeLabel="Not started" />,
    );
    expect(screen.getByText('Not started')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not started' })).toBeNull();
  });

  it('turns the badge into a working button when onBadgeClick is set', () => {
    const onBadgeClick = vi.fn();
    render(
      <StepCard
        title="Driver documents"
        subtitle="sub"
        state="not_started"
        icon={<span />}
        badgeLabel="Not started"
        onBadgeClick={onBadgeClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Not started' }));
    expect(onBadgeClick).toHaveBeenCalledTimes(1);
  });
});
