// src/pages/public/Developers.js — /developers: for engineering teams that
// check Passports automatically (ATS integrations). The technical links that
// used to sit at the bottom of Verify live here, out of employers' way.
import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, FileJson, ListChecks, Files } from 'lucide-react';
import PublicShell, { BackHome } from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';

const API = process.env.REACT_APP_API_BASE_URL || '/api';
const ITEMS = [
  ['dev.keys', KeyRound, `${API}/verify/jwks.json`, true],
  ['dev.did', FileJson, '/.well-known/did.json', true],
  ['dev.status', ListChecks, null, false],
  ['dev.bulk', Files, '/employer/verify-bulk', false]
];

export default function Developers() {
  const { t } = useUiLang();
  return (
    <PublicShell>
      <BackHome />
      <article className="ln-col ui-narrow" style={{ gap: 14 }}>
        <h1 className="ln-title">{t('dev.title')}</h1>
        <p className="ln-sub" style={{ margin: 0 }}>{t('dev.sub')}</p>
        {ITEMS.map(([key, Icon, href, external]) => (
          <section key={key} className="ln-card" style={{ gap: 6 }}>
            <b className="ln-row" style={{ gap: 8 }}><Icon size={18} aria-hidden="true" />{t(`${key}.title`)}</b>
            <span className="ln-small">{t(`${key}.text`)}</span>
            {href && (external
              ? <a className="ln-link ln-small" href={href} target="_blank" rel="noopener noreferrer"><code>{href}</code></a>
              : <Link className="ln-link ln-small" to={href}>{t(`${key}.link`)}</Link>)}
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
