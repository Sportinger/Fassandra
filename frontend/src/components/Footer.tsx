import React from 'react';

type FooterProps = {
  language?: 'de' | 'en';
};

export const Footer: React.FC<FooterProps> = ({ language = 'de' }) => {
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const t = (de: string, en: string) => (language === 'de' ? de : en);

  return (
    <footer style={{
      borderTop: '1px solid #e5e7eb',
      padding: '12px 16px',
      display: 'flex',
      gap: 16,
      justifyContent: 'center',
      color: '#6b7280',
      fontSize: 14,
      marginTop: 24,
    }}>
      <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
        {t('Datenschutz', 'Privacy Policy')}
      </button>
      <span>•</span>
      <button onClick={() => navigate('/imprint')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
        {t('Impressum', 'Imprint')}
      </button>
    </footer>
  );
};

export default Footer;

