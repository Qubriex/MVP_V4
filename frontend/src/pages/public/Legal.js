// src/pages/public/Legal.js — /legal/:page: privacy, terms, DPDP Act 2023
// and the grievance officer. Short plain-words summaries; the full legal
// text is to be supplied and reviewed by counsel before launch.
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicShell, { BackHome } from '../../components/public/PublicShell';
import { useUiLang } from '../../context/UiLangContext';
import { CONTACT } from '../../config/contact';

const PAGES = { privacy: 4, terms: 3, dpdp: 3, grievance: 3 };

export default function Legal() {
  const { t } = useUiLang();
  const { page } = useParams();
  const key = PAGES[page] ? page : 'privacy';
  const vars = { officer: CONTACT.grievanceOfficer || t('contact.officerRole'), company: CONTACT.company, city: CONTACT.city, email: CONTACT.grievance };
  return (
    <PublicShell>
      <BackHome />
      <article className="ln-col" style={{ gap: 12, maxWidth: 760 }}>
        <h1 className="ln-title">{t(`legal.${key}`)}</h1>
        {Array.from({ length: PAGES[key] }, (_, i) => <p key={i} style={{ margin: 0 }}>{t(`legal.${key}${i + 1}`, vars)}</p>)}
        <p className="ln-xs ln-muted">{t('legal.note')}</p>
        <nav className="ln-row ln-wrap" style={{ gap: 14 }} aria-label={t('foot.legal')}>{Object.keys(PAGES).map(k => <Link key={k} to={`/legal/${k}`} className="ln-link ln-small">{t(`legal.${k}`)}</Link>)}</nav>
      </article>
    </PublicShell>
  );
}
