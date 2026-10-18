// Toasts: success / error / info, announced to screen readers, auto-dismissed.
// <ToastProvider> wraps the app; const toast = useToast(); toast.success('Saved').
import React, { useEffect, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

import { useUiLang } from '../../../context/UiLangContext';
const Ctx = createContext(null);
const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const { t } = useUiLang();
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setItems(xs => xs.filter(x => x.id !== id)), []);
  const push = useCallback((kind, text, ms = kind === 'error' ? 7000 : 4000) => {
    const id = ++seq.current;
    setItems(xs => [...xs.slice(-3), { id, kind, text }]);
    setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);
  // Successful changes made through the API client (see utils/api.js).
  useEffect(() => {
    const on = (e) => push('success', t(e.detail?.kind === 'deleted' ? 'toast.deleted' : 'toast.saved'), 2500);
    window.addEventListener('qubirex:saved', on);
    return () => window.removeEventListener('qubirex:saved', on);
  }, [push, t]);
  const api = useMemo(() => ({ success: (t, ms) => push('success', t, ms), error: (t, ms) => push('error', t, ms), info: (t, ms) => push('info', t, ms), dismiss }), [push, dismiss]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite" aria-relevant="additions">
        {items.map(x => {
          const Icon = ICON[x.kind];
          return (
            <div key={x.id} className={`ui-toast ui-toast-${x.kind}`} role={x.kind === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden="true" /><span>{x.text}</span>
              <button type="button" className="ui-toast-x" aria-label={t('ui.toast.close')} onClick={() => dismiss(x.id)}><X size={14} aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

const noop = { success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} };
export const useToast = () => useContext(Ctx) || noop;
