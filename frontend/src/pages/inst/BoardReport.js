// src/pages/inst/BoardReport.js — /institution/board-report?lang=en|te
// (v4.3 canvas I1): one printable page for the board or principal, in
// English or Telugu. "Save as PDF" uses the browser's print dialog.
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useCachedGet } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { TooFew } from '../../components/shared/SampleSize';

const T = {
  en: {
    title: 'Board report', generated: 'Prepared on', target: 'Placement target', by: 'by', none: 'No target set',
    cohort: 'Cohort', students: 'Students', ready: 'Ready', nearly: 'Nearly ready', building: 'Building', active: 'Active in last 30 days', logs: 'Mastery Logs', gap: 'Skill holding most back',
    placements: 'Placements', placed: 'Placed', offers: 'Offers', median: 'Median salary', rating: '90-day rating', sponsored: 'Sponsored cohorts',
    how: 'How it is counted: readiness is the match between a student’s verified skills and the best-fitting job role (Ready 80+, Nearly ready 60–79, Building under 60). Groups under 5 students are not shown.',
    print: 'Save as PDF', other: 'తెలుగులో చూడండి', otherLang: 'te', back: 'Back to Home', lpa: 'LPA'
  },
  te: {
    title: 'బోర్డు నివేదిక', generated: 'తయారైన తేదీ', target: 'ప్లేస్‌మెంట్ లక్ష్యం', by: 'గడువు', none: 'లక్ష్యం పెట్టలేదు',
    cohort: 'బ్యాచ్', students: 'విద్యార్థులు', ready: 'సిద్ధం', nearly: 'దాదాపు సిద్ధం', building: 'నేర్చుకుంటున్నారు', active: 'గత 30 రోజుల్లో చురుకుగా', logs: 'మాస్టరీ లాగ్‌లు', gap: 'ఎక్కువగా వెనక్కి లాగుతున్న నైపుణ్యం',
    placements: 'ప్లేస్‌మెంట్లు', placed: 'చేరినవారు', offers: 'ఆఫర్లు', median: 'మధ్యస్థ జీతం', rating: '90 రోజుల రేటింగ్', sponsored: 'స్పాన్సర్ చేసిన బ్యాచ్‌లు',
    how: 'ఎలా లెక్కిస్తాం: విద్యార్థి ధృవీకరించిన నైపుణ్యాలు సరిపోయే ఉద్యోగ పాత్రకు ఎంత సరిపోతాయో అదే సిద్ధత (80+ సిద్ధం, 60–79 దాదాపు సిద్ధం, 60 కంటే తక్కువ నేర్చుకుంటున్నారు). 5 కంటే తక్కువ మంది ఉన్న గుంపులు చూపించము.',
    print: 'PDF గా సేవ్ చేయండి', other: 'View in English', otherLang: 'en', back: 'హోమ్‌కు తిరిగి', lpa: 'లక్షలు'
  }
};

export default function BoardReport() {
  const [params] = useSearchParams();
  const lang = params.get('lang') === 'te' ? 'te' : 'en';
  const t = T[lang];
  const { data, error } = useCachedGet('/institution/board-report');
  if (error && !data) return <div className="ln-error">{errMsg(error, 'Couldn’t prepare the report.')}</div>;
  if (!data) return <p className="ln-muted">Loading…</p>;
  const { institution: inst, cohorts, placements: p } = data;
  const when = (s) => new Date(s).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className={`sk-report ${lang === 'te' ? 'ln-indic' : ''}`} lang={lang}>
      <div className="ln-row ln-wrap sk-noprint" style={{ gap: 8 }}>
        <Link to="/institution/home" className="ln-btn ln-btn-sm">← {t.back}</Link>
        <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" onClick={() => window.print()}><Printer size={14} aria-hidden="true" />{t.print}</button>
        <Link to={`/institution/board-report?lang=${t.otherLang}`} className="ln-btn ln-btn-sm">{t.other}</Link>
      </div>
      <header className="ln-col" style={{ gap: 4 }}>
        <span className="ln-kicker">{inst?.name}{inst?.city ? ` · ${inst.city}` : ''}</span>
        <h1 className="ln-title" style={{ fontSize: 30 }}>{t.title}</h1>
        <span className="ln-small ln-muted">{t.generated} {when(data.generated_at)}</span>
      </header>
      <section className="ln-card" style={{ gap: 6 }}>
        <span className="ln-label">{t.target}</span>
        <b style={{ fontSize: 18 }}>{inst?.mou_target_pct ? `${inst.mou_target_pct}% · ${inst.mou_target_label || ''}${inst.mou_target_date ? ` · ${t.by} ${when(inst.mou_target_date)}` : ''}` : t.none}</b>
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
          <div className="ln-tile"><b style={{ fontSize: 20 }}>{p.placed}</b><span className="ln-xs ln-muted">{t.placed}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 20 }}>{p.offers}</b><span className="ln-xs ln-muted">{t.offers}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 20 }}>{p.offers >= 5 && p.median_salary_lpa != null ? `${p.median_salary_lpa} ${t.lpa}` : '—'}</b><span className="ln-xs ln-muted">{t.median}</span></div>
          <div className="ln-tile"><b style={{ fontSize: 20 }}>{p.rated_90d >= 5 && p.avg_rating_90d != null ? `${p.avg_rating_90d} / 5` : '—'}</b><span className="ln-xs ln-muted">{t.rating}</span></div>
        </div>
        <span className="ln-small">{t.sponsored}: {p.sponsored_cohorts}</span>
      </section>
      <p className="ln-xs ln-muted">{t.how}</p>
    </div>
  );
}
