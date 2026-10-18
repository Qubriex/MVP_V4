// src/pages/inst/NewCohort.js — /institution/cohorts/new (admin)
// New cohort setup, in the order that avoids building the pathway in the
// wrong language: 1 capability target (paste any format, or reuse one) →
// 2 confirm the extracted targets → 3 pick the teaching language → 4 build
// the pathway in that language → 5 name the cohort and assign professors.
// Students are added afterwards from the cohort's join-code screen.
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import Crumbs from '../../components/inst/Crumbs';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const STEPS = ['inst.newCohort.steps.capabilityTarget', 'inst.newCohort.steps.confirm', 'inst.newCohort.steps.language', 'inst.newCohort.steps.buildPathway', 'inst.newCohort.steps.cohortProfessors'];

export default function NewCohort() {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [targets, setTargets] = useState([]);
  const [mode, setMode] = useState('new');
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState(location.state?.draft || '');
  const [weeks, setWeeks] = useState('');
  const [ct, setCt] = useState(null); // { id, title, extraction?, node_count }
  const [language, setLanguage] = useState('');
  const [buildResult, setBuildResult] = useState(null);
  const [cohortTitle, setCohortTitle] = useState('');
  const [team, setTeam] = useState([]);
  const [profs, setProfs] = useState({}); // id → 'lead' | 'co'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/institution/capability-targets').then(r => setTargets(r.data)).catch(() => {});
    api.get('/institution/team').then(r => setTeam(r.data.filter(m => m.role === 'professor' && m.status !== 'disabled'))).catch(() => {});
  }, []);

  const fail = (e, fallback) => setError(e.response?.data?.detail ? `${errMsg(e, fallback)}: ${e.response.data.detail}` : errMsg(e, fallback));

  const submitTarget = async (e) => {
    e.preventDefault(); setError(''); setBusy('extract');
    try {
      const res = await api.post('/institution/capability-targets', { title, path: 'B', raw_input: raw, time_window_weeks: parseInt(weeks, 10) || null });
      setCt({ id: res.data.id, title: title || res.data.extraction?.title, extraction: res.data.extraction, node_count: 0, confirmed: false });
      setCohortTitle(title);
      setStep(1);
    } catch (err) { fail(err, t('inst.newCohort.extractionFailed')); }
    setBusy('');
  };
  const [uploaded, setUploaded] = useState('');
  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setUploaded(''); setBusy('upload');
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const r = await api.post('/institution/curriculum/upload', form, { timeout: 90000 });
      setRaw(prev => (prev.trim() ? `${prev.trim()}\n\n${r.data.text}` : r.data.text));
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
      setUploaded(`Read “${file.name}”${r.data.truncated ? ' ' + t('inst.newCohort.longFileTheFirst') : ''}. Check the text below, then extract.`);
    } catch (err) { fail(err, t('inst.newCohort.couldnTReadThat')); }
    setBusy('');
  };
  const useExisting = (t) => {
    setCt({ ...t, existing: true });
    setCohortTitle(t.title);
    setStep(t.node_count ? 4 : t.confirmed ? 2 : 1);
  };
  const confirm = async () => {
    setError(''); setBusy('confirm');
    try { await api.post(`/institution/capability-targets/${ct.id}/confirm`); setCt({ ...ct, confirmed: true }); setStep(2); } catch (err) { fail(err, t('inst.newCohort.confirmationFailed')); }
    setBusy('');
  };
  const build = async () => {
    setError(''); setBusy('build');
    try { const res = await api.post(`/institution/capability-targets/${ct.id}/build-pathway`, { language }); setBuildResult(res.data); setStep(4); } catch (err) { fail(err, t('inst.newCohort.pathwayBuildFailed')); }
    setBusy('');
  };
  const create = async () => {
    setError(''); setBusy('create');
    try {
      const res = await api.post('/institution/engagements', {
        capability_target_id: ct.id, title: cohortTitle, language,
        professors: Object.entries(profs).map(([id, cohort_role]) => ({ id, cohort_role }))
      });
      navigate(`/institution/cohorts/${res.data.engagement_id}?created=1`);
    } catch (err) { fail(err, t('inst.newCohort.couldnTCreateThe')); }
    setBusy('');
  };

  const ex = ct?.extraction;
  return (
    <>
      <Crumbs items={[{ label: 'Cohorts', to: '/institution/cohorts' }, { label: 'New cohort' }]} />
      <header className="ln-col" style={{ gap: 12 }}>
        <h1 className="ln-title">{t('inst.newCohort.newCohort')}</h1>
        <ol className="in-steps" aria-label={t('inst.newCohort.setupSteps')}>
          {STEPS.map((label, i) => <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}><span className="in-dot">{i < step ? '✓' : i + 1}</span>{t(label)}</li>)}
        </ol>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}

      {step === 0 && (
        <div className="ui-narrow ln-col" style={{ gap: 16 }}>
          <div className="ln-tabs" role="tablist">
            <button type="button" role="tab" className="ln-tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>{t('inst.newCohort.pasteNewBrief')}</button>
            <button type="button" role="tab" className="ln-tab" aria-selected={mode === 'existing'} onClick={() => setMode('existing')}>{t('inst.newCohort.useExistingTargetLength', { length: targets.length })}</button>
          </div>
          {mode === 'new' ? (
            <form className="ln-card" onSubmit={submitTarget}>
              <div className="ln-field"><label className="ln-label" htmlFor="ct-title">{t('inst.newCohort.programmeTitle')}</label><input id="ct-title" className="ln-input" placeholder={t('inst.newCohort.eGFullStack')} value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div className="ln-field">
                <span className="ln-label">{t('inst.newCohort.uploadCurriculum')}</span>
                <div className="ln-row ln-wrap" style={{ gap: 10 }}>
                  <label className="ln-btn" style={{ cursor: busy === 'upload' ? 'wait' : 'pointer' }}>
                    <Upload size={16} aria-hidden="true" />{busy === 'upload' ? t('inst.newCohort.readingFile') : t('inst.newCohort.chooseFile')}
                    <input type="file" accept=".pdf,.docx,.txt,.md,.csv" className="ln-sr" disabled={busy === 'upload'} onChange={uploadFile} />
                  </label>
                  <span className="ln-xs ln-muted">{t('inst.newCohort.pdfWordDocxText')}</span>
                </div>
                {uploaded && <span className="ln-small" role="status">{uploaded}</span>}
              </div>
              <div className="ln-field"><label className="ln-label" htmlFor="ct-raw">{t('inst.newCohort.curriculumJdSkillsList')}</label>
                <textarea id="ct-raw" className="ln-textarea" rows={12} value={raw} onChange={e => setRaw(e.target.value)} required
                  placeholder={t('inst.newCohort.weNeedOurFinal')} />
                <span className="ln-xs ln-muted">{t('inst.newCohort.professorQubirexExtractsSkill')}</span></div>
              <div className="ln-field" style={{ maxWidth: 200 }}><label className="ln-label" htmlFor="ct-weeks">{t('inst.newCohort.timeWindowWeeksOptional')}</label><input id="ct-weeks" className="ln-input" type="number" min="1" max="104" value={weeks} onChange={e => setWeeks(e.target.value)} /></div>
              <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy === 'extract'}>{busy === 'extract' ? t('inst.newCohort.extracting') : t('inst.newCohort.extractCapabilityTargets')}</button>
            </form>
          ) : (
            <div className="ln-col" style={{ gap: 10 }}>
              {targets.length === 0 && <div className="ln-card ln-muted">{t('inst.newCohort.noCapabilityTargetsYet')}</div>}
              {targets.map(tg => (
                <button key={tg.id} type="button" className="in-choice" onClick={() => useExisting(tg)}>
                  <b>{tg.title} <span className="ln-muted" style={{ fontWeight: 400 }}>v{tg.version}</span></b>
                  <span className="ln-small ln-muted">{tg.node_count ? t('inst.newCohort.pathwayBuilt', { groups: tg.cluster_count, lessons: tg.node_count }) : tg.confirmed ? t('inst.newCohort.confirmedNotBuilt') : t('inst.newCohort.notConfirmedYet')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 1 && ct && (
        <section className="ui-narrow ln-card">
          <div className="ln-between ln-wrap"><h2 className="ln-h2">{t('inst.newCohort.checkWhatProfessorQubirex')}</h2>
            {ex?.extraction_confidence != null && <span className="ln-tag ln-tag-lg ln-tag-success">{t('inst.newCohort.confidenceRound', { round: Math.round(ex.extraction_confidence * 100) })}</span>}</div>
          {ex?.confirmation_summary && <p className="ln-tile" style={{ padding: 16, fontSize: 'var(--fs-body)', lineHeight: 1.65 }}>{ex.confirmation_summary}</p>}
          {ex?.ambiguities?.length > 0 && <div className="ln-note" style={{ background: 'var(--status-warning-bg)', color: 'var(--warn)' }}><b>{t('inst.newCohort.needsClarification')}</b><ul style={{ listStyle: 'disc', paddingLeft: 20, marginTop: 6 }}>{ex.ambiguities.map(a => <li key={a}>{a}</li>)}</ul></div>}
          <div className="ln-col" style={{ gap: 8 }}>
            {(ex?.clusters || []).map(c => (
              <div key={c.label} className="ln-tile" style={{ padding: '12px 14px' }}>
                <b style={{ fontSize: 'var(--fs-body)' }}>{c.label}</b>
                <span className="ln-xs ln-muted" style={{ textTransform: 'capitalize' }}>{[c.required_proficiency, c.priority && `${c.priority} priority`].filter(Boolean).join(' · ')}</span>
                {c.description && <span className="ln-small">{c.description}</span>}
              </div>
            ))}
            {!ex && <span className="ln-small ln-muted">{t('inst.newCohort.targetWasSavedEarlier')}</span>}
          </div>
          <div className="ln-row" style={{ gap: 10 }}>
            <button type="button" className="ln-btn" onClick={() => setStep(0)}>{t('inst.newCohort.backEditBrief')}</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={confirm} disabled={busy === 'confirm'}>{t('inst.newCohort.theseTargetsRightConfirm')}</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ui-narrow ln-card">
          <h2 className="ln-h2">{t('inst.newCohort.whichLanguageWillCohort')}</h2>
          <span className="ln-small ln-muted">{t('inst.newCohort.skillNodesProfessorQubirex')}</span>
          <div className="ln-grid ln-g-2 ln-indic" style={{ gap: 10 }}>
            {[['telugu', 'తెలుగు', t('inst.newCohort.telugu')], ['hindi', 'हिंदी', t('inst.newCohort.hindi')]].map(([id, native, en]) => (
              <button key={id} type="button" className="in-choice" aria-pressed={language === id} onClick={() => setLanguage(id)}><b style={{ fontSize: 'var(--fs-h2)' }}>{native}</b><span className="ln-small ln-muted">{en}</span></button>
            ))}
          </div>
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!language} onClick={() => setStep(3)}>{t('inst.newCohort.continue')}</button>
        </section>
      )}

      {step === 3 && (
        <section className="ui-narrow ln-card">
          <h2 className="ln-h2">{t('inst.newCohort.buildPathway')}{' '} {language === 'hindi' ? t('inst.newCohort.hindi') : t('inst.newCohort.telugu')}</h2>
          <span className="ln-small ln-muted">{t('inst.newCohort.eachClusterBrokenInto')}</span>
          <div className="ln-row" style={{ gap: 10 }}>
            <button type="button" className="ln-btn" onClick={() => setStep(2)} disabled={busy === 'build'}>{t('inst.newCohort.back')}</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={build} disabled={busy === 'build'}>{busy === 'build' ? t('inst.newCohort.buildingPathway') : t('inst.newCohort.buildPathway2')}</button>
          </div>
        </section>
      )}

      {step === 4 && ct && (
        <section className="ui-narrow ln-card">
          <h2 className="ln-h2">{t('inst.newCohort.nameCohortAssignProfessors')}</h2>
          {buildResult && <div className="ln-note">{t('inst.newCohort.pathwayBuilt')}{' '} {buildResult.results.map(r => (r.error ? `${r.cluster} — failed (${r.error})` : `${r.cluster} (${r.nodes_created} nodes)`)).join(' · ')}</div>}
          {ct.existing && ct.node_count > 0 && !language && (
            <div className="ln-field"><span className="ln-label">{t('inst.newCohort.teachingLanguage')}</span>
              <div className="ln-seg ln-indic">{[['telugu', 'తెలుగు'], ['hindi', 'हिंदी']].map(([id, l]) => <button key={id} type="button" aria-pressed={language === id} onClick={() => setLanguage(id)}>{l}</button>)}</div>
              <span className="ln-xs ln-muted">{t('inst.newCohort.targetSPathwayAlready')}</span></div>
          )}
          {ct.existing && ct.node_count > 0 && language && <span className="ln-small">{t('inst.newCohort.language')}{' '} <b>{language === 'hindi' ? t('inst.newCohort.hindi') : t('inst.newCohort.telugu')}</b> · <button type="button" className="ln-link" style={{ fontSize: 'var(--fs-small)' }} onClick={() => setLanguage('')}>{t('inst.newCohort.change')}</button></span>}
          <div className="ln-field"><label className="ln-label" htmlFor="co-title">{t('inst.newCohort.cohortName')}</label><input id="co-title" className="ln-input" placeholder={t('inst.newCohort.eGFullStack')} value={cohortTitle} onChange={e => setCohortTitle(e.target.value)} /></div>
          <div className="ln-col" style={{ gap: 8 }}>
            <span className="ln-label">{t('inst.newCohort.professors')}</span>
            {team.length === 0 && <span className="ln-small ln-muted">{t('inst.newCohort.noProfessorsYet')}{' '} <Link to="/institution/team" className="ln-link" style={{ fontSize: 'var(--fs-small)' }}>{t('inst.newCohort.inviteOneFromTeam')}</Link> {' '}{t('inst.newCohort.canAssignThemLater')}</span>}
            {team.map(m => (
              <div key={m.id} className="ln-row ln-wrap" style={{ gap: 12 }}>
                <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={!!profs[m.id]} onChange={e => setProfs(p => { const n = { ...p }; if (e.target.checked) n[m.id] = Object.values(p).includes('lead') ? 'co' : 'lead'; else delete n[m.id]; return n; })} />{[m.title, m.name].filter(Boolean).join(' ') || m.email}{m.status !== 'active' && <span className="ln-tag ln-tag-info">{m.status}</span>}</label>
                {profs[m.id] && (
                  <Select style={{ width: 170, minHeight: 36 }} aria-label={t('inst.newCohort.roleOf', { name: m.name || m.email })} value={profs[m.id]} onChange={e => setProfs(p => ({ ...p, [m.id]: e.target.value }))}>
                    <option value="lead">{t('inst.newCohort.leadProfessor')}</option><option value="co">{t('inst.newCohort.coProfessor')}</option>
                  </Select>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={create} disabled={busy === 'create' || !language || !cohortTitle.trim()}>{busy === 'create' ? t('inst.newCohort.creating') : t('inst.newCohort.createCohort')}</button>
        </section>
      )}
    </>
  );
}
