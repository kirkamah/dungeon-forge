import { useEffect, useState } from 'react';
import { TILE_TYPE_KEYS, defaultOpeningsFor, effectiveOpenings } from '../engine/tileRules.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { getTileImageURL } from '../storage/tileStorage.js';
import OpeningsEditor from './OpeningsEditor.jsx';
import TypeInfo from './TypeInfo.jsx';

export default function EditTileModal({ tile, onClose, onSave }) {
  const { t } = useI18n();
  const [type, setType] = useState(tile.type);
  const [name, setName] = useState(tile.name || '');
  const [openings, setOpenings] = useState(effectiveOpenings(tile));
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancel = false;
    getTileImageURL(tile.id).then((u) => { if (!cancel) setPreviewUrl(u); });
    return () => { cancel = true; };
  }, [tile.id]);

  // If the user changes type, reset openings to that type's default
  useEffect(() => {
    if (type !== tile.type) setOpenings(defaultOpeningsFor(type));
  }, [type, tile.type]);

  const handleSave = () => {
    onSave({ ...tile, type, name: name || tile.name, openings });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-lg max-h-full overflow-hidden flex flex-col"
      >
        <div className="panel-header flex items-center justify-between">
          <span>{t('editTileTitle')}</span>
          <button onClick={onClose} className="text-forge-parchment/70 hover:text-forge-gold">✕</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="label block mb-1">{t('tileType')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input w-full"
            >
              {TILE_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>{t(`type${k}`)}</option>
              ))}
            </select>
          </div>

          <TypeInfo type={type} />

          <div>
            <label className="label block mb-1">{t('displayName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
            />
          </div>

          <OpeningsEditor
            value={openings}
            onChange={setOpenings}
            type={type}
            previewUrl={previewUrl}
          />

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
            <button className="btn-gold" onClick={handleSave}>{t('save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
