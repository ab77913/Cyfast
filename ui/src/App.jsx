import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter } from 'react-router-dom';

// third party
import { IntlProvider } from 'react-intl';

// project import
import { JWTProvider as AuthProvider } from './contexts/JWTContext';
// import { FirebaseProvider as AuthProvider } from './contexts/FirebaseContext';
// import { Auth0Provider as AuthProvider } from './contexts/Auth0Context';

import renderRoutes, { routes } from './routes';
import { ConfigContext } from 'contexts/ConfigContext';

function loadLocaleData(i18n) {
  switch (i18n) {
    case 'fr':
      return import('utils/locales/fr.json');
    case 'ro':
      return import('utils/locales/ro.json');
    case 'zh':
      return import('utils/locales/zh.json');
    default:
      return import('utils/locales/en.json');
  }
}

// ==============================|| APP ||============================== //

const App = () => {
  const configContext = useContext(ConfigContext);
  const { i18n } = configContext.state;
  const [messages, setMessages] = useState();

  useEffect(() => {
    loadLocaleData(i18n).then((d) => {
      setMessages(d.default);
    });
  }, [i18n]);

  return (
    <>
      {messages && (
        <IntlProvider locale={i18n} defaultLocale="en" messages={messages}>
          <BrowserRouter basename={import.meta.env.VITE_APP_BASE_NAME}>
            <AuthProvider>{renderRoutes(routes)}</AuthProvider>
          </BrowserRouter>
        </IntlProvider>
      )}
    </>
  );
};

export default App;
