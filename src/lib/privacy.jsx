import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PrivacyCtx = createContext({ hidden: false, toggle: () => {} });

export function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('dw.hidden') === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setHidden((current) => {
      try {
        localStorage.setItem('dw.hidden', current ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !current;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyCtx.Provider value={value}>{children}</PrivacyCtx.Provider>;
}

export const usePrivacy = () => useContext(PrivacyCtx);
