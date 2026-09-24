// src/pages/LearningSession.js
// ─────────────────────────────────────────────────────────────────────────────
// THE LEARNING SESSION — the learner's direct experience of Professor Qubirex.
// RECEIVE (context loaded) → BUILD (instruction cycle) → RETURN (mastery
// confirmed, advance). TEACH decides when a mastery check is due — there is
// no manual "ready" trigger; the learner just keeps talking to Professor
// Qubirex through the same input box.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { MOCK_SESSION_START } from '../utils/mockData';

const APPROACH_NAMES = {
  native_concept: 'Native Concept',
  analogy: 'Analogy',
  worked_example: 'Worked Example',
  decomposition: 'Building Blocks',
  socratic: 'Socratic'
};

export default function LearningSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [nodeLabel, setNodeLabel] = useState('');
  const [clusterLabel, setClusterLabel] = useState('');
  const [approach, setApproach] = useState('native_concept');
  const [loopCount, setLoopCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('instruction'); // instruction | mastery_check | result
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const lang = user?.language || 'telugu';
  const langName = lang === 'hindi' ? 'हिंदी' : 'తెలుగు';
  const sendText = lang === 'hindi' ? 'भेजें' : 'పంపు';

  useEffect(() => { startSession(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startSession = async () => {
    setLoading(true);
    try {
      const res = await api.post('/learner/session/start');
      // dev fallback — an unreachable backend can resolve with a 200 HTML
      // page (SPA host rewrite) instead of erroring, so validate the shape too
      if (!res.data || !res.data.session_id) throw new Error('unexpected response shape');
      setSessionId(res.data.session_id);
      setNodeLabel(res.data.node_label || '');
      setClusterLabel(res.data.cluster_label || '');
      setApproach(res.data.approach || 'native_concept');
      setLoopCount(res.data.loop_count || 0);
      setPhase('instruction');
      setResult(null);

      const history = res.data.history || [];
      if (history.length > 0) {
        setMessages(history.map(m => ({ role: m.role, content: m.content, type: m.message_type })));
      } else if (res.data.message) {
        setMessages([{ role: 'ai', content: res.data.message, type: 'diagnosis' }]);
      }
    } catch (err) {
      // dev fallback — no backend reachable, load a sample conversation instead of a dead end
      setError('');
      const mock = MOCK_SESSION_START;
      setSessionId(mock.session_id);
      setNodeLabel(mock.node_label);
      setClusterLabel(mock.cluster_label);
      setApproach(mock.approach);
      setLoopCount(mock.loop_count);
      setPhase('instruction');
      setResult(null);
      setMessages(mock.history.map(m => ({ role: m.role, content: m.content, type: m.type })));
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'learner', content: userMsg, type: 'response' }]);
    setLoading(true);

    try {
      const res = await api.post('/learner/session/message', { content: userMsg, session_id: sessionId });
      if (!res.data || !res.data.message) throw new Error('unexpected response shape'); // dev fallback — SPA host rewrite can resolve 200 with HTML

      if (res.data.result === 'advance') {
        setMessages(prev => [...prev, { role: 'ai', content: res.data.message, type: 'advance_trigger' }]);
        setResult(res.data);
        setPhase('result');
      } else if (res.data.result === 'loop') {
        setMessages(prev => [...prev, { role: 'ai', content: res.data.message, type: 'loop_trigger' }]);
        setLoopCount(res.data.loop_count);
        setApproach(res.data.next_approach);
        setPhase('instruction');
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: res.data.message, type: res.data.decision === 'CHECK' ? 'mastery_check' : 'instruction' }]);
        if (res.data.approach) setApproach(res.data.approach);
        setPhase(res.data.decision === 'CHECK' ? 'mastery_check' : 'instruction');
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Technical error. Please try again.', type: 'error' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const bubbleBorder = {
    mastery_check: '1px solid #8B6BD1',
    advance_trigger: '1px solid var(--status-success)',
    loop_trigger: '1px solid var(--status-warning)'
  };
  const bubbleText = {
    advance_trigger: 'var(--status-success)',
    loop_trigger: 'var(--status-warning)',
    mastery_check: '#8B6BD1'
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <button style={S.backBtn} onClick={() => navigate('/learn/dashboard')} aria-label="Back to dashboard">←</button>
          <div>
            <div style={S.nodeTitle}>{nodeLabel}</div>
            <div className="small text-faint">{clusterLabel}</div>
          </div>
        </div>
        <div className="row gap-2">
          <span className="badge badge-accent">{APPROACH_NAMES[approach]}</span>
          <span className="badge badge-success">{langName}</span>
          {loopCount > 0 && <span className="badge badge-warning">Loop {loopCount}</span>}
        </div>
      </div>

      {phase === 'mastery_check' && (
        <div style={S.checkBanner}>
          {lang === 'hindi' ? '📝 मास्टरी चेक — अपना उत्तर लिखें' : '📝 మాస్టరీ చెక్ — మీ సమాధానం రాయండి'}
        </div>
      )}

      <div style={S.chatArea}>
        {error && <div className="badge badge-danger" style={{ display: 'block', padding: 'var(--space-3)' }}>{error}</div>}
        {messages.map((msg, i) => (
          <div key={i} className="msg-enter" style={{ display: 'flex', justifyContent: msg.role === 'learner' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: msg.role === 'learner' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'learner' ? 'var(--gradient-accent)' : 'var(--color-surface)',
              color: msg.role === 'learner' ? '#FFF8EE' : (bubbleText[msg.type] || 'var(--color-text)'),
              border: msg.role === 'learner' ? 'none' : (bubbleBorder[msg.type] || '1px solid var(--color-border)'),
              boxShadow: msg.role === 'learner' ? 'var(--shadow-accent-glow)' : 'var(--shadow-sm)'
            }}>
              {msg.role === 'ai' && <div style={S.aiLabel}>PROFESSOR QUBIREX</div>}
              <div style={S.msgText}>{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div className="card" style={{ padding: 'var(--space-4) var(--space-5)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={S.aiLabel}>PROFESSOR QUBIREX</div>
              <div className="typing"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {phase !== 'result' ? (
        <div style={S.inputArea}>
          <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
            <textarea
              className="textarea input"
              style={{ flex: 1 }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={phase === 'mastery_check'
                ? (lang === 'hindi' ? 'अपना उत्तर यहाँ लिखें…' : 'మీ సమాధానం ఇక్కడ రాయండి…')
                : (lang === 'hindi' ? 'अपना प्रश्न या उत्तर लिखें…' : 'మీ ప్రశ్న లేదా సమాధానం రాయండి…')
              }
              rows={3}
              disabled={loading}
            />
            <button className="btn btn-primary" style={{ height: 46 }} onClick={sendMessage} disabled={loading || !input.trim()}>
              {sendText}
            </button>
          </div>
        </div>
      ) : (
        <div style={S.resultArea}>
          {result?.programme_complete ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--status-success)', marginBottom: 'var(--space-3)' }}>
                🎓 {lang === 'hindi' ? 'कार्यक्रम पूरा!' : 'కార్యక్రమం పూర్తయింది!'}
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/learn/dashboard')}>
                {lang === 'hindi' ? 'डैशबोर्ड पर जाएं' : 'డాష్‌బోర్డ్‌కి వెళ్ళండి'}
              </button>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', borderColor: 'var(--status-success)' }}>
              <div style={{ color: 'var(--status-success)', fontSize: 'var(--text-h4)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                ✅ {lang === 'hindi' ? 'आगे बढ़ें' : 'ముందుకు వెళ్ళండి'}
              </div>
              <div className="small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                {lang === 'hindi' ? 'अगला कौशल:' : 'తదుపరి నైపుణ్యం:'} <strong className="accent-text">{result?.next_node?.label}</strong>
              </div>
              <button className="btn btn-primary" onClick={() => { setPhase('instruction'); startSession(); }}>
                {lang === 'hindi' ? 'अगला कौशल शुरू करें →' : 'తదుపరి నైపుణ్యం మొదలుపెట్టండి →'}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .msg-enter { animation: msgIn 280ms ease both; }
        .typing { display: flex; gap: 3px; padding: 4px 0; }
        .typing span { display: inline-block; width: 8px; height: 8px; margin: 0 2px; background: var(--accent-500); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
        .typing span:nth-child(1) { animation-delay: -0.32s; }
        .typing span:nth-child(2) { animation-delay: -0.16s; }
        @media (prefers-reduced-motion: reduce) {
          .msg-enter { animation: none; }
        }
      `}</style>
    </div>
  );
}

const S = {
  page: { height: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' },
  header: { background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'none', border: 'none', color: 'var(--accent-ink)', fontSize: 20, cursor: 'pointer' },
  nodeTitle: { fontWeight: 700, fontSize: 15 },
  checkBanner: { background: 'rgba(139,107,209,0.12)', borderBottom: '1px solid #8B6BD1', padding: '10px 20px', color: '#8B6BD1', fontSize: 14, fontWeight: 600, flexShrink: 0 },
  chatArea: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  aiLabel: { color: 'var(--accent-ink)', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 },
  msgText: { fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  inputArea: { background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '12px 16px', flexShrink: 0 },
  resultArea: { background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '20px 24px', flexShrink: 0 }
};
