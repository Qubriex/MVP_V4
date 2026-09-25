// src/pages/inst/NewCohort.js — /institution/cohorts/new (admin)
// New cohort setup, in the order that avoids building the pathway in the
// wrong language: 1 capability target (paste any format, or reuse one) →
// 2 confirm the extracted targets → 3 pick the teaching language → 4 build
// the pathway in that language → 5 name the cohort and assign professors.
// Students are added afterwards from the cohort's join-code screen.
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const STEPS = ['Capability target', 'Confirm', 'Language', 'Build pathway', 'Cohort & professors'];

export default function NewCohort() {
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

  const fail = (e, fallback) => setError(e.response?.data?.detail ? `${e.response.data.error}: ${e.response.data.detail}` : e.response?.data?.error || fallback);

  const submitTarget = async (e) => {
    e.preventDefault(); setError(''); setBusy('extract');
    try {
      const res = await api.post('/institution/capability-targets', { title, path: 'B', raw_input: raw, time_window_weeks: parseInt(weeks, 10) || null });
      setCt({ id: res.data.id, title: title || res.data.extraction?.title, extraction: res.data.extraction, node_count: 0, confirmed: false });
      setCohortTitle(title);
      setStep(1);
    } catch (err) { fail(err, 'Extraction failed.'); }
    setBusy('');
  };
  const useExisting = (t) => {
    setCt({ ...t, existing: true });
    setCohortTitle(t.title);
    setStep(t.node_count ? 4 : t.confirmed ? 2 : 1);
  };
  const confirm = async () => {
    setError(''); setBusy('confirm');
    try { await api.post(`/institution/capability-targets/${ct.id}/confirm`); setCt({ ...ct, confirmed: true }); setStep(2); } catch (err) { fail(err, 'Confirmation failed.'); }
    setBusy('');
  };
  const build = async () => {
    setError(''); setBusy('build');
    try { const res = await api.post(`/institution/capability-targets/${ct.id}/build-pathway`, { language }); setBuildResult(res.data); setStep(4); } catch (err) { fail(err, 'Pathway build failed.'); }
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
    } catch (err) { fail(err, 'Couldn’t create the cohort.'); }
    setBusy('');
  };

  const ex = ct?.extraction;
  return (
    <>
      <Link to="/institution/cohorts" className="ln-link" style={{ alignSelf: 'flex-start' }}>← Cohorts</Link>
      <header className="ln-col" style={{ gap: 12 }}>
        <h1 className="ln-title">New cohort</h1>
        <ol className="in-steps" aria-label="Setup steps">
          {STEPS.map((label, i) => <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}><span className="in-dot">{i < step ? '✓' : i + 1}</span>{label}</li>)}
        </ol>
      </header>
      {error && <div className="ln-error" role="alert">{error}</div>}

      {step === 0 && (
        <div className="ln-col" style={{ gap: 16, maxWidth: 860 }}>
          <div className="ln-tabs" role="tablist">
            <button type="button" role="tab" className="ln-tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>Paste a new brief</button>
            <button type="button" role="tab" className="ln-tab" aria-selected={mode === 'existing'} onClick={() => setMode('existing')}>Use an existing target · {targets.length}</button>
          </div>
          {mode === 'new' ? (
            <form className="ln-card" onSubmit={submitTarget}>
              <div className="ln-field"><label className="ln-label" htmlFor="ct-title">Programme title</label><input id="ct-title" className="ln-input" placeholder="e.g. Full-Stack Developer · CSE 2027 · Section A" value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div className="ln-field"><label className="ln-label" htmlFor="ct-raw">Curriculum, JD, skills list or plain description — any format</label>
                <textarea id="ct-raw" className="ln-textarea" rows={12} value={raw} onChange={e => setRaw(e.target.value)} required
                  placeholder={'We need our final-year students to build responsive web apps: HTML/CSS, JavaScript, React, REST APIs with Node.js and SQL. 16 weeks, 64 students.'} />
                <span className="ln-xs ln-muted">Professor Qubirex extracts skill clusters and shows them to you to confirm before anything is built. The teaching language is chosen next.</span></div>
              <div className="ln-field" style={{ maxWidth: 200 }}><label className="ln-label" htmlFor="ct-weeks">Time window (weeks) · optional</label><input id="ct-weeks" className="ln-input" type="number" min="1" max="104" value={weeks} onChange={e => setWeeks(e.target.value)} /></div>
              <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy === 'extract'}>{busy === 'extract' ? 'Extracting…' : 'Extract capability targets →'}</button>
            </form>
          ) : (
            <div className="ln-col" style={{ gap: 10 }}>
              {targets.length === 0 && <div className="ln-card ln-muted">No capability targets yet.</div>}
              {targets.map(t => (
                <button key={t.id} type="button" className="in-choice" onClick={() => useExisting(t)}>
                  <b>{t.title} <span className="ln-muted" style={{ fontWeight: 400 }}>v{t.version}</span></b>
                  <span className="ln-small ln-muted">{t.node_count ? `Pathway built · ${t.cluster_count} clusters · ${t.node_count} skill nodes` : t.confirmed ? 'Confirmed · pathway not built yet' : 'Not confirmed yet'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 1 && ct && (
        <section className="ln-card" style={{ maxWidth: 860 }}>
          <div className="ln-between ln-wrap"><h2 className="ln-h2">Check what Professor Qubirex understood</h2>
            {ex?.extraction_confidence != null && <span className="ln-tag ln-tag-lg ln-tag-success">Confidence {Math.round(ex.extraction_confidence * 100)}%</span>}</div>
          {ex?.confirmation_summary && <p className="ln-tile" style={{ padding: 16, fontSize: 14, lineHeight: 1.65 }}>{ex.confirmation_summary}</p>}
          {ex?.ambiguities?.length > 0 && <div className="ln-note" style={{ background: 'var(--status-warning-bg)', color: '#7A5418' }}><b>Needs clarification:</b><ul style={{ listStyle: 'disc', paddingLeft: 20, marginTop: 6 }}>{ex.ambiguities.map(a => <li key={a}>{a}</li>)}</ul></div>}
          <div className="ln-col" style={{ gap: 8 }}>
            {(ex?.clusters || []).map(c => (
              <div key={c.label} className="ln-tile" style={{ padding: '12px 14px' }}>
                <b style={{ fontSize: 14 }}>{c.label}</b>
                <span className="ln-xs ln-muted" style={{ textTransform: 'capitalize' }}>{[c.required_proficiency, c.priority && `${c.priority} priority`].filter(Boolean).join(' · ')}</span>
                {c.description && <span className="ln-small">{c.description}</span>}
              </div>
            ))}
            {!ex && <span className="ln-small ln-muted">This target was saved earlier. Confirm it to continue.</span>}
          </div>
          <div className="ln-row" style={{ gap: 10 }}>
            <button type="button" className="ln-btn" onClick={() => setStep(0)}>Back — edit the brief</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={confirm} disabled={busy === 'confirm'}>These targets are right — confirm</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ln-card" style={{ maxWidth: 860 }}>
          <h2 className="ln-h2">Which language will this cohort learn in?</h2>
          <span className="ln-small ln-muted">Skill nodes and Professor Qubirex’s explanations are built natively in this language. It can’t be changed once the pathway is built.</span>
          <div className="ln-grid ln-g-2 ln-indic" style={{ gap: 10 }}>
            {[['telugu', 'తెలుగు', 'Telugu'], ['hindi', 'हिंदी', 'Hindi']].map(([id, native, en]) => (
              <button key={id} type="button" className="in-choice" aria-pressed={language === id} onClick={() => setLanguage(id)}><b style={{ fontSize: 20 }}>{native}</b><span className="ln-small ln-muted">{en}</span></button>
            ))}
          </div>
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!language} onClick={() => setStep(3)}>Continue →</button>
        </section>
      )}

      {step === 3 && (
        <section className="ln-card" style={{ maxWidth: 860 }}>
          <h2 className="ln-h2">Build the pathway in {language === 'hindi' ? 'Hindi' : 'Telugu'}</h2>
          <span className="ln-small ln-muted">Each cluster is broken into short skill nodes, easiest first, with prerequisites respected. This takes a minute or two.</span>
          <div className="ln-row" style={{ gap: 10 }}>
            <button type="button" className="ln-btn" onClick={() => setStep(2)} disabled={busy === 'build'}>Back</button>
            <button type="button" className="ln-btn ln-btn-primary" onClick={build} disabled={busy === 'build'}>{busy === 'build' ? 'Building the pathway…' : 'Build pathway'}</button>
          </div>
        </section>
      )}

      {step === 4 && ct && (
        <section className="ln-card" style={{ maxWidth: 860 }}>
          <h2 className="ln-h2">Name the cohort and assign professors</h2>
          {buildResult && <div className="ln-note">Pathway built: {buildResult.results.map(r => (r.error ? `${r.cluster} — failed (${r.error})` : `${r.cluster} (${r.nodes_created} nodes)`)).join(' · ')}</div>}
          {ct.existing && ct.node_count > 0 && !language && (
            <div className="ln-field"><span className="ln-label">Teaching language</span>
              <div className="ln-seg ln-indic">{[['telugu', 'తెలుగు'], ['hindi', 'हिंदी']].map(([id, l]) => <button key={id} type="button" aria-pressed={language === id} onClick={() => setLanguage(id)}>{l}</button>)}</div>
              <span className="ln-xs ln-muted">This target’s pathway is already built; pick the language it was built for.</span></div>
          )}
          {ct.existing && ct.node_count > 0 && language && <span className="ln-small">Language: <b>{language === 'hindi' ? 'Hindi' : 'Telugu'}</b> · <button type="button" className="ln-link" style={{ fontSize: 13 }} onClick={() => setLanguage('')}>change</button></span>}
          <div className="ln-field"><label className="ln-label" htmlFor="co-title">Cohort name</label><input id="co-title" className="ln-input" placeholder="e.g. Full-Stack Developer · CSE 2027 · Section A" value={cohortTitle} onChange={e => setCohortTitle(e.target.value)} /></div>
          <div className="ln-col" style={{ gap: 8 }}>
            <span className="ln-label">Professors</span>
            {team.length === 0 && <span className="ln-small ln-muted">No professors yet. <Link to="/institution/team" className="ln-link" style={{ fontSize: 13 }}>Invite one from Team &amp; roles</Link> — you can assign them later.</span>}
            {team.map(m => (
              <div key={m.id} className="ln-row ln-wrap" style={{ gap: 12 }}>
                <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={!!profs[m.id]} onChange={e => setProfs(p => { const n = { ...p }; if (e.target.checked) n[m.id] = Object.values(p).includes('lead') ? 'co' : 'lead'; else delete n[m.id]; return n; })} />{[m.title, m.name].filter(Boolean).join(' ') || m.email}{m.status !== 'active' && <span className="ln-tag ln-tag-info">{m.status}</span>}</label>
                {profs[m.id] && (
                  <select className="ln-select" style={{ width: 170, minHeight: 36 }} aria-label={`Role of ${m.name || m.email} in this cohort`} value={profs[m.id]} onChange={e => setProfs(p => ({ ...p, [m.id]: e.target.value }))}>
                    <option value="lead">Lead professor</option><option value="co">Co-professor</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={create} disabled={busy === 'create' || !language || !cohortTitle.trim()}>{busy === 'create' ? 'Creating…' : 'Create cohort'}</button>
        </section>
      )}
    </>
  );
}
