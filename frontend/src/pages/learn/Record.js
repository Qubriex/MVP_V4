// src/pages/learn/Record.js — /learn/record
// The learner's own view of their mastery record: the programme cluster by
// cluster (mastered / current / upcoming) and the evidence behind each
// mastered node — the same fields the institution sees in the Mastery Log.
// Until now only the institution could see this.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, Lock, Play } from 'lucide-react';
import api, { getOr } from '../../utils/api';
import { MOCK_PATH } from '../../utils/learnerMockData';
import { minutes } from '../../components/learn/ui';
import LearningCurve from '../../components/learn/LearningCurve';

import { useUiLang } from '../../context/UiLangContext';
const CLUSTER_TAG = { done: ['learn.record.clusterTag.certificateEarned', 'ln-tag-success'], now: ['learn.record.clusterTag.inProgress', 'ln-tag-accent'], next: ['learn.record.clusterTag.upcoming', 'ln-tag-neutral'] };
const CONFIDENCE = { high: 'learn.record.confidence.high', solid: 'learn.record.confidence.solid', building: 'learn.record.confidence.building' };

function NodePill({ n }) {
  const { t } = useUiLang();
  if (n.status === 'mastered') return <span className="ln-chip ln-tag-success" style={{ padding: '7px 12px' }}><Check size={13} aria-hidden="true" />{n.label}<span className="ln-sr"> {' '}{t('learn.record.mastered')}</span></span>;
  if (n.status === 'current') return <Link to="/learn/session" className="ln-chip ln-tag-accent" style={{ padding: '7px 12px', fontWeight: 600, border: '1.5px solid var(--accent-800)' }}>● {n.label}<span className="ln-sr"> {' '}{t('learn.record.currentContinue')}</span></Link>;
  return <span className="ln-chip" style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-muted)' }}>{n.label}</span>;
}

