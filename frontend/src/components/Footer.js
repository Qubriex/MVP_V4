// src/components/Footer.js
// Shared footer for content pages (marketing, dashboards, forms). Not
// rendered on the full-screen LearningSession chat, which intentionally
// fills the viewport the way it did before this redesign.
import React from 'react';
import PhoenixMark from './PhoenixMark';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="nav-brand" style={{ marginBottom: 'var(--space-3)' }}>
              <PhoenixMark size={22} />
              QUBIREX
            </div>
            <p className="small text-muted" style={{ maxWidth: 280 }}>
              Native-language AI instruction engine. Builds real capability in
              Hindi and Telugu — never translated from English.
            </p>
          </div>
          <div className="footer-col">
            <h4 className="small">Platform</h4>
            <a href="/login">Institution Login</a>
            <a href="/learner-login">Learner Login</a>
          </div>
          <div className="footer-col">
            <h4 className="small">Languages</h4>
            <span>हिंदी Hindi</span>
            <span>తెలుగు Telugu</span>
          </div>
          <div className="footer-col">
            <h4 className="small">Company</h4>
            <span>Inferexaa Private Limited</span>
            <span>Receive. Build. Return.</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Inferexaa Private Limited</span>
          <span>Qubirex MVP</span>
        </div>
      </div>
    </footer>
  );
}
