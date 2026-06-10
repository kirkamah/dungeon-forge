import { useI18n } from '../i18n/I18nContext.jsx';

export default function TypeInfo({ type }) {
  const { t } = useI18n();
  return (
    <div className="text-xs bg-forge-bg/60 border border-forge-border rounded p-2">
      <div className="text-forge-gold uppercase tracking-wider text-[10px] mb-0.5">
        {t('requirements')}
      </div>
      <div className="text-forge-parchment">{t(`req_${type}`)}</div>
    </div>
  );
}
