// src/pages/learn/JobDetail.js — /learn/market/:jobId
// The full JD next to the learner's match: skills they have (with where the
// evidence comes from), skills to learn with hours, and actions — tailor the
// resume, practise an interview by voice, hear the JD in their language.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, FileText, Mic, Volume2, Square, Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { speechTag } from '../../context/UiLangContext';
import VoiceStatus from '../../components/learn/VoiceStatus';
import { errMsg } from '../../utils/errors';
import api, { getOr } from '../../utils/api';
import { useSpeechOutput } from '../../utils/voice';
import { MOCK_JOB_DETAIL } from '../../utils/learnerMockData';
import { MatchRing, SampleBadge, RequestButton, useSkillRequests, salary, posted } from '../../components/learn/ui';

import { useUiLang } from '../../context/UiLangContext';
import { LoadingRows } from '../../components/shared/EmptyState';
const LANG_LABEL = { telugu: 'తెలుగు', hindi: 'हिंदी' };

export default function JobDetail() {
  const { t } = useUiLang();
  const { jobId } = useParams();
  const { user } = useAuth();
  const language = user?.language || 'telugu';
  const [data, setData] = useState(null);
  const [savedStatus, setSavedStatus] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [readText, setReadText] = useState('');
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
      setReadText(res.data.text);
      speech.speak(res.data.text, 'jd');
    } catch (e) {
      setReadError(errMsg(e, t('learn.jobDetail.couldnTPrepareReading')));
    }
    setReading(false);
  };

  if (!data) return <LoadingRows rows={5} />;
  const { job, gap } = data;
  const have = gap.skills.filter(s => s.status !== 'not_in_path' && s.status !== 'requested');
  const toLearn = gap.skills.filter(s => s.status === 'not_in_path' || s.status === 'requested');

  return (
    <>
      <Link to="/learn/market" className="ln-link" style={{ alignSelf: 'flex-start' }}>{t('learn.jobDetail.backJobMarket')}</Link>

      <div className="ln-grid ln-g-detail">
        <article className="ln-card" style={{ gap: 22, padding: 32 }}>
          <div className="ln-col" style={{ gap: 10 }}>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>{data.sample && <SampleBadge />}<span className="ln-small ln-muted">{t('learn.jobDetail.postedVia', { posted: posted(job.posted_days_ago, t) })}{' '} {data.source || t('learn.jobDetail.jobFeed')}</span></div>
            <h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{job.title}</h1>
            <span style={{ fontSize: 'var(--fs-h3)' }}>{job.company || t('learn.jobDetail.companyName')} · {job.company_type}</span>
          </div>
          <div className="ln-grid ln-g-4" style={{ gap: 12 }}>
            {[[t('learn.jobDetail.location'), job.city], [t('learn.jobDetail.workMode'), job.mode], [t('learn.jobDetail.salary'), salary(job.salary_min, job.salary_max)], [t('learn.jobDetail.experience'), job.experience]].map(([k, v]) => (
              <div key={k} className="ln-tile"><span className="ln-xs ln-muted">{k}</span><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
          <section className="ln-col" style={{ gap: 10 }}><h2 className="ln-h2">{t('learn.jobDetail.aboutRole')}</h2><p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.7 }}>{job.about}</p></section>
          <section className="ln-col" style={{ gap: 10 }}>
            <h2 className="ln-h2">{t('learn.jobDetail.whatLlDo')}</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-body)' }}>{job.responsibilities.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          <section className="ln-col" style={{ gap: 10 }}>
            <h2 className="ln-h2">{t('learn.jobDetail.requirements')}</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-body)' }}>{job.requirements.map(r => <li key={r}>{r}</li>)}</ul>
          </section>
          <div className="ln-row ln-wrap" style={{ gap: 10, paddingTop: 4 }}>
            {savedStatus === 'applied'
              ? <button type="button" className="ln-btn ln-btn-primary" onClick={() => setStatus('saved')}><Check size={18} aria-hidden="true" />{t('learn.jobDetail.applied')}</button>
              : <button type="button" className="ln-btn ln-btn-primary" onClick={() => setStatus('applied')} title={t('learn.jobDetail.sampleListingMarkAs')}>{t('learn.jobDetail.markAsApplied')}</button>}
            <button type="button" className="ln-btn" aria-pressed={!!savedStatus} onClick={() => setStatus(savedStatus ? null : 'saved')}>
              {savedStatus ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}{savedStatus ? t('learn.jobDetail.saved2') : t('learn.jobDetail.saveJob')}
            </button>
            <button type="button" className="ln-btn ln-indic" onClick={readAloud} disabled={reading || !speech.supported}>
              {speech.speakingId ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
              {reading ? t('learn.jobDetail.preparing') : speech.speakingId ? t('learn.jobDetail.stopReading') : t('learn.jobDetail.readAloudIn', { lang: LANG_LABEL[language] || language })}
            </button>
          </div>
          {readError && <div className="ln-error">{readError}</div>}
          <VoiceStatus speech={speech} text={readText} lang={speechTag(language)} />
        </article>

        <aside className="ln-col" style={{ gap: 16 }}>
          <section className="ln-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <MatchRing pct={gap.match} size={132} label={t('learn.jobDetail.skillMatch')} />
            <span style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>
              {t('learn.jobDetail.coverCoveredTotalSkills', { covered: gap.covered, total: gap.total })}
              {gap.gap_hours > 0 ? <> {' '}{t('learn.jobDetail.about')}{' '} <b>{t('learn.jobDetail.gapHoursHours', { gap_hours: gap.gap_hours })}</b> {' '}{t('learn.jobDetail.learningClosesGap')}</> : t('learn.jobDetail.nothingLeftLearnOne')}
            </span>
          </section>

          <section className="ln-card" style={{ gap: 10, padding: 20 }}>
            <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('learn.jobDetail.youHave')}</h2>
            <div className="ln-divided ln-col">
              {have.map(h => (
                <div key={h.name} className="ln-between" style={{ fontSize: 'var(--fs-body)', padding: '8px 0' }}>
                  <span className="ln-row" style={{ gap: 8 }}><Check size={16} strokeWidth={2.4} color="var(--status-success)" aria-hidden="true" />{h.name}</span>
                  <span className="ln-xs ln-muted">{h.evidence}</span>
                </div>
              ))}
              {have.length === 0 && <span className="ln-small ln-muted">{t('learn.jobDetail.noneYetSeeWhat')}</span>}
            </div>
          </section>

          {toLearn.length > 0 && (
            <section className="ln-card ln-card-warm" style={{ gap: 10, padding: 20 }}>
              <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h3)' }}>{t('learn.jobDetail.learnJob')}</h2>
              {toLearn.map(g => (
                <div key={g.name} className="ln-between" style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div className="ln-col"><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{g.name}</span><span className="ln-xs ln-muted">{t('learn.jobDetail.aboutHoursH', { hours: g.hours })}{' '} {g.required ? t('learn.jobDetail.notProgramme') : t('learn.jobDetail.optionalJd')}</span></div>
                  {g.status === 'requested' ? <span className="ln-tag ln-tag-warning">{t('learn.jobDetail.requested')}</span> : <RequestButton name={g.name} source={`job:${job.id}`} requests={requests} />}
                </div>
              ))}
              <span className="ln-xs ln-muted">{t('learn.jobDetail.institutionSetsProgrammeSo')}</span>
              {requests.sent && <div className="ln-note" role="status">{requests.sent}.</div>}
          {requests.error && <div className="ln-error">{requests.error}</div>}
            </section>
          )}

          <div className="ln-col" style={{ gap: 10 }}>
            <Link to={`/learn/resume?job=${job.id}`} className="ln-btn ln-btn-ink" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }}><FileText size={18} aria-hidden="true" />{t('learn.jobDetail.tailorMyResumeJd')}</Link>
            <Link to={`/learn/market/${job.id}/interview`} className="ln-btn" style={{ minHeight: 48, fontSize: 'var(--fs-body)' }}><Mic size={18} aria-hidden="true" />{t('learn.jobDetail.practiseInterviewByVoice')}</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