export default function Record() {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [switching, setSwitching] = useState('');
  const [switchError, setSwitchError] = useState('');
  // Start another section: its first skill not yet mastered becomes current.
  const startSection = async (c) => {
    setSwitching(c.id); setSwitchError('');
    try { await api.post('/learner/path/start', { cluster_id: c.id }); navigate('/learn/session'); } catch (e) {
      setSwitchError(e.response?.data?.error || t('learn.record.couldnTSwitchSections'));
    }
    setSwitching('');
  };
  const [copied, setCopied] = useState(false);
  const [curve, setCurve] = useState(null);

  useEffect(() => { getOr('/learner/path', MOCK_PATH, d => d && Array.isArray(d.clusters)).then(setData); }, []);
  useEffect(() => { api.get('/learner/learning-curve').then(r => setCurve(r.data)).catch(() => {}); }, []);

  const share = async () => {
    const s = data.summary;
    const lines = [
      `${data.engagement_title} — Qubirex capability record`,
      `${s.nodes_mastered} of ${s.total_nodes} skill nodes mastered${s.average_mastery_pct != null ? `, average mastery ${s.average_mastery_pct}%` : ''}.`,
      ...data.clusters.map(c => `${c.label}: ${c.mastered}/${c.total}${c.status === 'done' ? ' ' + t('learn.record.certificateEarned') : ''}`),
      t('learn.record.eachSkillWasPassed')
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch (e) { /* clipboard blocked */ }
  };

  if (!data) return <p className="ln-muted">{t('learn.record.loading')}</p>;
  const s = data.summary;

  return (
    <>
      <header className="ln-pagehead">
        <div className="ln-col" style={{ gap: 6 }}>
          <h1 className="ln-title">{t('learn.record.skillPathRecord')}</h1>
          <span className="ln-sub">{t('learn.record.programmeClusterByCluster')}</span>
        </div>
        <button type="button" className="ln-btn" style={{ fontWeight: 600 }} onClick={share}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? t('learn.record.copiedAsText') : t('learn.record.shareMyCapabilityRecord')}</button>
      </header>

      <div className="ln-grid ln-g-4" style={{ gap: 16 }}>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.record.nodesMastered')}</span><span className="ln-stat">{s.nodes_mastered} / {s.total_nodes}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.record.averageMastery')}</span><span className="ln-stat">{s.average_mastery_pct != null ? `${s.average_mastery_pct}%` : '—'}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.record.activeLearningTime')}</span><span className="ln-stat">{minutes(s.active_minutes)}</span></div>
        <div className="ln-card ln-card-sm"><span className="ln-small ln-muted">{t('learn.record.clusterCertificates')}</span><span className="ln-stat">{s.cluster_certificates}</span></div>
      </div>

      {curve && curve.points.length > 1 && (
        <section className="ln-card" style={{ gap: 12 }} aria-label={t('learn.record.learningCurve')}>
          <div className="ln-col" style={{ gap: 2 }}><h2 className="ln-h2">{t('learn.record.learningCurve2')}</h2>
            <span className="ln-small ln-muted">{t('learn.record.howMuchPathHave')}</span></div>
          <LearningCurve data={curve} />
        </section>
      )}

      <section className="ln-col" style={{ gap: 14 }}>
        <div className="ln-between ln-wrap">
          <h2 className="ln-h2" style={{ fontSize: 'var(--fs-h2)' }}>{t('learn.record.path')}</h2>
          <div className="ln-row ln-wrap ln-xs" style={{ gap: 16 }}>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--status-success)' }} />{t('learn.record.mastered2')}</span>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--accent-400)', border: '2px solid var(--accent-800)', boxSizing: 'border-box' }} />{t('learn.record.current')}</span>
            <span className="ln-row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 99, border: '1.5px solid var(--color-text-faint)', boxSizing: 'border-box' }} />{t('learn.record.upcoming')}</span>
          </div>
        </div>
        {data.clusters.map(c => (
          <div key={c.id} className="ln-card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', gap: 12 }}>
            <div className="ln-between ln-wrap">
              <div className="ln-row" style={{ gap: 10 }}><span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{c.label}</span><span className={`ln-tag ${CLUSTER_TAG[c.status][1]}`}>{t(CLUSTER_TAG[c.status][0])}</span></div>
              <span className="ln-small ln-muted">{t('learn.record.masteredTotal', { mastered: c.mastered, total: c.total })}</span>
            </div>
            <div className="ln-row ln-wrap" style={{ gap: 8 }}>{c.nodes.map(n => <NodePill key={n.id} n={n} />)}</div>
            {c.status !== 'done' && (
              <div className="ln-row ln-wrap" style={{ gap: 10 }}>
                {c.current ? <Link to="/learn/session" className="ln-btn ln-btn-sm ln-btn-primary"><Play size={14} aria-hidden="true" />{t('learn.record.continueSection')}</Link>
                  : c.can_start ? <button type="button" className="ln-btn ln-btn-sm" disabled={switching === c.id} onClick={() => startSection(c)}><Play size={14} aria-hidden="true" />{switching === c.id ? t('learn.record.switching') : c.mastered ? t('learn.record.continueSection') : t('learn.record.startThisSection')}</button>
                    : c.locked_by?.length ? <span className="ln-small ln-muted ln-row" style={{ gap: 6 }}><Lock size={14} aria-hidden="true" />{t('learn.record.lockedFinishJoinFirst', { join: c.locked_by.map(x => x.label).join(' and ') })}</span> : null}
              </div>
            )}
          </div>
        ))}
        {switchError && <div className="ln-error" role="alert">{switchError}</div>}
      </section>

      <section className="ln-card" style={{ gap: 10 }}>
        <h2 className="ln-h2">{t('learn.record.evidenceMasteredNodes')}</h2>
        {data.evidence.length === 0 ? <span className="ln-small ln-muted">{t('learn.record.passFirstMasteryCheck')}</span> : (
          <div className="ln-tablewrap">
            <table className="ln-table">
              <thead><tr><th scope="col">{t('learn.record.skillNode')}</th><th scope="col">{t('learn.record.cluster')}</th><th scope="col">{t('learn.record.mastery')}</th><th scope="col">{t('learn.record.attempts')}</th><th scope="col">{t('learn.record.time')}</th><th scope="col">{t('learn.record.confidence')}</th></tr></thead>
              <tbody>
                {data.evidence.map(r => (
                  <tr key={`${r.cluster}-${r.label}`}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td><td>{r.cluster}</td><td>{r.mastery_pct}%</td><td>{r.attempt_count}</td><td>{minutes(r.time_minutes)}</td><td>{CONFIDENCE[r.confidence_label] ? t(CONFIDENCE[r.confidence_label]) : r.confidence_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <span className="ln-xs ln-muted">{t('learn.record.masteryRecencyWeightedScore')}</span>
      </section>
    </>
  );
}
