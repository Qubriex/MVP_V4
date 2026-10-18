// src/components/shared/SignInBar.js — slim header on the sign-in pages:
// "← Back to home" and the shared language switch. The logo sits in the
// page's dark side panel (which stays visible on phones).
import React from 'react';
import { Link } from 'react-router-dom';
import { useUiLang } from '../../context/UiLangContext';
import LangSwitch from './LangSwitch';

export default function SignInBar() {
  const { t } = useUiLang();
  return (
    <div className="ui-signin-bar">
      <Link to="/" className="ln-link pb-back">← {t('nav.backHome')}</Link>
      <LangSwitch />
    </div>
  );
}
