// src/pages/learn/Resume.js — /learn/resume
// Drafts a resume from the profile and verified skills: template choice,
// section toggles and order, tailoring to a saved job, a live A4 preview and
// PDF download (the browser's print-to-PDF, with print CSS that keeps only
// the A4 page). Edits here are saved as resume versions and never change the
// profile.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ChevronUp, ChevronDown, History } from 'lucide-react';
import api, { getOr } from '../../utils/api';
import { MOCK_RESUME } from '../../utils/learnerMockData';

const TEMPLATES = [
  { id: 'classic', name: 'Classic', thumb: { borderTop: '6px solid var(--accent-800)' } },
  { id: 'modern', name: 'Modern', thumb: { borderLeft: '16px solid #201F1A' } },
  { id: 'compact', name: 'Compact', thumb: { background: 'repeating-linear-gradient(var(--color-bg-alt) 0 6px, var(--color-border) 6px 8px)' } }
];
const SECTION_NAMES = { summary: 'Summary', skills: 'Skills', projects: 'Projects', education: 'Education', experience: 'Experience', certifications: 'Certifications', capability_record: 'Capability record' };
const ACCENT = { classic: '#9B3A2A', modern: '#201F1A', compact: '#3B5A75' };

function orderBy(list, order) {
  if (!order) return list;
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export default function Resume() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [template, setTemplate] = useState('classic');
  const [sections, setSections] = useState([]);
  const [summary, setSummary] = useState('');
  const [skillOrder, setSkillOrder] = useState(null);
  const [jobId, setJobId] = useState(params.get('job') || '');
  const [tailoredFor, setTailoredFor] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  const apply = (r, profile) => {
    setTemplate(r.template || 'classic');
    setSections(r.sections);
    setSummary(r.summary ?? profile.about ?? '');
    setSkillOrder(r.skill_order || null);
    setTailoredFor(r.tailored_job_id || null);
  };

  useEffect(() => {
    getOr('/learner/resume', MOCK_RESUME, d => d && d.profile && d.resume).then(d => {
      setData(d);
      apply(d.resume, d.profile);
      const list = [...d.saved_jobs];
      const wanted = params.get('job');
      if (wanted && !list.some(j => j.id === wanted)) {
        getOr(`/market/jobs/${wanted}`, null, x => x && x.job).then(x => x && setJobs([{ id: x.job.id, title: x.job.title, company_type: x.job.company_type }, ...list]));
      }
      setJobs(list);
      if (!wanted && list[0]) setJobId(list[0].id);
    });
  }, []);

  const p = data?.profile;
  const on = (key) => sections.find(s => s.key === key)?.on;
  const verified = useMemo(() => orderBy(p?.verified_skills || [], skillOrder), [p, skillOrder]);
  const declared = useMemo(() => orderBy(p?.self_skills || [], skillOrder), [p, skillOrder]);

  const move = (i, d) => setSections(list => { const next = [...list]; const j = i + d; if (j < 0 || j >= next.length) return list; [next[i], next[j]] = [next[j], next[i]]; return next; });
  const toggle = (key) => setSections(list => list.map(s => (s.key === key ? { ...s, on: !s.on } : s)));

  const tailor = async () => {
    if (!jobId) return;
    setBusy('tailor'); setMessage('');
    try {
      const res = await api.post('/learner/resume/tailor', { job_id: jobId });
      setSummary(res.data.summary);
      setSkillOrder(res.data.skill_order);
      setTailoredFor(jobId);
      setMessage('Tailored. Review the summary, then save a version.');
    } catch (e) {
      setMessage('Couldn’t tailor right now. Try again in a moment.');
    }
    setBusy('');
  };

  const saveVersion = async () => {
    setBusy('save'); setMessage('');
    try {
      const res = await api.post('/learner/resume', { template, sections, summary, skill_order: skillOrder, tailored_job_id: tailoredFor });
      setData(d => ({ ...d, resume: res.data, versions: [{ version: res.data.version, template: res.data.template, tailored_job_id: res.data.tailored_job_id, created_at: res.data.created_at }, ...d.versions] }));
      setMessage(`Saved as version ${res.data.version}.`);
    } catch (e) {
      setMessage('Couldn’t save — check your connection.');
    }
    setBusy('');
  };

  const loadVersion = async (v) => {
    setShowVersions(false);
    try { const res = await api.get(`/learner/resume/versions/${v}`); apply(res.data, p); setMessage(`Loaded version ${v}.`); } catch (e) { setMessage('Couldn’t load that version.'); }
  };

  if (!data) return <p className="ln-muted">Loading…</p>;
  const accent = ACCENT[template];
  const H = ({ children }) => <span className="ln-a4-h" style={{ color: accent }}>{children}</span>;
  const tailoredJob = jobs.find(j => j.id === tailoredFor);
  const contact = [p.headline?.split('·')[0]?.trim(), p.city, p.email, p.phone, p.link_url].filter(Boolean).join(' · ');
  const record = p.record || {};

  const blocks = {
    summary: summary && (<div className="ln-col" style={{ gap: 5 }}><H>SUMMARY</H><p>{summary}</p></div>),
    skills: (verified.length + declared.length > 0) && (
      <div className="ln-col" style={{ gap: 6 }}><H>SKILLS</H>
        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '4px 12px', fontSize: template === 'compact' ? 10.5 : 11.5, lineHeight: 1.5 }}>
          {verified.length > 0 && <><b>Verified</b><span>{verified.join(', ')}</span></>}
          {(p.learning_skills || []).length > 0 && <><b>Learning</b><span>{p.learning_skills.join(', ')}</span></>}
          {declared.length > 0 && <><b>Also</b><span>{declared.join(', ')}</span></>}
        </div>
      </div>),
    projects: (
      <div className="ln-col" style={{ gap: 6 }}><H>PROJECTS</H>
        {(p.projects || []).length === 0
          ? <div style={{ padding: '10px 12px', border: '1px dashed #D6CDB6', borderRadius: 6, fontSize: 11, color: '#6B6659' }}>[Add a project in your profile — it will appear here]</div>
          : p.projects.map(pr => <p key={pr.title}><b>{pr.title}</b>{pr.description ? ` — ${pr.description}` : ''}{(pr.tools || []).length ? ` (${pr.tools.join(', ')})` : ''}{pr.link_url ? ` · ${pr.link_url}` : ''}</p>)}
      </div>),
    education: (p.education || []).length > 0 && (
      <div className="ln-col" style={{ gap: 6 }}><H>EDUCATION</H>
        {p.education.map(e => <div key={e.degree} className="ln-between" style={{ fontSize: 11.5 }}><span><b>{e.degree}</b>{e.institution_name ? ` · ${e.institution_name}` : ''}{e.city ? `, ${e.city}` : ''}{e.grade ? ` · ${e.grade}` : ''}</span><span style={{ color: '#6B6659' }}>{[e.start_year, e.end_year].filter(Boolean).join('–')}</span></div>)}
      </div>),
    experience: (p.experience || []).length > 0 && (
      <div className="ln-col" style={{ gap: 6 }}><H>EXPERIENCE</H>
        {p.experience.map(x => <p key={`${x.role}${x.org}`}><b>{x.role}</b>{x.org ? `, ${x.org}` : ''}{x.period ? ` · ${x.period}` : ''}{x.notes ? ` — ${x.notes}` : ''}</p>)}
      </div>),
    certifications: ((p.certifications || []).length + (record.clusters_done || []).length > 0) && (
      <div className="ln-col" style={{ gap: 6 }}><H>CERTIFICATIONS</H>
        {(record.clusters_done || []).map(c => <p key={c}>Qubirex cluster certificate — {c}</p>)}
        {(p.certifications || []).map(c => <p key={c.name}>{c.name}{c.issuer ? `, ${c.issuer}` : ''}{c.year ? ` · ${c.year}` : ''}</p>)}
      </div>),
    capability_record: (
      <div className="ln-col" style={{ gap: 6 }}><H>CAPABILITY RECORD</H>
        <p>{p.engagement_title}{p.institution_name ? `, ${p.institution_name}` : ''} via Qubirex · {record.nodes_mastered ?? 0} of {record.total_nodes ?? 0} skill nodes mastered{(record.clusters_done || []).length ? ` · ${record.clusters_done.join(' and ')} complete` : ''}.</p>
        <span style={{ fontSize: 10.5, color: '#6B6659' }}>Each verified skill was passed in an applied mastery check. Full Mastery Log available from the institution.</span>
      </div>)
  };

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title" style={{ fontSize: 36 }}>Resume builder</h1>
          <span className="ln-small ln-muted">
            Drafted from your <Link to="/learn/profile" className="ln-link" style={{ fontSize: 14 }}>profile</Link>. Edits here don’t change your profile.
            {data.resume.version ? ` Saved as version ${data.resume.version}.` : ' Not saved yet.'}
          </span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10, position: 'relative' }}>
          <button type="button" className="ln-btn" aria-expanded={showVersions} onClick={() => setShowVersions(v => !v)} disabled={!data.versions.length}><History size={16} aria-hidden="true" />Versions</button>
          {showVersions && (
            <div className="ln-card" style={{ position: 'absolute', top: 52, left: 0, zIndex: 5, padding: 8, gap: 2, minWidth: 240, boxShadow: 'var(--shadow-lg)' }}>
              {data.versions.map(v => <button key={v.version} type="button" className="ln-navlink" onClick={() => loadVersion(v.version)}>Version {v.version}{v.tailored_job_id ? ' · tailored' : ''}<span className="ln-xs ln-muted" style={{ marginLeft: 'auto' }}>{(v.created_at || '').slice(0, 10)}</span></button>)}
            </div>
          )}
          <button type="button" className="ln-btn" onClick={saveVersion} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save version'}</button>
          <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Download size={16} aria-hidden="true" />Download PDF</button>
        </div>
      </header>
      {message && <div className="ln-note" role="status">{message}</div>}

      <div className="ln-row" style={{ gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <aside className="ln-col" style={{ width: 400, maxWidth: '100%', flexShrink: 0, gap: 16 }}>
          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
            <h2 className="ln-h2" style={{ fontSize: 15 }}>Template</h2>
            <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {TEMPLATES.map(tp => (
                <button key={tp.id} type="button" className="ln-tplbtn" aria-pressed={template === tp.id} onClick={() => setTemplate(tp.id)}>
                  <span className="ln-tplthumb" style={tp.thumb} /><span className="ln-xs" style={{ fontWeight: 600 }}>{tp.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ln-card ln-card-warm" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 10 }}>
            <h2 className="ln-h2" style={{ fontSize: 15 }}>Tailor to a job</h2>
            {jobs.length === 0 ? (
              <span className="ln-small">Save a job from the <Link to="/learn/market" className="ln-link" style={{ fontSize: 13 }}>job market</Link> to tailor your resume to it.</span>
            ) : (
              <>
                <label className="ln-sr" htmlFor="tailor-job">Job to tailor to</label>
                <select id="tailor-job" className="ln-select" value={jobId} onChange={e => setJobId(e.target.value)}>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company_type}</option>)}
                </select>
                <span className="ln-small" style={{ lineHeight: 1.5 }}>Reorders skills to match the JD and rewrites the summary. Only claims skills you have mastered or declared.</span>
                <button type="button" className="ln-btn ln-btn-ink" onClick={tailor} disabled={busy === 'tailor'}>{busy === 'tailor' ? 'Tailoring…' : 'Tailor resume'}</button>
                {tailoredJob && <span className="ln-xs ln-muted">Currently tailored to: {tailoredJob.title}</span>}
              </>
            )}
          </section>

          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 4 }}>
            <div className="ln-between" style={{ paddingBottom: 8 }}><h2 className="ln-h2" style={{ fontSize: 15 }}>Sections</h2><span className="ln-xs ln-muted">Use the arrows to reorder</span></div>
            {sections.map((s, i) => (
              <div key={s.key} className="ln-row" style={{ minHeight: 44, borderTop: '1px solid var(--color-surface-2)', gap: 6 }}>
                <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={s.on} onChange={() => toggle(s.key)} />{SECTION_NAMES[s.key]}</label>
                <button type="button" className="ln-btn ln-btn-sm" style={{ minHeight: 32, padding: '0 6px' }} aria-label={`Move ${SECTION_NAMES[s.key]} up`} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={14} aria-hidden="true" /></button>
                <button type="button" className="ln-btn ln-btn-sm" style={{ minHeight: 32, padding: '0 6px' }} aria-label={`Move ${SECTION_NAMES[s.key]} down`} disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ChevronDown size={14} aria-hidden="true" /></button>
              </div>
            ))}
          </section>

          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 8 }}>
            <label htmlFor="rsum" className="ln-h2" style={{ fontSize: 15 }}>Summary on this resume</label>
            <textarea id="rsum" className="ln-textarea" rows={5} value={summary} onChange={e => setSummary(e.target.value)} />
            <button type="button" className="ln-link" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setSummary(p.about || '')}>Reset to “About you” from profile</button>
          </section>
        </aside>

        <div className="ln-resume-stage">
          <article aria-label="Resume preview" className={`ln-a4 tpl-${template}`}>
            <div className="ln-col" style={{ gap: 4, paddingBottom: 12, borderBottom: `2px solid ${accent}` }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.name}</span>
              <span style={{ fontSize: 12, color: '#3A3833' }}>{contact || '[Add your email, phone and city in your profile]'}</span>
            </div>
            {sections.filter(s => s.on).map(s => blocks[s.key] ? <React.Fragment key={s.key}>{blocks[s.key]}</React.Fragment> : null)}
          </article>
        </div>
      </div>
    </>
  );
}
