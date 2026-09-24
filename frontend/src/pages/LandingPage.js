// src/pages/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

const LAWS = [
  { label: 'RECEIVE', desc: 'Accept any capability target from any institution' },
  { label: 'BUILD', desc: "Construct capability natively in the learner's language" },
  { label: 'RETURN', desc: 'Produce a clean, structured Mastery Log as evidence' }
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <>
      <NavBar
        right={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Institution Login</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/learner-login')}>Learner Login</button>
          </>
        }
      />

      <main style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="hero-wash" />
        <section className="container" style={{ position: 'relative', zIndex: 1, padding: 'var(--space-32) var(--gutter) var(--space-24)', textAlign: 'center' }}>
          <Reveal>
            <span className="caption accent-text">QUBIREX</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="display" style={{ margin: 'var(--space-4) 0', maxWidth: 820, marginLeft: 'auto', marginRight: 'auto', color: 'var(--accent-ink)' }}>
              Receive. Build. Return.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="body-lg text-muted" style={{ maxWidth: 560, margin: '0 auto var(--space-16)' }}>
              Native-language AI instruction engine. Builds real capability in
              Hindi and Telugu — not translated from English.
            </p>
          </Reveal>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-16)' }}>
            {LAWS.map((law, i) => (
              <Reveal key={law.label} delay={200 + i * 90} className="card card-hover" style={{ textAlign: 'left' }}>
                <div className="h1 accent-text" style={{ fontSize: '1.75rem', marginBottom: 'var(--space-1)' }}>{i + 1}</div>
                <div className="caption" style={{ color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>{law.label}</div>
                <div className="small text-muted">{law.desc}</div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={480} className="row gap-4" style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-10)' }}>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Institution Login</button>
            <button className="btn btn-secondary" onClick={() => navigate('/learner-login')}>Learner Login</button>
          </Reveal>

          <Reveal delay={560} className="row gap-3" style={{ justifyContent: 'center' }}>
            <span className="badge badge-accent">हिंदी</span>
            <span className="badge badge-accent">తెలుగు</span>
            <span className="small text-faint">Phase 1 Languages</span>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
