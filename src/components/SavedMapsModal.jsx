import { useI18n } from '../i18n/I18nContext.jsx';
import { useConfirm } from './ConfirmProvider.jsx';

export default function SavedMapsModal({ maps, onClose, onLoad, onDelete }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const SHAPE_LABEL_KEYS = { Linear: 'shapeLinear', Sprawl: 'shapeSprawl', Spiral: 'shapeSpiral', Web: 'shapeWeb' };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="panel-header flex items-center justify-between">
          <span>{t('savedMapsTitle')}</span>
          <button onClick={onClose} className="text-forge-parchment/70 hover:text-forge-gold">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {maps.length === 0 ? (
            <div className="text-center text-forge-parchment/60 py-10 italic">
              {t('noSavedMaps')}
            </div>
          ) : (
            maps.map((m) => (
              <div
                key={m.id}
                className="bg-forge-bg border border-forge-border rounded p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-forge-gold font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-forge-parchment/70 flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <span>{t('setLabel')}: {m.tileSetName || '—'}</span>
                    <span>{t('sizeLabel')}: {m.dim}×{m.dim}</span>
                    <span>{t('shape')}: {t(SHAPE_LABEL_KEYS[m.params?.shape] || 'shapeSprawl')}</span>
                    <span className="font-mono">{t('seed')}:{m.seed}</span>
                    <span>{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => onLoad(m.id)}>
                    {t('load')}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={async () => {
                      if (await confirm({ message: t('deleteConfirm', { name: m.name }), okText: t('deleteAction'), danger: true })) onDelete(m.id);
                    }}
                  >
                    {t('deleteAction')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
