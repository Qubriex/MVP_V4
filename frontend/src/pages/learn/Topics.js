// src/pages/learn/Topics.js — /learn/topics
// One featured topic (new roles + what to learn, in order) and a grid of
// topics filtered by sector. Skills outside the programme are requested from
// the institution, never added directly.
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Volume2, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { speechTag } from '../../context/UiLangContext';
import api from '../../utils/api';
import { useCachedGet } from '../../utils/cachedGet';
import { useSpeechOutput } from '../../utils/voice';
import { MOCK_TOPICS } from '../../utils/learnerMockData';
import VoiceStatus from '../../components/learn/VoiceStatus';
import { errMsg } from '../../utils/errors';
import { Bar, SampleBadge, useSkillRequests, REQUEST_STATUS } from '../../components/learn/ui';

import { useUiLang } from '../../context/UiLangContext';
export default function Topics() {
  const { t } = useUiLang();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sector, setSector] = useState('');
  // Cached: returning to Topics or switching back to a sector shows at once.
  const { data: live, error: topicsError } = useCachedGet(`/market/topics${sector ? `?sector=${encodeURIComponent(sector)}` : ''}`);
  const data = live && Array.isArray(live.topics) ? live : topicsError ? MOCK_TOPICS : null;
  const [featuredId, setFeaturedId] = useState(params.get('topic'));
  const [introBusy, setIntroBusy] = useState(false);
  const [introError, setIntroError] = useState('');
  const [introText, setIntroText] = useState('');
  const speech = useSpeechOutput({ lang: speechTag(user?.language || 'telugu') });
  const requests = useSkillRequests();


  const all = data ? [data.featured, ...data.topics].filter(Boolean) : [];
  const featured = all.find(tp => tp.id === featuredId) || data?.featured || null;
  const rest = all.filter(tp => tp !== featured);
  const toRequest = (featured?.steps || []).filter(st => st.status === 'not_in_path' && !requests.requested.has(st.name));

  const feature = (id) => {
    speech.stop();
    setIntroText('');
    setFeaturedId(id);
    setParams({ topic: id }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const playIntro = async () => {
    if (speech.speakingId) { speech.stop(); return; }
    setIntroBusy(true); setIntroError('');
    try {
      const res = await api.post(`/market/topics/${featured.id}/intro`);
      if (!res.data?.text) throw new Error('empty');
      setIntroText(res.data.text);
      speech.speak(res.data.text, featured.id);
    } catch (e) {
      setIntroError(errMsg(e, t('learn.topics.couldnTPrepareIntro')));
    }
    setIntroBusy(false);
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('learn.topics.topicsCreatingNewJobs')}</h1>
          <span className="ln-sub">{t('learn.topics.whereNewRolesAppearing')}</span>
        </div>
        <SampleBadge />
      </header>

      <div className="ln-pilltabs" role="tablist" aria-label={t('learn.topics.sector')}>
        {['', ...(data?.sectors || MOCK_TOPICS.sectors)].map(s => (
          <button key={s || 'all'} type="button" role="tab" className="ln-pilltab" aria-selected={sector === s} onClick={() => { setSector(s); setFeaturedId(null); }}>{s || t('learn.topics.all2')}</button>
        ))}
      </div>

      {featured && (
        <section className="ln-feature" aria-labelledby="featured-topic">
          <div>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <span className="ln-tag ln-tag-lg" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{featured.growth}</span>
              {featured.have_pct >= 20 && <span className="ln-tag ln-tag-lg" style={{ background: 'var(--stage-surface)', color: 'var(--accent-200)' }}>{t('learn.topics.closePath')}</span>}
            </div>
            <h2 id="featured-topic" style={{ fontSize: 'var(--fs-h1)' }}>{featured.name}</h2>
            <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 520 }}>{featured.desc}</p>
            <div className="ln-col" style={{ gap: 8 }}>
              <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>{t('learn.topics.newRoles')}</span>
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>{featured.roles.map(r => <Link key={r} to={`/learn/market?q=${encodeURIComponent(r.split(' ')[0])}`} className="ln-darkpill">{r}</Link>)}</div>
            </div>
            <div className="ln-row ln-wrap" style={{ gap: 10, paddingTop: 6 }}>
              {toRequest.length > 0 ? (
                <button type="button" className="ln-btn ln-btn-primary ln-btn-lg" disabled={requests.busy}
                  onClick={() => requests.requestMany(toRequest.map(st => st.name), `topic:${featured.id}`)}>
                  {requests.busy ? t('learn.topics.sending') : t('learn.topics.requestN', { n: toRequest.length })}
                </button>
              ) : (
                <span className="ln-tag ln-tag-lg" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                  {featured.steps.some(st => st.status === 'not_in_path' || requests.requested.has(st.name)) ? t('learn.topics.requestedFromInstitution') : t('learn.topics.everySkillAlreadyProgramme')}
                </span>
              )}
              <button type="button" className="ln-btn ln-btn-ghost-dark" onClick={playIntro} disabled={introBusy || !speech.supported}>
                {speech.speakingId ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                {introBusy ? t('learn.topics.preparing') : speech.speakingId ? t('learn.topics.stop') : t('learn.topics.listenToA2')}
              </button>
            </div>
            <VoiceStatus speech={speech} text={introText} dark lang={speechTag(user?.language || 'telugu')} />
            {introError && <div className="ln-error">{introError}</div>}
            {requests.sent && <div className="ln-note" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{t('learn.topics.sentLlSeeEach', { sent: requests.sent })}</div>}
            {requests.error && <div className="ln-error">{requests.error}</div>}
          </div>
          <div>
            <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>{t('learn.topics.whatLearnOrder')}</span>
            {featured.steps.map(st => {
              const done = st.status === 'mastered' || st.status === 'declared';
              const note = done ? t('learn.topics.alreadyMastered')
                : st.status === 'in_path' || st.status === 'in_progress' ? `In your path · about ${st.hours} h`
                : requests.requested.has(st.name) ? `${t(REQUEST_STATUS[requests.statusOf(st.name)])} · about ${st.hours} h`
                : st.status === 'requested' ? `${t(REQUEST_STATUS.pending)} · about ${st.hours} h`
                : `About ${st.hours} h · not in your programme`;
              return (
                <div key={st.name} className="ln-step">
                  <span className={`ln-stepdot ${done ? 'is-done' : ''}`}>{done ? '✓' : st.n}</span>
                  <div className="ln-col" style={{ flex: 1 }}><span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{st.name}</span><span className="ln-xs" style={{ color: 'var(--stage-muted)' }}>{note}</span></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="ln-grid ln-g-3" style={{ gap: 16 }}>
        {rest.map(tp => (
          <article key={tp.id} className="ln-card" style={{ gap: 12, padding: 22, borderRadius: 'var(--radius-lg)' }}>
            <div className="ln-between"><span className="ln-xs ln-muted">{tp.sector}</span><span className={`ln-tag ln-tag-lg ${tp.growth === 'Steady' ? 'ln-tag-neutral' : 'ln-tag-success'}`}>{tp.growth}</span></div>
            <h3 style={{ fontSize: 'var(--fs-h3)' }}>{tp.name}</h3>
            <span style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>{tp.desc}</span>
            <span className="ln-small ln-muted"><b style={{ color: 'var(--color-text)' }}>{t('learn.topics.newRoles2')}</b> {tp.roles.join(', ')}</span>
            <div className="ln-col" style={{ gap: 6, paddingTop: 4, marginTop: 'auto' }}>
              <div className="ln-between ln-xs"><span className="ln-muted">{t('learn.topics.alreadyHave')}</span><b>{tp.have_pct}%</b></div>
              <Bar pct={tp.have_pct} label={t('learn.topics.alreadyHaveHavePct', { have_pct: tp.have_pct })} />
            </div>
            <button type="button" className="ln-btn" style={{ fontWeight: 600 }} onClick={() => feature(tp.id)}>{t('learn.topics.seeRolesSkills')}</button>
          </article>
        ))}
      </div>
    </>
  );
}
