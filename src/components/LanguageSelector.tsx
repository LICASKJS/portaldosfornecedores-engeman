import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value); 
  };

  return (
    <div>
      <label htmlFor="language-select" style={{ fontSize: '18px', marginRight: '10px' }}>
        {i18n.t('language')}
      </label>
      <select
        id="language-select"
        onChange={handleLanguageChange}
        defaultValue={i18n.language} 
        style={{
          padding: '10px',
          fontSize: '16px',
          backgroundColor: '#f97316',
          color: '#fff',
          borderRadius: '5px',
        }}
      >
        <option value="en">English</option>
        <option value="pt">Português</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
};

export default LanguageSelector;
