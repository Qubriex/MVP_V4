// src/pages/inst/Placements.js — /institution/placements (v4.3 canvas I9):
// offers and placements, salary bands, 90-day ratings, sponsored cohorts.
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { useStaff } from '../../components/inst/InstitutionLayout';
import { Bar } from '../../components/learn/ui';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { HowCounted } from '../../components/shared/Popover';
import { SmallSample, TooFew } from '../../components/shared/SampleSize';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const STATUS = { offer: ['inst.placements.status.offer', 'ln-tag-info'], placed: ['inst.placements.status.placed', 'ln-tag-success'], declined: ['inst.placements.status.declined', 'ln-tag-warning'] };

function AddPlacement({ onDone }) {
  const { t } = useUiLang();
  const { data: cohorts } = useCachedGet('/institution/engagements');
  const [cohortId, setCohortId] = useState('');
  const [learners, setLearners] = useState([]);
  const [f, setF] = useState({ el_id: '', employer_name: '', role_title: '', status: 'offer', salary_lpa: '', offer_date: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id); }, [cohorts, cohortId]);
  useEffect(() => {
    if (!cohortId) return;
    api.get(`/institution/engagements/${cohortId}`).then(r => setLearners(r.data.learners.filter(l => l.access !== 'removed'))).catch(() => {});
  }, [cohortId]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/institution/placements', f); onDone(); } catch (err) { setMsg(errMsg(err, t('inst.placements.couldnTSave'))); }
  };
  return (
    <form className="ui-narrow ln-card" style={{ gap: 12 }} onSubmit={save}>
      <h2 className="ln-h2">{t('inst.placements.recordOfferPlacement')}</h2>
      <div className="ln-grid ln-g-3" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-c">{t('inst.placements.cohort')}</label><Select id="pl-c" value={cohortId} onChange={e => { setCohortId(e.target.value); setF(x => ({ ...x, el_id: '' })); }}>{(cohorts || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-s">{t('inst.placements.student')}</label><Select id="pl-s" value={f.el_id} onChange={set('el_id')} required><option value="">{t('inst.placements.choose')}</option>{learners.map(l => <option key={l.el_id} value={l.el_id}>{l.name} · {l.learner_ref}</option>)}</Select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-st">{t('inst.placements.status')}</label><Select id="pl-st" value={f.status} onChange={set('status')}><option value="offer">{t('inst.placements.offer')}</option><option value="placed">{t('inst.placements.placedJoined')}</option><option value="declined">{t('inst.placements.declined')}</option></Select></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-e">{t('inst.placements.employer')}</label><input id="pl-e" className="ln-input" value={f.employer_name} onChange={set('employer_name')} required /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-r">{t('inst.placements.role')}</label><input id="pl-r" className="ln-input" value={f.role_title} onChange={set('role_title')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-sal">{t('inst.placements.salaryLpa')}</label><input id="pl-sal" type="number" step="0.1" min="0" className="ln-input" value={f.salary_lpa} onChange={set('salary_lpa')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="pl-d">{t('inst.placements.offerDate')}</label><input id="pl-d" type="date" className="ln-input" value={f.offer_date} onChange={set('offer_date')} /></div>
      </div>
      {msg && <div className="ln-error" role="alert">{msg}</div>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary">{t('inst.placements.save')}</button><button type="button" className="ln-btn" onClick={() => onDone(false)}>{t('inst.placements.cancel')}</button></div>
    </form>
  );
}

function Rate({ p, onDone }) {
  const { t } = useUiLang();
  const [n, setN] = useState(p.rating_90d || 0);
  const save = async (v) => { setN(v); await api.put(`/institution/placements/${p.id}`, { rating_90d: v }).catch(() => {}); onDone(); };
  return (
    <span className="ln-row" style={{ gap: 2 }} role="radiogroup" aria-label={t('inst.placements.90DayRatingName', { name: p.name })}>
      {[1, 2, 3, 4, 5].map(v => (
        <button key={v} type="button" role="radio" aria-checked={n === v} aria-label={t('inst.placements.v5', { v })} onClick={() => save(v)} style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', color: v <= n ? 'var(--accent-400)' : 'var(--color-text-muted)' }}>
          <Star size={15} fill={v <= n ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

function Sponsorships({ isAdmin }) {
  const { t } = useUiLang();
  const { data, reload } = useCachedGet('/institution/sponsorships');
  const { data: cohorts } = useCachedGet('/institution/engagements');
  const [pick, setPick] = useState({});
  if (!data?.length) return null;
  const decide = async (id, accept) => { await api.post(`/institution/sponsorships/${id}/decide`, { accept, engagement_id: pick[id] || undefined }).catch(() => {}); dropCached('/institution/sponsorships'); reload(); };
  return (
    <section className="ln-card" style={{ gap: 10 }}>
      <h2 className="ln-h2">{t('inst.placements.sponsorshipOffersFromEmployers')}</h2>
      {data.map(s => (
        <div key={s.id} className="ln-tile" style={{ padding: 14, gap: 6, textAlign: 'left', alignItems: 'stretch' }}>
          <div className="ln-between ln-wrap" style={{ gap: 8 }}><b>{t('inst.placements.employerSeatsSeat', { employer: s.employer, seats: s.seats })}{s.role_title ? ` · ${t('inst.placements.forRole', { role: s.role_title })}` : ''}</b>
            <span className={`ln-tag ${s.status === 'proposed' ? 'ln-tag-warning' : s.status === 'accepted' ? 'ln-tag-success' : 'ln-tag-neutral'}`}>{s.status === 'proposed' ? t('inst.placements.waiting') : s.status}</span></div>
          {s.interview_promise ? <span className="ln-xs">{t('inst.placements.interviewPromisedEachStudent')}</span> : null}
          {s.message && <span className="ln-small">“{s.message}”</span>}
          {s.status === 'proposed' && isAdmin && (
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <Select style={{ minHeight: 34, width: 240 }} aria-label={t('inst.placements.cohortSponsor')} value={pick[s.id] || ''} onChange={e => setPick(p => ({ ...p, [s.id]: e.target.value }))}><option value="">{t('inst.placements.chooseCohort')}</option>{(cohorts || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
              <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" disabled={!pick[s.id]} onClick={() => decide(s.id, true)}>{t('inst.placements.accept')}</button>
              <button type="button" className="ln-btn ln-btn-sm" onClick={() => decide(s.id, false)}>{t('inst.placements.decline')}</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function Placements() {
  const { t } = useUiLang();
  const { role } = useStaff();
  const { data, error, reload } = useCachedGet('/institution/placements');
  const [adding, setAdding] = useState(false);
  const refresh = () => { dropCached('/institution/placements'); dropCached('/institution/command-centre'); reload(); };
  if (error && !data) return <div className="ln-error">{errMsg(error, t('inst.placements.couldnTLoadPlacements'))}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const { rows, summary: s } = data;
  const canEdit = role !== 'viewer';
  const maxBand = Math.max(1, ...s.salary_bands.map(b => b.count));
  const remove = async (id) => { if (window.confirm(t('inst.placements.deleteRecord'))) { await api.delete(`/institution/placements/${id}`).catch(() => {}); refresh(); } };
  const setStatus = async (id, status) => { await api.put(`/institution/placements/${id}`, { status }).catch(() => {}); refresh(); };
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('inst.placements.placements')}</h1><span className="ln-sub">{t('inst.placements.offersJoiningsHowStudents')}</span></div>
        {canEdit && !adding && <button type="button" className="ln-btn ln-btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />{t('inst.placements.recordOffer')}</button>}
      </header>
      <Sponsorships isAdmin={role === 'admin'} />
      {adding && <AddPlacement onDone={(ok = true) => { setAdding(false); if (ok) refresh(); }} />}
      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.placements.placed')}</span><span className="ln-stat">{s.placed}</span><span className="ln-xs ln-muted">{t('inst.placements.studentsWhoJoined')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.placements.offers')}</span><span className="ln-stat">{s.offers}</span><span className="ln-xs ln-muted">{t('inst.placements.notDeclined')}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.placements.medianSalary')}</span><span className="ln-stat">{s.median_salary_lpa != null ? t('inst.placements.lpa', { n: s.median_salary_lpa }) : '—'}</span><TooFew n={s.offers} compact><SmallSample n={s.offers} /></TooFew></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('inst.placements.90DayRating')}</span><span className="ln-stat">{s.avg_rating_90d != null ? `${s.avg_rating_90d} / 5` : '—'}</span><span className="ln-xs ln-muted">{t('inst.placements.rated90dRatedSponsored', { rated_90d: s.rated_90d, sponsored_cohorts: s.sponsored_cohorts })}{s.sponsored_cohorts === 1 ? '' : 's'}</span></div>
      </div>
      <section className="ln-card" style={{ gap: 10 }}>
        <div className="ln-between"><h2 className="ln-h2">{t('inst.placements.salaryBands')}</h2><SmallSample n={s.offers} /></div>
        <TooFew n={s.offers}>
          {s.salary_bands.map(b => (
            <div key={b.label} className="ln-row" style={{ gap: 10 }}>
              <span className="ln-small" style={{ width: 130 }}>{b.label}</span>
              <div style={{ flex: 1 }}><Bar pct={(b.count / maxBand) * 100} label={`${b.label}: ${b.count}`} /></div>
              <b style={{ width: 28, textAlign: 'right' }}>{b.count}</b>
            </div>
          ))}
        </TooFew>
        <HowCounted>{t('inst.placements.offersWereNotDeclined')}</HowCounted>
      </section>
      {rows.length === 0 ? <EmptyState title={t('inst.placements.noOffersRecordedYet')} text={t('inst.placements.recordEachOfferHere')} /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('inst.placements.student')}</th><th>{t('inst.placements.employerRole')}</th><th>{t('inst.placements.status')}</th><th>{t('inst.placements.salary')}</th><th>{t('inst.placements.90DayRating')}</th><th /></tr></thead>
          <tbody>{rows.map(p => (
            <tr key={p.id}>
              <td><b style={{ fontWeight: 600 }}>{p.name || '—'}</b> <span className="ln-xs ln-muted">{p.cohort}</span></td>
              <td className="ln-small">{p.employer_name}{p.role_title ? ` · ${p.role_title}` : ''}{p.source === 'employer' ? <span className="ln-tag ln-tag-info" style={{ marginLeft: 6 }}>{t('inst.placements.fromEmployer')}</span> : null}</td>
              <td>{canEdit ? (
                <Select style={{ minHeight: 32, width: 120 }} aria-label={t('inst.placements.status')} value={p.status} onChange={e => setStatus(p.id, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v[0])}</option>)}</Select>
              ) : <span className={`ln-tag ${STATUS[p.status][1]}`}>{t(STATUS[p.status][0])}</span>}</td>
              <td>{p.salary_lpa ? t('inst.placements.lpa', { n: p.salary_lpa }) : '—'}</td>
              <td>{p.status === 'placed' && canEdit ? <Rate p={p} onDone={refresh} /> : p.rating_90d ? `${p.rating_90d} / 5` : '—'}</td>
              <td>{role === 'admin' && <button type="button" className="in-iconbtn" onClick={() => remove(p.id)} aria-label={t('inst.placements.deleteRecord2')}><Trash2 size={15} aria-hidden="true" /></button>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
