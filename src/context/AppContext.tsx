import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Language, TranslationDictionary, translations } from '../i18n/translations';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof TranslationDictionary) => string;
  toast: (msg: string) => void;
}

const AppContext = createContext<AppContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  toast: () => {},
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const t = (key: keyof TranslationDictionary): string => {
    return translations[lang]?.[key] ?? translations.en[key] ?? key;
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMsg('');
    }, 2800);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <AppContext.Provider value={{ lang, setLang, t, toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-xl border border-white/20 bg-[#263B52]/95 px-5 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-all duration-300 ${
          toastMsg ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        {toastMsg}
      </div>
    </AppContext.Provider>
  );
};
