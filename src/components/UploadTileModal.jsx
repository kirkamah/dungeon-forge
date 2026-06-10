import { useEffect, useState, useRef } from 'react';
import { TILE_TYPE_KEYS, defaultOpeningsFor } from '../engine/tileRules.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import OpeningsEditor from './OpeningsEditor.jsx';
import TypeInfo from './TypeInfo.jsx';

export default function UploadTileModal({ onClose, onUpload, initialFiles = null }) {
  const { t } = useI18n();
  const [type, setType] = useState('STRAIGHT');
  const [openings, setOpenings] = useState(defaultOpeningsFor('STRAIGHT'));
  const [files, setFiles] = useState(initialFiles || []);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [name, setName] = useState(
    initialFiles?.length === 1 ? initialFiles[0].name.replace(/\.[^.]+$/, '') : ''
  );
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();

  // Reset openings whenever the user changes the type
  useEffect(() => {
    setOpenings(defaultOpeningsFor(type));
  }, [type]);

  // Build a temporary preview from the first selected file
  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(files[0]);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    if (list.length === 1) setName(list[0].name.replace(/\.[^.]+$/, ''));
    else setName('');
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const n = files.length === 1
          ? (name || f.name.replace(/\.[^.]+$/, ''))
          : f.name.replace(/\.[^.]+$/, '');
        await onUpload({ type, file: f, name: n, openings });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-lg max-h-full overflow-hidden flex flex-col"
      >
        <div className="panel-header flex items-center justify-between">
          <span>{t('uploadTileTitle')}</span>
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
            <label className="label block mb-1">{t('imageFile')}</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              className="text-sm text-forge-parchment file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-forge-gold file:text-forge-onAccent file:font-bold file:cursor-pointer"
            />
            {files.length > 0 && (
              <div className="text-xs text-forge-parchment/70 mt-1">
                {files.length === 1 ? t('filesSelectedOne') : t('filesSelectedMany', { n: files.length })}
              </div>
            )}
          </div>

          {files.length === 1 && (
            <div>
              <label className="label block mb-1">{t('displayName')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder={t('displayNamePlaceholder')}
              />
            </div>
          )}

          <OpeningsEditor
            value={openings}
            onChange={setOpenings}
            type={type}
            previewUrl={previewUrl}
          />

          <div className="text-xs text-forge-parchment/60 italic">
            {t('uploadHint')}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>{t('cancel')}</button>
            <button
              className="btn-gold"
              onClick={handleUpload}
              disabled={busy || files.length === 0}
            >
              {busy ? t('uploading') : `${t('upload')}${files.length > 1 ? ' ' + files.length : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
