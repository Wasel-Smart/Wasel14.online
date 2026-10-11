import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Route } from 'lucide-react';
import type { QuickAction } from './types';
import { tx } from '../../../locales/tx';
import { useLanguage } from '../../../contexts/LanguageContext';
import { toAppHref } from '../../../hooks/useIframeSafeNavigate';
import { handleSpaLinkClick } from '../../../utils/linkNavigation';

interface QuickActionsSectionProps {
  quickActions: QuickAction[];
  onNavigate: (path: string, source?: string) => void;
}

export function QuickActionsSection({ quickActions, onNavigate }: QuickActionsSectionProps) {
  const { dir } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  return (
    <motion.section initial={false} className="wasel-home-section">
      <div className="wasel-home-section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="wasel-home-section-icon">
            <Route size={16} />
          </div>
          <h2 className="wasel-home-section-title">
            {tx('homeSections.quickActionsTitle')}
          </h2>
        </div>
      </div>
      <div className="wasel-home-actions">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <motion.a
              key={action.path}
              href={toAppHref(action.path)}
              onClick={event =>
                handleSpaLinkClick(event, () =>
                  onNavigate(
                    action.path,
                    `quick_action_${action.title.toLowerCase().replace(/\s+/g, '_')}`,
                  ),
                )
              }
              whileHover={{ y: -2 }}
              className="wasel-home-action-card"
            >
              <div className="wasel-home-action-card-header">
                <div className="wasel-home-action-icon" style={{ background: action.dim, border: `1px solid ${action.border}` }}>
                  <Icon size={20} color={action.color} />
                </div>
                <div className="wasel-home-action-kicker">
                  <span className="wasel-home-action-kicker-dot" style={{ background: action.color, color: action.color }} />
                  {action.kicker}
                </div>
              </div>

              <div className="wasel-home-action-title">{action.title}</div>
              <div className="wasel-home-action-desc">{action.desc}</div>
              <div className="wasel-home-action-outcome">{action.outcome}</div>

              <div className="wasel-home-action-cta" style={{ color: action.color }}>
                {tx('homeSections.quickActionsCTA')}
                <ArrowIcon size={13} />
              </div>
            </motion.a>
          );
        })}
      </div>
    </motion.section>
  );
}
