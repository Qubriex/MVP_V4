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
import { useAuth } from '../../context/AuthContext';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
const TEMPLATES = [
  { id: 'classic', name: 'Classic', thumb: { borderTop: '6px solid var(--accent-800)' } },
  { id: 'modern', name: 'Modern', thumb: { borderLeft: '16px solid #201F1A' } },
  { id: 'compact', name: 'Compact', thumb: { background: 'repeating-linear-gradient(var(--color-bg-alt) 0 6px, var(--color-border) 6px 8px)' } }
];
const SECTION_NAMES = { summary: 'Summary', skills: 'Skills', projects: 'Projects', education: 'Education', experience: 'Experience', certifications: 'Certifications', capability_record: 'Capability record' };
const ACCENT = { classic: '#C4302A', modern: '#201F1A', compact: '#3B5A75' };

function orderBy(list, order) {
  if (!order) return list;
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export default function Resume() {
  const { t } = useUiLang();
  const { user } = useAuth();
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
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(null); // what was last saved, to know about unsaved changes
  const draftKey = `qbx_resume_draft_${user?.id || user?.learner_ref || 'me'}`;

  const apply = (r, profile) => {
    setTemplate(r.template || 'classic');
    setSections(r.sections);
    setSummary(r.summary ?? profile.about ?? '');
    setSkillOrder(r.skill_order || null);
    setTailoredFor(r.tailored_job_id || null);
    setSaved({ template: r.template || 'classic', sections: r.sections, summary: r.summary ?? profile.about ?? '', skillOrder: r.skill_order || null, tailoredFor: r.tailored_job_id || null });
  };
  const current = { template, sections, summary, skillOrder, tailoredFor };
  const dirty = !!saved && JSON.stringify(current) !== JSON.stringify(saved);

  // Unsaved work is kept on this device as a draft, and leaving the page
  // with unsaved changes asks first.
  useEffect(() => {
    if (!saved) return;
    try { if (dirty) localStorage.setItem(draftKey, JSON.stringify({ ...current, at: Date.now() })); else localStorage.removeItem(draftKey); } catch { /* storage blocked */ }
  }, [template, sections, summary, skillOrder, tailoredFor, saved]); // eslint-disable-line
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (busy !== 'tailor') { setStep(0); return undefined; }
    const t = setInterval(() => setStep(n => Math.min(n + 1, 2)), 2500);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    getOr('/learner/resume', MOCK_RESUME, d => d && d.profile && d.resume).then(d => {
      setData(d);
      apply(d.resume, d.profile);
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
        if (draft) {
          setTemplate(draft.template); setSections(draft.sections); setSummary(draft.summary);
          setSkillOrder(draft.skillOrder); setTailoredFor(draft.tailoredFor);
          setMessage(t('learn.resume.restoredUnsavedChangesFrom'));
        }
      } catch { /* no draft */ }
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
      setMessage(t('learn.resume.tailoredReviewSummaryThen'));
    } catch (e) {
      setMessage(t('learn.resume.couldnTTailorRight'));
    }
    setBusy('');
  };

  const saveVersion = async () => {
    setBusy('save'); setMessage('');
    try {
      const res = await api.post('/learner/resume', { template, sections, summary, skill_order: skillOrder, tailored_job_id: tailoredFor });
      setData(d => ({ ...d, resume: res.data, versions: [{ version: res.data.version, template: res.data.template, tailored_job_id: res.data.tailored_job_id, created_at: res.data.created_at }, ...d.versions] }));
      setSaved({ ...current });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setMessage(t('learn.resume.savedAsVersionVersion', { version: res.data.version }));
    } catch (e) {
      setMessage(t('learn.resume.couldnTSaveCheck'));
    }
    setBusy('');
  };

  const loadVersion = async (v) => {
    setShowVersions(false);
    try { const res = await api.get(`/learner/resume/versions/${v}`); apply(res.data, p); setMessage(t('learn.resume.loadedVersionV', { v })); } catch (e) { setMessage(t('learn.resume.couldnTLoadVersion')); }
  };

  if (!data) return <LoadingRows rows={5} />;
  const accent = ACCENT[template];
  const H = ({ children }) => <span className="ln-a4-h" style={{ color: accent }}>{children}</span>;
  const tailoredJob = jobs.find(j => j.id === tailoredFor);
  const contact = [p.headline?.split('·')[0]?.trim(), p.city, p.email, p.phone, p.link_url].filter(Boolean).join(' · ');
  const record = p.record || {};

  const blocks = {
    summary: summary && (<div className="ln-col" style={{ gap: 5 }}><H>{t('learn.resume.h.summary')}</H><p>{summary}</p></div>),
    skills: (verified.length + declared.length > 0) && (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.skills')}</H>
        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '4px 12px', fontSize: template === 'compact' ? 10.5 : 11.5, lineHeight: 1.5 }}>
          {verified.length > 0 && <><b>{t('learn.resume.verified')}</b><span>{verified.join(', ')}</span></>}
          {(p.learning_skills || []).length > 0 && <><b>{t('learn.resume.learning')}</b><span>{p.learning_skills.join(', ')}</span></>}
          {declared.length > 0 && <><b>{t('learn.resume.also')}</b><span>{declared.join(', ')}</span></>}
        </div>
      </div>),
    projects: (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.projects')}</H>
        {(p.projects || []).length === 0
          ? <div style={{ padding: '10px 12px', border: '1px dashed #D6CDB6', borderRadius: 6, fontSize: 11, color: '#6B6659' }}>{t('learn.resume.addProjectProfileWill')}</div>
          : p.projects.map(pr => <p key={pr.title}><b>{pr.title}</b>{pr.description ? ` — ${pr.description}` : ''}{(pr.tools || []).length ? ` (${pr.tools.join(', ')})` : ''}{pr.link_url ? ` · ${pr.link_url}` : ''}</p>)}
      </div>),
    education: (p.education || []).length > 0 && (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.education')}</H>
        {p.education.map(e => <div key={e.degree} className="ln-between" style={{ fontSize: 11.5 }}><span><b>{e.degree}</b>{e.institution_name ? ` · ${e.institution_name}` : ''}{e.city ? `, ${e.city}` : ''}{e.grade ? ` · ${e.grade}` : ''}</span><span style={{ color: '#6B6659' }}>{[e.start_year, e.end_year].filter(Boolean).join('–')}</span></div>)}
      </div>),
    experience: (p.experience || []).length > 0 && (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.experience')}</H>
        {p.experience.map(x => <p key={`${x.role}${x.org}`}><b>{x.role}</b>{x.org ? `, ${x.org}` : ''}{x.period ? ` · ${x.period}` : ''}{x.notes ? ` — ${x.notes}` : ''}</p>)}
      </div>),
    certifications: ((p.certifications || []).length + (record.clusters_done || []).length > 0) && (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.certifications')}</H>
        {(record.clusters_done || []).map(c => <p key={c}>{t('learn.resume.qubirexClusterCertificateC', { c })}</p>)}
        {(p.certifications || []).map(c => <p key={c.name}>{c.name}{c.issuer ? `, ${c.issuer}` : ''}{c.year ? ` · ${c.year}` : ''}</p>)}
      </div>),
    capability_record: (
      <div className="ln-col" style={{ gap: 6 }}><H>{t('learn.resume.h.capabilityRecord')}</H>
        <p>{p.engagement_title}{p.institution_name ? `, ${p.institution_name}` : ''} {' '}{t('learn.resume.viaQubirex')}{' '} {record.nodes_mastered ?? 0} {' '}{t('learn.resume.of')}{' '} {record.total_nodes ?? 0} {' '}{t('learn.resume.skillNodesMastered')}{(record.clusters_done || []).length ? ` · ${t('learn.resume.groupsComplete', { list: record.clusters_done.join(', ') })}` : ''}.</p>
        <span style={{ fontSize: 10.5, color: '#6B6659' }}>{t('learn.resume.eachVerifiedSkillWas')}</span>
      </div>)
  };

  return (
    <>
      <header className="ln-pagehead" style={{ alignItems: 'center' }}>
        <div className="ln-col" style={{ gap: 4 }}>
          <h1 className="ln-title" style={{ fontSize: 36 }}>{t('learn.resume.resumeBuilder')}</h1>
          <span className="ln-small ln-muted">
            {t('learn.resume.draftedFrom')}{' '} <Link to="/learn/profile" className="ln-link" style={{ fontSize: 14 }}>{t('learn.resume.profile')}</Link>{t('learn.resume.editsHereDonT')}
            {data.resume.version ? ` ${t('learn.resume.savedVersion', { n: data.resume.version })}` : t('learn.resume.notSavedYet')}
          </span>
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 10, position: 'relative' }}>
          <button type="button" className="ln-btn" aria-expanded={showVersions} onClick={() => setShowVersions(v => !v)} disabled={!data.versions.length}><History size={16} aria-hidden="true" />{t('learn.resume.versions')}</button>
          {showVersions && (
            <div className="ln-card" style={{ position: 'absolute', top: 52, left: 0, zIndex: 5, padding: 8, gap: 2, minWidth: 240, boxShadow: 'var(--shadow-lg)' }}>
              {data.versions.map(v => <button key={v.version} type="button" className="ln-navlink" onClick={() => loadVersion(v.version)}>{t('learn.resume.versionVersion', { version: v.version })}{v.tailored_job_id ? t('learn.resume.tailored') : ''}<span className="ln-xs ln-muted" style={{ marginLeft: 'auto' }}>{(v.created_at || '').slice(0, 10)}</span></button>)}
            </div>
          )}
          <button type="button" className="ln-btn" onClick={saveVersion} disabled={busy === 'save'}>{busy === 'save' ? t('learn.resume.saving') : t('learn.resume.saveVersion')}</button>
          <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Download size={16} aria-hidden="true" />{t('learn.resume.downloadPdf')}</button>
        </div>
      </header>
      {message && <div className="ln-note" role="status">{message}</div>}

      <div className="ln-row" style={{ gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <aside className="ln-col" style={{ width: 400, maxWidth: '100%', flexShrink: 0, gap: 16 }}>
          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
            <h2 className="ln-h2" style={{ fontSize: 15 }}>{t('learn.resume.template')}</h2>
            <div className="ln-grid ln-g-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {TEMPLATES.map(tp => (
                <button key={tp.id} type="button" className="ln-tplbtn" aria-pressed={template === tp.id} onClick={() => setTemplate(tp.id)}>
                  <span className="ln-tplthumb" style={tp.thumb} /><span className="ln-xs" style={{ fontWeight: 600 }}>{tp.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ln-card ln-card-warm" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 10 }}>
            <h2 className="ln-h2" style={{ fontSize: 15 }}>{t('learn.resume.tailorJob')}</h2>
            {jobs.length === 0 ? (
              <span className="ln-small">{t('learn.resume.saveJobFrom')}{' '} <Link to="/learn/market" className="ln-link" style={{ fontSize: 13 }}>{t('learn.resume.jobMarket')}</Link> {' '}{t('learn.resume.tailorResume')}</span>
            ) : (
              <>
                <label className="ln-sr" htmlFor="tailor-job">{t('learn.resume.jobTailor')}</label>
                <Select id="tailor-job" value={jobId} onChange={e => setJobId(e.target.value)}>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company_type}</option>)}
                </Select>
                <span className="ln-small" style={{ lineHeight: 1.5 }}>{t('learn.resume.reordersSkillsMatchJd')}</span>
                <button type="button" className="ln-btn ln-btn-ink" onClick={tailor} disabled={busy === 'tailor'}>{busy === 'tailor' ? ['Reading the job description…', 'Matching your skills…', 'Writing your summary…'][step] : t('learn.resume.tailorResume2')}</button>
                {tailoredJob && <span className="ln-xs ln-muted">{t('learn.resume.currentlyTailoredTitle', { title: tailoredJob.title })}</span>}
              </>
            )}
          </section>

          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 4 }}>
            <div className="ln-between" style={{ paddingBottom: 8 }}><h2 className="ln-h2" style={{ fontSize: 15 }}>{t('learn.resume.sections')}</h2><span className="ln-xs ln-muted">{t('learn.resume.useArrowsReorder')}</span></div>
            {sections.map((s, i) => (
              <div key={s.key} className="ln-row" style={{ minHeight: 44, borderTop: '1px solid var(--color-surface-2)', gap: 6 }}>
                <label className="ln-check" style={{ flex: 1 }}><input type="checkbox" checked={s.on} onChange={() => toggle(s.key)} />{SECTION_NAMES[s.key]}</label>
                <button type="button" className="ln-btn ln-btn-sm" style={{ minHeight: 32, padding: '0 6px' }} aria-label={t('learn.resume.moveValueUp', { value: SECTION_NAMES[s.key] })} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={14} aria-hidden="true" /></button>
                <button type="button" className="ln-btn ln-btn-sm" style={{ minHeight: 32, padding: '0 6px' }} aria-label={t('learn.resume.moveValueDown', { value: SECTION_NAMES[s.key] })} disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ChevronDown size={14} aria-hidden="true" /></button>
              </div>
            ))}
          </section>

          <section className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 8 }}>
            <label htmlFor="rsum" className="ln-h2" style={{ fontSize: 15 }}>{t('learn.resume.summaryResume')}</label>
            <textarea id="rsum" className="ln-textarea" rows={5} value={summary} onChange={e => setSummary(e.target.value)} />
            <div className="ln-row ln-wrap" style={{ gap: 10, alignItems: 'center' }}>
              <button type="button" className="ln-btn ln-btn-primary ln-btn-sm" onClick={saveVersion} disabled={busy === 'save' || !dirty}>{busy === 'save' ? t('learn.resume.saving') : dirty ? t('learn.resume.save') : t('learn.resume.savedTick')}</button>
              {dirty && <span className="ln-xs ln-muted">{t('learn.resume.unsavedChangesKeptDevice')}</span>}
              <button type="button" className="ln-link" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setSummary(p.about || '')}>{t('learn.resume.resetAboutFromProfile')}</button>
            </div>
          </section>
        </aside>

        <div className="ln-resume-stage">
          <article aria-label={t('learn.resume.resumePreview')} className={`ln-a4 tpl-${template}`}>
            <div className="ln-col" style={{ gap: 4, paddingBottom: 12, borderBottom: `2px solid ${accent}` }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.name}</span>
              <span style={{ fontSize: 12, color: '#3A3833' }}>{contact || t('learn.resume.addEmailPhoneCity')}</span>
            </div>
            {sections.filter(s => s.on).map(s => blocks[s.key] ? <React.Fragment key={s.key}>{blocks[s.key]}</React.Fragment> : null)}
          </article>
        </div>
      </div>
    </>
  );
}
