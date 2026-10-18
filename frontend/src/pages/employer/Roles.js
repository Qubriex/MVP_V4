// src/pages/employer/Roles.js — /employer/roles and /employer/roles/:id
// (v4.3 canvas E2, E3). A role is made from a pasted job description: the
// skills are picked out and shown against how often the market asks for
// them. Search ranks students who opted in, anonymously; Watch is private,
// Request asks the student, near-misses lead to sponsoring a cohort.
import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Eye, Send, Handshake, X } from 'lucide-react';
import api from '../../utils/api';
import { useCachedGet, dropCached } from '../../utils/cachedGet';
import { errMsg } from '../../utils/errors';
import { Bar } from '../../components/learn/ui';
import Crumbs from '../../components/inst/Crumbs';
import EmptyState, { LoadingRows } from '../../components/shared/EmptyState';
import { WhyThis, HowCounted } from '../../components/shared/Popover';
import { useEmployer } from './Layout';
import { BandPill } from '../../components/shared/ui';
import { Select } from '../../components/shared/ui';


import { useUiLang } from '../../context/UiLangContext';
function NewRole({ onDone }) {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', city: '', jd_text: '', bar: 80, published: true, interview_promise: false });
  const [skills, setSkills] = useState(null);
  const [all, setAll] = useState([]);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const parse = async () => {
    setMsg('');
    try { const r = await api.post('/employer/roles/parse', { jd_text: f.jd_text }); setSkills(r.data.skills); setAll(r.data.all_skills); if (!r.data.skills.length) setMsg(t('emp.roles.noSkillsFoundText')); } catch (e) { setMsg(errMsg(e)); }
  };
  const save = async (e) => {
    e.preventDefault();
    try { const r = await api.post('/employer/roles', { ...f, skills }); dropCached('/employer/'); navigate(`/employer/roles/${r.data.id}`); } catch (err) { setMsg(errMsg(err, t('emp.roles.couldnTSaveRole'))); }
  };
  const add = (key) => { const s = all.find(x => x.key === key); if (s && !skills.some(x => x.key === key)) setSkills([...skills, { ...s, required: true, market_share: null }]); };
  return (
    <form className="ui-narrow ln-card" style={{ gap: 14 }} onSubmit={save}>
      <h2 className="ln-h2">{t('emp.roles.newRole')}</h2>
      <div className="ln-grid ln-g-2" style={{ gap: 12 }}>
        <div className="ln-field"><label className="ln-label" htmlFor="r-title">{t('emp.roles.roleTitle')}</label><input id="r-title" className="ln-input" value={f.title} onChange={set('title')} required placeholder={t('emp.roles.dataAnalystFresher')} /></div>
        <div className="ln-field"><label className="ln-label" htmlFor="r-city">{t('emp.roles.city')}</label><input id="r-city" className="ln-input" value={f.city} onChange={set('city')} placeholder={t('emp.roles.hyderabad')} /></div>
      </div>
      <div className="ln-field"><label className="ln-label" htmlFor="r-jd">{t('emp.roles.jobDescription')}</label>
        <textarea id="r-jd" className="ln-input" rows={7} value={f.jd_text} onChange={set('jd_text')} placeholder={t('emp.roles.pasteJobDescriptionLines')} /></div>
      <button type="button" className="ln-btn" style={{ alignSelf: 'flex-start' }} onClick={parse} disabled={f.jd_text.trim().length < 20}>{t('emp.roles.pickOutSkills')}</button>
      {skills && (
        <section className="ln-col" style={{ gap: 8 }}>
          <div className="ln-row" style={{ gap: 8 }}><span className="ln-label">{t('emp.roles.skillsBarVsMarket')}</span>
            <WhyThis title={t('emp.roles.marketShare')}>{t('emp.roles.howManyCurrentFresher')}</WhyThis></div>
          {skills.map((s, i) => (
            <div key={s.key} className="ln-row ln-wrap" style={{ gap: 10 }}>
              <span style={{ width: 180, fontWeight: 600 }}>{s.name}</span>
              <div style={{ flex: 1, minWidth: 120 }}>{s.market_share != null ? <Bar pct={s.market_share} label={t('emp.roles.marketSharePosts', { market_share: s.market_share })} /> : <span className="ln-xs ln-muted">{t('emp.roles.marketShareNotKnown')}</span>}</div>
              <span className="ln-xs ln-muted" style={{ width: 70 }}>{s.market_share != null ? t('emp.roles.pctOfPosts', { pct: s.market_share }) : ''}</span>
              <label className="ln-check ln-small"><input type="checkbox" checked={s.required} onChange={e => setSkills(skills.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />{t('emp.roles.required')}</label>
              <button type="button" className="in-iconbtn" aria-label={t('emp.roles.removeName', { name: s.name })} onClick={() => setSkills(skills.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <Select style={{ maxWidth: 260 }} aria-label={t('emp.roles.addSkill')} value="" onChange={e => add(e.target.value)}>
            <option value="">{t('emp.roles.addSkill2')}</option>{all.filter(a => !skills.some(s => s.key === a.key)).map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
          </Select>
          <div className="ln-grid ln-g-3" style={{ gap: 12, alignItems: 'end' }}>
            <div className="ln-field"><label className="ln-label" htmlFor="r-bar">{t('emp.roles.barBar', { bar: f.bar })}</label><input id="r-bar" type="range" min="50" max="100" step="5" value={f.bar} onChange={set('bar')} /></div>
            <label className="ln-check"><input type="checkbox" checked={f.published} onChange={set('published')} />{t('emp.roles.publishAsTargetColleges')}</label>
            <label className="ln-check"><input type="checkbox" checked={f.interview_promise} onChange={set('interview_promise')} />{t('emp.roles.promiseInterviewAnyoneAt')}</label>
          </div>
        </section>
      )}
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-row" style={{ gap: 8 }}><button type="submit" className="ln-btn ln-btn-primary" disabled={!skills?.length || !f.title}>{t('emp.roles.saveRole')}</button><button type="button" className="ln-btn" onClick={onDone}>{t('emp.roles.cancel')}</button></div>
    </form>
  );
}

export function RoleList() {
  const { t } = useUiLang();
  const [params, setParams] = useSearchParams();
  const { data } = useCachedGet('/employer/roles');
  const creating = params.get('new') === '1';
  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('emp.roles.roles')}</h1><span className="ln-sub">{t('emp.roles.whatHireBarSet')}</span></div>
        {!creating && <button type="button" className="ln-btn ln-btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={16} aria-hidden="true" />{t('emp.roles.newRole')}</button>}
      </header>
      {creating && <NewRole onDone={() => setParams({})} />}
      {!data ? <LoadingRows /> : data.length === 0 && !creating ? <EmptyState title={t('emp.roles.noRolesYet')} text={t('emp.roles.pasteJobDescriptionCreate')} /> : (
        <div className="ln-tablewrap"><table className="ln-table">
          <thead><tr><th>{t('emp.roles.role')}</th><th>{t('emp.roles.city')}</th><th>{t('emp.roles.bar')}</th><th>{t('emp.roles.skills')}</th><th>{t('emp.roles.inPipeline')}</th><th /></tr></thead>
          <tbody>{data.map(r => (
            <tr key={r.id}><td><Link to={`/employer/roles/${r.id}`} className="ln-link">{r.title}</Link>{r.interview_promise && <span className="ln-tag ln-tag-success" style={{ marginLeft: 6 }}>{t('emp.roles.interviewPromise')}</span>}</td>
              <td className="ln-small">{r.city || t('emp.roles.any')}</td><td>{r.bar}</td><td className="ln-small">{r.skills.map(s => s.name).join(', ')}</td><td>{r.in_pipeline}</td>
              <td><span className={`ln-tag ${r.status === 'open' ? 'ln-tag-info' : 'ln-tag-neutral'}`}>{r.status === 'open' ? (r.published ? t('emp.roles.openPublished') : t('emp.roles.open')) : t('emp.roles.closed')}</span></td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

export function RoleSearch() {
  const { t } = useUiLang();
  const { id } = useParams();
  const { me } = useEmployer();
  const [city, setCity] = useState('');
  const [band, setBand] = useState('');
  const url = `/employer/roles/${id}/candidates?city=${encodeURIComponent(city)}&band=${band}`;
  const { data, error, reload } = useCachedGet(url);
  const [msg, setMsg] = useState('');
  const verified = me?.employer?.kyb_status === 'verified';
  const act = async (ref, kind) => {
    setMsg('');
    try { await api.post(`/employer/roles/${id}/candidates/${ref}/${kind}`, {}); setMsg(kind === 'request' ? 'Request sent. The student decides what to share; you will be notified.' : t('emp.roles.addedToYourWatch')); dropCached(`/employer/roles/${id}`); reload(); } catch (e) { setMsg(errMsg(e)); }
  };
  if (error && !data) return <div className="ln-error">{errMsg(error, t('emp.roles.couldnTLoadCandidates'))}</div>;
  if (!data) return <LoadingRows rows={5} />;
  const { role } = data;
  const near = data.candidates.filter(c => !c.meets_bar && c.points_short <= 20);
  return (
    <>
      <Crumbs items={[{ label: 'Roles', to: '/employer/roles' }, { label: role.title }]} />
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{role.title}</h1>
          <span className="ln-sub">{role.city || t('emp.roles.anyCity')} {' '}{t('emp.roles.barBar2', { bar: role.bar })}{' '} {role.skills.map(s => `${s.name}${s.required ? '' : ' ' + t('emp.roles.optional')}`).join(', ')}</span></div>
      </header>
      {!verified && <div className="ln-note">{t('emp.roles.canWatchCandidatesNow')}</div>}
      {msg && <div className="ln-note" role="status">{msg}</div>}
      <div className="ln-filterbar">
        <label className="ln-selectwrap"><span>{t('emp.roles.city')}</span><Select value={city} onChange={e => setCity(e.target.value)}><option value="">{t('emp.roles.any')}</option>{['Hyderabad', 'Bengaluru', 'Visakhapatnam', 'Vijayawada', 'Remote'].map(c => <option key={c}>{c}</option>)}</Select></label>
        <label className="ln-selectwrap"><span>{t('emp.roles.readiness')}</span><Select value={band} onChange={e => setBand(e.target.value)}><option value="">{t('emp.roles.all')}</option><option value="ready">{t('emp.roles.ready')}</option><option value="nearly">{t('emp.roles.nearlyReady')}</option><option value="building">{t('emp.roles.building')}</option></Select></label>
        <span className="ln-small ln-muted">{t('emp.roles.studentsOpen', { n: data.total })}</span>
      </div>
      <div className="ln-grid" style={{ gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 1fr)', gap: 16 }}>
        <section className="ln-col" style={{ gap: 10, minWidth: 0 }}>
          {data.candidates.length === 0 ? <EmptyState title={t('emp.roles.noCandidatesMatchYet')} text={t('emp.roles.onlyStudentsWhoTurned')} /> : (
            <div className="ln-tablewrap"><table className="ln-table">
              <thead><tr><th>{t('emp.roles.candidate')}</th><th>{t('emp.roles.readiness')}</th><th>{t('emp.roles.verified')}</th><th>{t('emp.roles.stillMissing')}</th><th /></tr></thead>
              <tbody>{data.candidates.map(c => (
                <tr key={c.ref}>
                  <td><b className="in-code">{c.code}</b><span className="ln-xs ln-muted" style={{ display: 'block' }}>{c.college} · {c.city || '—'}</span></td>
                  <td><BandPill band={c.band} score={c.readiness} />{!c.meets_bar && <span className="ln-xs ln-muted" style={{ display: 'block' }}>{t('emp.roles.pointsShortShortBar', { points_short: c.points_short })}</span>}</td>
                  <td className="ln-small">{c.verified.join(', ') || '—'}</td>
                  <td className="ln-small">{c.missing.join(', ') || '—'}</td>
                  <td>{c.stage ? <span className="ln-tag ln-tag-neutral">{c.stage === 'watching' ? t('emp.roles.watching') : c.stage === 'requested' ? t('emp.roles.asked') : t('emp.roles.inPipeline')}</span> : (
                    <div className="ln-row" style={{ gap: 6 }}>
                      <button type="button" className="ln-btn ln-btn-sm" onClick={() => act(c.ref, 'watch')}><Eye size={13} aria-hidden="true" />{t('emp.roles.watch')}</button>
                      <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" disabled={!verified} onClick={() => act(c.ref, 'request')}><Send size={13} aria-hidden="true" />{t('emp.roles.request')}</button>
                    </div>
                  )}{c.stage === 'watching' && <button type="button" className="ln-btn ln-btn-sm ln-btn-primary" style={{ marginLeft: 6 }} disabled={!verified} onClick={() => act(c.ref, 'request')}>{t('emp.roles.request')}</button>}</td>
                </tr>
              ))}</tbody></table></div>
          )}
          <HowCounted>{t('emp.roles.readinessHowMuchRole')}</HowCounted>
        </section>
        <aside className="ln-col" style={{ gap: 12 }}>
          <section className="ln-card" style={{ gap: 8 }}>
            <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('emp.roles.bestCollegesRole')}</h2>
            {data.colleges.length === 0 && <span className="ln-small ln-muted">{t('emp.roles.noneYet')}</span>}
            {data.colleges.map(g => (
              <div key={g.institution_id} className="ln-between ln-small" style={{ gap: 8 }}>
                <span>{g.college}<span className="ln-xs ln-muted"> · {g.city || ''}</span></span>
                {g.too_few ? <span className="sk-toofew-inline">{t('emp.roles.tooFewShow')}</span> : <span>{t('emp.roles.atBarAtBar', { at_bar: g.at_bar, near: g.near })}</span>}
              </div>
            ))}
          </section>
          {near.length > 0 && (
            <section className="ln-card ln-card-warm" style={{ gap: 8 }}>
              <b>{t('emp.roles.nearMisses', { n: near.length })}</b>
              <span className="ln-small">{t('emp.roles.within20PointsBar')}</span>
              <Link to={`/employer/sponsor?role=${role.id}`} className="ln-btn ln-btn-sm ln-btn-primary" style={{ alignSelf: 'flex-start' }}><Handshake size={14} aria-hidden="true" />{t('emp.roles.sponsorCohort')}</Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
