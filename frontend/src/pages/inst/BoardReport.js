// src/pages/inst/BoardReport.js — /institution/board-report?lang=en|te|hi
// (v4.3 canvas I1): one printable page for the board or principal, in
// English, Telugu or Hindi (independent of the screen language). "Save as PDF" uses the browser's print dialog.
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useCachedGet } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { TooFew } from '../../components/shared/SampleSize';

import { useUiLang, translate, formatDate } from '../../context/UiLangContext';
const KEYS = ['title', 'generated', 'target', 'by', 'none', 'cohort', 'students', 'ready', 'nearly', 'building', 'active', 'logs', 'gap', 'placements', 'placed', 'offers', 'median', 'rating', 'sponsored', 'how', 'print', 'back', 'lpa'];
const REPORT_LANGS = [['en', 'english', 'English'], ['te', 'telugu', 'తెలుగు'], ['hi', 'hindi', 'हिंदी']];

export default function BoardReport() {
  const { t: tx, lang: uiLang0 } = useUiLang();
  const [params] = useSearchParams();
  // ?lang= picks the report language; without it the report follows the screen.
  const lang = (REPORT_LANGS.find(l => l[0] === params.get('lang')) || REPORT_LANGS.find(l => l[1] === uiLang0) || REPORT_LANGS[0])[0];
  const uiLang = REPORT_LANGS.find(l => l[0] === lang)[1];
  const t = Object.fromEntries(KEYS.map(k => [k, translate(uiLang, `inst.boardReport.r.${k}`)]));
  const { data, error } = useCachedGet('/institution/board-report');
  if (error && !data) return <div className="ln-error">{errMsg(error, tx('inst.boardReport.couldnTPrepareReport'))}</div>;
  if (!data) return <p className="ln-muted">{tx('inst.boardReport.loading')}</p>;
  const { institution: inst, cohorts, placements: p } = data;
  const when = (s) => formatDate(uiLang, s, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className={`sk-report ${lang !== 'en' ? 'ln-indic' : ''}`} lang={lang}>
      <div className="ln-row ln-wrap sk-noprint" style={{ gap: 8 }}>
        <Link to="/institution/home" className="ln-btn ln-btn-sm">← {t.back}</Link>
        <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => window.print()}><Printer size={14} aria-hidden="true" />{t.print}</button>
        <div className="ln-row" style={{ gap: 6 }} role="group" aria-label={translate(uiLang, 'inst.boardReport.r.lang')}>
          {REPORT_LANGS.map(([code, , label]) => <Link key={code} to={`/institution/board-report?lang=${code}`} lang={code} aria-current={code === lang ? 'true' : undefined} className={`ln-btn ln-btn-sm ln-indic ${code === lang ? 'ln-btn-primary' : ''}`}>{label}</Link>)}
        </div>
      </div>
      <header className="ln-col" style={{ gap: 4 }}>
        <span className="ln-kicker">{inst?.name}{inst?.city ? ` · ${inst.city}` : ''}</span>
        <h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{t.title}</h1>
        <span className="ln-small ln-muted">{t.generated} {when(data.generated_at)}</span>
      </header>
      <section className="ln-card" style={{ gap: 6 }}>
        <span className="ln-label">{t.target}</span>
        <b style={{ fontSize: 'var(--fs-h3)' }}>{inst?.mou_target_pct ? `${inst.mou_target_pct}% · ${inst.mou_target_label || ''}${inst.mou_target_date ? ` · ${t.by} ${when(inst.mou_target_date)}` : ''}` : t.none}</b>
      </section>
      <div className="ln-tablewrap"><table className="ln-table">
        <thead><tr><th>{t.cohort}</th><th>{t.students}</th><th>{t.ready}</th><th>{t.nearly}</th><th>{t.building}</th><th>{t.active}</th><th>{t.logs}</th><th>{t.gap}</th></tr></thead>
        <tbody>{cohorts.map(c => (
          <tr key={c.cohort}><td><b style={{ fontWeight: 600 }}>{c.cohort}</b></td><td>{c.students}</td>
            {c.students < 5 ? <td colSpan={5}><TooFew n={c.students} compact /></td> : <><td>{c.ready}</td><td>{c.nearly}</td><td>{c.building}</td><td>{c.active_30d}</td><td>{c.mastery_logs}</td></>}
            <td className="ln-small">{c.students < 5 ? '' : c.top_gap || '—'}</td></tr>
        ))}</tbody></table></div>
      <section className="ln-card" style={{ gap: 8 }}>
        <h2 className="ln-h2">{t.placements}</h2>
        <div className="ln-grid ln-g-4" style={{ gap: 10 }}>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{p.placed}</b><span className="ln-xs ln-muted">{t.placed}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{p.offers}</b><span className="ln-xs ln-muted">{t.offers}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{p.offers >= 5 && p.median_salary_lpa != null ? `${p.median_salary_lpa} ${t.lpa}` : '—'}</b><span className="ln-xs ln-muted">{t.median}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 'var(--fs-h2)' }}>{p.rated_90d >= 5 && p.avg_rating_90d != null ? `${p.avg_rating_90d} / 5` : '—'}</b><span className="ln-xs ln-muted">{t.rating}</span></div>
        </div>
        <span className="ln-small">{t.sponsored}: {p.sponsored_cohorts}</span>
      </section>
      <p className="ln-xs ln-muted">{t.how}</p>
    </div>
  );
}
