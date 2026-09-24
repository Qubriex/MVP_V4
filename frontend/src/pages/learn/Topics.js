// src/pages/learn/Topics.js — /learn/topics
// One featured topic (new roles + what to learn, in order) and a grid of
// topics filtered by sector. Skills outside the programme are requested from
// the institution, never added directly.
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Volume2, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { speechTag } from '../../context/UiLangContext';
import api, { getOr } from '../../utils/api';
import { useSpeechOutput } from '../../utils/voice';
import { MOCK_TOPICS } from '../../utils/learnerMockData';
import { Bar, SampleBadge, useSkillRequests } from '../../components/learn/ui';

export default function Topics() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sector, setSector] = useState('');
  const [data, setData] = useState(null);
  const [featuredId, setFeaturedId] = useState(params.get('topic'));
  const [introBusy, setIntroBusy] = useState(false);
  const [introError, setIntroError] = useState('');
  const speech = useSpeechOutput({ lang: speechTag(user?.language || 'telugu') });
  const requests = useSkillRequests();

  useEffect(() => {
    getOr(`/market/topics${sector ? `?sector=${encodeURIComponent(sector)}` : ''}`, MOCK_TOPICS, d => d && Array.isArray(d.topics)).then(setData);
  }, [sector]);

  const all = data ? [data.featured, ...data.topics].filter(Boolean) : [];
  const featured = all.find(tp => tp.id === featuredId) || data?.featured || null;
  const rest = all.filter(tp => tp !== featured);
  const toRequest = (featured?.steps || []).filter(st => st.status === 'not_in_path' && !requests.requested.has(st.name));

  const feature = (id) => {
    speech.stop();
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
      speech.speak(res.data.text, featured.id);
    } catch (e) {
      setIntroError('Couldn’t prepare the intro right now.');
    }
    setIntroBusy(false);
  };

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Topics creating new jobs</h1>
          <span className="ln-sub">Where new roles are appearing, what they need, and how close you already are.</span>
        </div>
        <SampleBadge />
      </header>

      <div className="ln-pilltabs" role="tablist" aria-label="Sector">
        {['', ...(data?.sectors || MOCK_TOPICS.sectors)].map(s => (
          <button key={s || 'all'} type="button" role="tab" className="ln-pilltab" aria-selected={sector === s} onClick={() => { setSector(s); setFeaturedId(null); }}>{s || 'All'}</button>
        ))}
      </div>

      {featured && (
        <section className="ln-feature" aria-labelledby="featured-topic">
          <div>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>
              <span className="ln-tag ln-tag-lg" style={{ background: '#263329', color: '#7FBE7C' }}>{featured.growth}</span>
              {featured.have_pct >= 20 && <span className="ln-tag ln-tag-lg" style={{ background: 'var(--stage-surface)', color: '#F7CE97' }}>Close to your path</span>}
            </div>
            <h2 id="featured-topic" style={{ fontSize: 34 }}>{featured.name}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--stage-muted)', maxWidth: 520 }}>{featured.desc}</p>
            <div className="ln-col" style={{ gap: 8 }}>
              <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>New roles</span>
              <div className="ln-row ln-wrap" style={{ gap: 8 }}>{featured.roles.map(r => <Link key={r} to={`/learn/market?q=${encodeURIComponent(r.split(' ')[0])}`} className="ln-darkpill">{r}</Link>)}</div>
            </div>
            <div className="ln-row ln-wrap" style={{ gap: 10, paddingTop: 6 }}>
              <button type="button" className="ln-btn ln-btn-amber" disabled={toRequest.length === 0}
                onClick={() => toRequest.forEach(st => requests.request(st.name, `topic:${featured.id}`))}>
                {toRequest.length ? `Request ${toRequest.length} skill${toRequest.length > 1 ? 's' : ''} from your institution` : 'Nothing to request'}
              </button>
              <button type="button" className="ln-btn ln-btn-ghost-dark" onClick={playIntro} disabled={introBusy || !speech.supported}>
                {speech.speakingId ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                {introBusy ? 'Preparing…' : speech.speakingId ? 'Stop' : 'Listen to a 2-min intro'}
              </button>
            </div>
            {(introError || requests.error) && <div className="ln-error">{introError || requests.error}</div>}
          </div>
          <div>
            <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>What to learn, in order</span>
            {featured.steps.map(st => {
              const done = st.status === 'mastered' || st.status === 'declared';
              const note = done ? 'Already mastered'
                : st.status === 'in_path' || st.status === 'in_progress' ? `In your path · about ${st.hours} h`
                : requests.requested.has(st.name) || st.status === 'requested' ? `Requested · about ${st.hours} h`
                : `About ${st.hours} h · not in your programme`;
              return (
                <div key={st.name} className="ln-step">
                  <span className={`ln-stepdot ${done ? 'is-done' : ''}`}>{done ? '✓' : st.n}</span>
                  <div className="ln-col" style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{st.name}</span><span className="ln-xs" style={{ color: 'var(--stage-muted)' }}>{note}</span></div>
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
            <h3 style={{ fontSize: 18 }}>{tp.name}</h3>
            <span style={{ fontSize: 14, lineHeight: 1.55 }}>{tp.desc}</span>
            <span className="ln-small ln-muted"><b style={{ color: 'var(--color-text)' }}>New roles:</b> {tp.roles.join(', ')}</span>
            <div className="ln-col" style={{ gap: 6, paddingTop: 4, marginTop: 'auto' }}>
              <div className="ln-between ln-xs"><span className="ln-muted">You already have</span><b>{tp.have_pct}%</b></div>
              <Bar pct={tp.have_pct} label={`You already have ${tp.have_pct}% of the skills`} />
            </div>
            <button type="button" className="ln-btn" style={{ fontWeight: 600 }} onClick={() => feature(tp.id)}>See roles and skills</button>
          </article>
        ))}
      </div>
    </>
  );
}
