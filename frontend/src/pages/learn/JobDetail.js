// src/pages/learn/JobDetail.js — /learn/market/:jobId
// The full JD next to the learner's match: skills they have (with where the
// evidence comes from), skills to learn with hours, and actions — tailor the
// resume, practise an interview by voice, hear the JD in their language.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, FileText, Mic, Volume2, Square, Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechOutput } from '../../utils/voice';
import { MOCK_JOB_DETAIL } from '../../utils/learnerMockData';
import { MatchRing, SampleBadge, RequestButton, useSkillRequests, salary, posted } from '../../components/learn/ui';

const LANG_LABEL = { telugu: 'తెలుగు', hindi: 'हिंदी' };

export default function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const language = user?.language || 'telugu';
  const [data, setData] = useState(null);
  const [savedStatus, setSavedStatus] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const requests = useSkillRequests();
  const speech = useSpeechOutput({ lang: speechTag(language) });

  useEffect(() => {
    getOr(`/market/jobs/${jobId}`, MOCK_JOB_DETAIL, d => d && d.job && d.gap).then(d => { setData(d); setSavedStatus(d.job.saved_status); });
  }, [jobId]);

  const setStatus = async (status) => {
    try {
      if (status) await api.post(`/market/jobs/${jobId}/${status === 'applied' ? 'applied' : 'save'}`);
      else await api.delete(`/market/jobs/${jobId}/save`);
      setSavedStatus(status);
    } catch (e) { /* offline */ }
  };

  const readAloud = async () => {
    if (speech.speakingId) { speech.stop(); return; }
    setReading(true); setReadError('');
    try {
      const res = await api.post(`/market/jobs/${jobId}/read-aloud`);
      if (!res.data?.text) throw new Error('empty');
      speech.speak(res.data.text, 'jd');
    } catch (e) {
      setReadError('Couldn’t prepare the reading right now. Try again in a moment.');
    }
    setReading(false);
  };

  if (!data) return <p className="ln-muted">Loading…</p>;
  const { job, gap } = data;
  const have = gap.skills.filter(s => s.status !== 'not_in_path' && s.status !== 'requested');
  const toLearn = gap.skills.filter(s => s.status === 'not_in_path' || s.status === 'requested');

  return (
    <>
      <Link to="/learn/market" className="ln-link" style={{ alignSelf: 'flex-start' }}>← Back to job market</Link>

      <div className="ln-grid ln-g-detail">
        <article className="ln-card" style={{ gap: 22, padding: 32 }}>
          <div className="ln-col" style={{ gap: 10 }}>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>{data.sample && <SampleBadge />}<span className="ln-small ln-muted">{posted(job.posted_days_ago)} · via {data.source || 'job feed'}</span></div>
            <h1 className="ln-title" style={{ fontSize: 36 }}>{job.title}</h1>
            <span style={{ fontSize: 16 }}>{job.company || '[Company name]'} · {job.company_type}</span>
          </div>
          <div className="ln-grid ln-g-4" style={{ gap: 12 }}>
            {[['Location', job.city], ['Work mode', job.mode], ['Salary', salary(job.salary_min, job.salary_max)], ['Experience', job.experience]].map(([k, v]) => (
              <div key={k} className="ln-tile"><span className="ln-xs ln-muted">{k}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
          <section className="ln-col" style={{ gap: 10 }}><h2 className="ln-h2">About the role</h2><p style={{ fontSize: 15, lineHeight: 1.7 }}>{job.about}</p></section>
          <section className="ln-col" style={{ gap: 10 }}>
            <h2 className="ln-h2">What you’ll do</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>{job.responsibilities.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          <section className="ln-col" style={{ gap: 10 }}>
            <h2 className="ln-h2">Requirements</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>{job.requirements.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          <div className="ln-row ln-wrap" style={{ gap: 10, paddingTop: 4 }}>
            {savedStatus === 'applied'
              ? <button type="button" className="ln-btn ln-btn-primary" onClick={() => setStatus('saved')}><Check size={18} aria-hidden="true" />Applied</button>
              : <button type="button" className="ln-btn ln-btn-primary" onClick={() => setStatus('applied')} title="Sample listing — mark it as applied to track it">Mark as applied</button>}
            <button type="button" className="ln-btn" aria-pressed={!!savedStatus} onClick={() => setStatus(savedStatus ? null : 'saved')}>
              {savedStatus ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}{savedStatus ? 'Saved' : 'Save job'}
            </button>
            <button type="button" className="ln-btn ln-indic" onClick={readAloud} disabled={reading || !speech.supported}>
              {speech.speakingId ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
              {reading ? 'Preparing…' : speech.speakingId ? 'Stop reading' : `Read JD aloud in ${LANG_LABEL[language] || language}`}
            </button>
          </div>
          {readError && <div className="ln-error">{readError}</div>}
        </article>

        <aside className="ln-col" style={{ gap: 16 }}>
          <section className="ln-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <MatchRing pct={gap.match} size={132} label="SKILL MATCH" />
            <span style={{ fontSize: 14, lineHeight: 1.55 }}>
              You cover {gap.covered} of {gap.total} skills in this JD.
              {gap.gap_hours > 0 ? <> About <b>{gap.gap_hours} hours</b> of learning closes the gap.</> : ' Nothing left to learn for this one.'}
            </span>
          </section>

          <section className="ln-card" style={{ gap: 10, padding: 20 }}>
            <h2 className="ln-h2" style={{ fontSize: 16 }}>You have</h2>
            <div className="ln-divided ln-col">
              {have.map(h => (
                <div key={h.name} className="ln-between" style={{ fontSize: 14, padding: '8px 0' }}>
                  <span className="ln-row" style={{ gap: 8 }}><Check size={16} strokeWidth={2.4} color="var(--status-success)" aria-hidden="true" />{h.name}</span>
                  <span className="ln-xs ln-muted">{h.evidence}</span>
                </div>
              ))}
              {have.length === 0 && <span className="ln-small ln-muted">None yet — see what to learn below.</span>}
            </div>
          </section>

          {toLearn.length > 0 && (
            <section className="ln-card ln-card-warm" style={{ gap: 10, padding: 20 }}>
              <h2 className="ln-h2" style={{ fontSize: 16 }}>To learn for this job</h2>
              {toLearn.map(g => (
                <div key={g.name} className="ln-between" style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div className="ln-col"><span style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</span><span className="ln-xs ln-muted">About {g.hours} h · {g.required ? 'not in your programme' : 'optional in JD'}</span></div>
                  {g.status === 'requested' ? <span className="ln-tag ln-tag-warning">Requested</span> : <RequestButton name={g.name} source={`job:${job.id}`} requests={requests} />}
                </div>
              ))}
              <span className="ln-xs ln-muted">Your institution sets your programme, so new skills are requested rather than added.</span>
              {requests.error && <div className="ln-error">{requests.error}</div>}
            </section>
          )}

          <div className="ln-col" style={{ gap: 10 }}>
            <Link to={`/learn/resume?job=${job.id}`} className="ln-btn ln-btn-ink" style={{ minHeight: 48, fontSize: 15 }}><FileText size={18} aria-hidden="true" />Tailor my resume to this JD</Link>
            <Link to={`/learn/market/${job.id}/interview`} className="ln-btn" style={{ minHeight: 48, fontSize: 15 }}><Mic size={18} aria-hidden="true" />Practise an interview by voice</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
