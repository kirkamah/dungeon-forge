import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const ConfirmContext = createContext(null);

// Themed replacement for window.confirm(). useConfirm() returns an async
// function: await confirm({ message, title?, okText?, danger? }) → boolean.
export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [state, setState] = useState(null);

  const confirm = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise((resolve) => setState({ ...o, resolve }));
  }, []);

  const close = useCallback((result) => {
    setState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
          onClick={() => close(false)}
        >
          <div
            className="panel w-[min(420px,100%)] bg-forge-panel2 shadow-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-forge-border font-medieval text-lg text-forge-gold tracking-wide">
              {state.title || t('confirmTitle')}
            </div>
            <div className="px-4 py-4 text-sm text-forge-ink leading-relaxed">
              {state.message}
            </div>
            <div className="px-4 py-3 border-t border-forge-border flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => close(false)}>{t('cancel')}</button>
              <button
                className={
                  state.danger
                    ? 'bg-forge-blood text-white font-bold uppercase tracking-wider px-4 py-2 rounded hover:brightness-110 transition active:scale-[0.98]'
                    : 'btn-gold'
                }
                onClick={() => close(true)}
              >
                {state.okText || t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
