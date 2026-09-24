// src/pages/learn/Record.js — /learn/record
// The learner's own view of their mastery record: the programme cluster by
// cluster (mastered / current / upcoming) and the evidence behind each
// mastered node — the same fields the institution sees in the Mastery Log.
// Until now only the institution could see this.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { getOr } from '../../utils/api';
import { MOCK_PATH } from '../../utils/learnerMockData';
import { minutes } from '../../components/learn/ui';

const CLUSTER_TAG = { done: ['Certificate earned', 'ln-tag-success'], now: ['In progress', 'ln-tag-accent'], next: ['Upcoming', 'ln-tag-neutral'] };
const CONFIDENCE = { high: 'High', solid: 'Solid', building: 'Building' };

function NodePill({ n }) {
  if (n.status === 'mastered') return <span className="ln-chip ln-tag-success" style={{ padding: '7px 12px' }}><Check size={13} aria-hidden="true" />{n.label}<span className="ln-sr"> (mastered)</span></span>;
  if (n.status === 'current') return <Link to="/learn/session" className="ln-chip ln-tag-accent" style={{ padding: '7px 12px', fontWeight: 600, border: '1.5px solid var(--accent-800)' }}>● {n.label}<span className="ln-sr"> (current — continue)</span></Link>;
  return <span className="ln-chip" style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-muted)' }}>{n.label}</span>;
}

export default function Record() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getOr('/learner/path', MOCK_PATH, d => d && Array.isArray(d.clusters)).then(setData); }, []);

  const share = async () => {
    const s = data.summary;
    const lines = [
      `${data.engagement_title} — Qubirex capability record`,
      `${s.nodes_mastered} of ${s.total_nodes} skill nodes mastered${s.average_mastery_pct != null ? `, average mastery ${s.average_mastery_pct}%` : ''}.`,
      ...data.clusters.map(c => `${c.label}: ${c.mastered}/${c.total}${c.status === 'done' ? ' (certificate earned)' : ''}`),
      'Each skill was passed in an applied mastery check. The full Mastery Log is held by the institution.'
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch (e) { /* clipboard blocked */ }
  };

  if (!data) return <p className="ln-muted">Loading…</p>;
  const s = data.summary;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">Skill path and record</h1>
          <span className="ln-sub">Your programme, cluster by cluster, and the evidence behind each skill you have mastered.</span>
        </div>
        <button type="button" className="ln-btn" style={{ fontWeight: 600 }} onClick={share}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied as text' : 'Share my capability record'}</button>
      </header>

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Nodes mastered</span><span className="ln-stat">{s.nodes_mastered} / {s.total_nodes}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Average mastery</span><span className="ln-stat">{s.average_mastery_pct != null ? `${s.average_mastery_pct}%` : '—'}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Active learning time</span><span className="ln-stat">{minutes(s.active_minutes)}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">Cluster certificates</span><span className="ln-stat">{s.cluster_certificates}</span></div>
      </div>

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <h2 className="ln-h2" style={{ fontSize: 20 }}>Path</h2>
          <div className="ln-row ln-wrap ln-xs" style={{ gap: 16 }}>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--status-success)' }} />Mastered</span>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--accent-400)', border: '2px solid var(--accent-800)', boxSizing: 'border-box' }} />Current</span>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, border: '1.5px solid var(--color-text-faint)', boxSizing: 'border-box' }} />Upcoming</span>
          </div>
        </div>
        {data.clusters.map(c => (
          <div key={c.id} className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
            <div className="ln-between ln-wrap">
              <div className="ln-row" style={{ gap: 10 }}><span style={{ fontSize: 16, fontWeight: 600 }}>{c.label}</span><span className={`ln-tag ${CLUSTER_TAG[c.status][1]}`}>{CLUSTER_TAG[c.status][0]}</span></div>
              <span className="ln-small ln-muted">{c.mastered} of {c.total}</span>
            </div>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>{c.nodes.map(n => <NodePill key={n.id} n={n} />)}</div>
          </div>
        ))}
      </section>

      <section className="ln-card" style={{ gap: 10 }}>
        <h2 className="ln-h2">Evidence for mastered nodes</h2>
        {data.evidence.length === 0 ? <span className="ln-small ln-muted">Pass your first mastery check and its evidence shows here.</span> : (
          <div className="ln-tablewrap">
            <table className="ln-table">
              <thead><tr><th scope="col">Skill node</th><th scope="col">Cluster</th><th scope="col">Mastery</th><th scope="col">Attempts</th><th scope="col">Time</th><th scope="col">Confidence</th></tr></thead>
              <tbody>
                {data.evidence.map(r => (
                  <tr key={`${r.cluster}-${r.label}`}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td><td>{r.cluster}</td><td>{r.mastery_pct}%</td><td>{r.attempt_count}</td><td>{minutes(r.time_minutes)}</td><td>{CONFIDENCE[r.confidence_label] || r.confidence_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <span className="ln-xs ln-muted">Mastery is the recency-weighted score of your checks; confidence reflects how steady those scores were. Your conversations with Professor Qubirex are private and are not part of this record.</span>
      </section>
    </>
  );
}
