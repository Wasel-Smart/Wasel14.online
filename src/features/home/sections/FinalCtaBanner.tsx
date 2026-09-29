import { motion, useReducedMotion } from 'framer-motion';
import { Route, Globe2, ArrowRight, ArrowLeft } from 'lucide-react';
import { WaselButton } from '../../../components/wasel-ui/WaselButton';
import { useLanguage } from '../../../contexts/LanguageContext';
import { C } from '../HomePageShared';

interface FinalCtaBannerProps {
  ar: boolean;
  onNavigate: (path: string, source?: string) => void;
}

export function FinalCtaBanner({ ar, onNavigate }: FinalCtaBannerProps) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'visible'}
      viewport={{ once: true, margin: '-80px' }}
      className="wasel-home-section"
    >
      <div className="wasel-home-cta-banner">
        <h2 className="wasel-home-cta-title">
          {t('homeSections.finalCtaTitle')}
        </h2>
        <p className="wasel-home-cta-subtitle">
          {t('homeSections.finalCtaSubtitle')}
        </p>
        <div className="wasel-home-cta-actions">
          <WaselButton
            type="button"
            variant="primary"
            size="lg"
            icon={<Route size={17} />}
            iconEnd={ar ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            onClick={() => { void onNavigate('/find-ride', 'final_cta_find'); }}
          >
            {t('homeSections.finalCtaFind')}
          </WaselButton>
          <WaselButton
            type="button"
            variant="outline"
            size="lg"
            icon={<Globe2 size={17} />}
            onClick={() => { void onNavigate('/app/auth?tab=register', 'final_cta_register'); }}
            style={{ background: C.elevated, color: C.text, border: `1px solid ${C.border}` }}
          >
            {t('homeSections.finalCtaRegister')}
          </WaselButton>
        </div>
      </div>
    </motion.section>
  );
}