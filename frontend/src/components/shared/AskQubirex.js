// src/components/shared/AskQubirex.js — the command box on every side (v4.3
// canvas, shared kit 1). Type or speak a question in English, Telugu or
// Hindi; the answer comes from your own data only, with links to the page
// that shows more. Suggestions differ per side.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Send, Info } from 'lucide-react';
import api from '../../utils/api';
import { useSpeechInput } from '../../utils/voice';
import { errMsg } from '../../utils/errors';
import Drawer from './Drawer';

import { useUiLang } from '../../context/UiLangContext';
const SUGGEST = {
  learner: {
    en: ['shared.askQubirex.suggest.whatShouldILearn', 'shared.askQubirex.suggest.howReadyAmI', 'shared.askQubirex.suggest.whatDoesA3Mean', 'shared.askQubirex.suggest.whichSkillShouldI'],
    te: ['నేను తర్వాత ఏమి నేర్చుకోవాలి?', 'ఉద్యోగానికి నేను ఎంత సిద్ధంగా ఉన్నాను?', 'నా పాస్‌పోర్ట్‌లో A3 అంటే ఏమిటి?'],
    hi: ['मुझे आगे क्या सीखना चाहिए?', 'नौकरी के लिए मैं कितना तैयार हूँ?', 'मेरे पासपोर्ट पर A3 का मतलब क्या है?']
  },
  staff: {
    en: ['shared.askQubirex.suggest.whoIsNearlyReady', 'shared.askQubirex.suggest.whichSkillHoldsMost', 'shared.askQubirex.suggest.whoHasGoneQuiet', 'shared.askQubirex.suggest.howDoIStart', 'shared.askQubirex.suggest.whatDoesA3Mean2'],
    te: ['ఎవరు దాదాపు సిద్ధంగా ఉన్నారు?', 'ఏ నైపుణ్యం విద్యార్థులను ఎక్కువగా ఆపుతోంది?'],
    hi: ['कौन लगभग तैयार है?', 'कौन-सा कौशल सबसे ज़्यादा छात्रों को रोक रहा है?']
  },
  employer: {
    en: ['shared.askQubirex.suggest.howManyCandidatesAre', 'shared.askQubirex.suggest.whatDoesA3Mean2', 'shared.askQubirex.suggest.whatCanAPassport'],
    te: ['నా నిర్ణయం కోసం ఎంతమంది ఎదురుచూస్తున్నారు?'],
    hi: ['मेरे फ़ैसले का कितने उम्मीदवार इंतज़ार कर रहे हैं?']
  }
};
const LANGS = [['en', 'EN', 'en-IN'], ['te', 'తెలుగు', 'te-IN'], ['hi', 'हिंदी', 'hi-IN']];

export default function AskQubirex({ side = 'learner', onClose, initialLang = 'en', initialQuestion = '' }) {
  const { t } = useUiLang();
  const [lang, setLang] = useState(initialLang);
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bcp47 = LANGS.find(l => l[0] === lang)[2];

  const askIt = async (question) => {
    const text = String(question || '').trim();
    if (!text || busy) return;
    setQ(''); setError(''); setBusy(true);
    setThread(t => [...t, { who: 'you', text }]);
    try {
      const r = await api.post('/assist/ask', { question: text, lang });
      setThread(t => [...t, { who: 'qbx', text: r.data.answer, links: r.data.links || [] }]);
    } catch (e) { setError(errMsg(e, t('shared.askQubirex.askQubirexCouldNot'))); }
    setBusy(false);
  };
  const mic = useSpeechInput({ lang: bcp47, onFinal: (text) => askIt(text) });
  // Opened from a page's command box with a question already typed.
  const asked = React.useRef(false);
  React.useEffect(() => { if (initialQuestion && !asked.current) { asked.current = true; askIt(initialQuestion); } }, []); // eslint-disable-line

  return (
    <Drawer title={t('shared.askQubirex.askQubirex')} onClose={onClose}>
      <div className="ln-seg sk-langs" role="group" aria-label={t('shared.askQubirex.answerLanguage')}>
        {LANGS.map(([id, label]) => <button key={id} type="button" aria-pressed={lang === id} onClick={() => setLang(id)} className="ln-indic">{label}</button>)}
      </div>
      {thread.length === 0 && (
        <div className="ln-col" style={{ gap: 8 }}>
          <span className="ln-kicker">{t('shared.askQubirex.tryAsking')}</span>
          {(SUGGEST[side][lang] || SUGGEST[side].en).map(s => <button key={s} type="button" className="sk-suggest ln-indic" onClick={() => askIt(t(s))}>{t(s)}</button>)}
        </div>
      )}
      <div className="ln-col sk-thread" aria-live="polite">
        {thread.map((m, i) => (
          <div key={i} className={`sk-msg ${m.who === 'you' ? 'is-you' : ''}`}>
            <span className="ln-indic">{m.text}</span>
            {m.links?.length > 0 && <span className="ln-row ln-wrap" style={{ gap: 10 }}>{m.links.map(l => <Link key={l.href} to={l.href} className="ln-link" onClick={onClose}>{l.label}</Link>)}</span>}
          </div>
        ))}
        {busy && <div className="sk-msg"><span className="ln-typing-dots" aria-label={t('shared.askQubirex.thinking')}><span /><span /><span /></span></div>}
        {error && <div className="ln-error" role="alert">{error}</div>}
      </div>
      <form className="sk-askbar" onSubmit={e => { e.preventDefault(); askIt(q); }}>
        <label htmlFor="ask-q" className="ln-sr">{t('shared.askQubirex.yourQuestion')}</label>
        <input id="ask-q" className="ln-input ln-indic" value={mic.listening ? mic.interim : q} onChange={e => setQ(e.target.value)} placeholder={t('shared.askQubirex.typeSpeakQuestion')} disabled={mic.listening} />
        {mic.supported && (
          <button type="button" className={`sk-mic ${mic.listening ? 'is-on' : ''}`} onClick={() => (mic.listening ? mic.stop() : mic.start())} aria-label={mic.listening ? t('shared.askQubirex.stopListening') : t('shared.askQubirex.speakQuestion')} aria-pressed={mic.listening}><Mic size={18} aria-hidden="true" /></button>
        )}
        <button type="submit" className="ln-btn ln-btn-primary ln-btn-sm" disabled={busy || !q.trim()} aria-label={t('shared.askQubirex.ask')}><Send size={15} aria-hidden="true" /></button>
      </form>
      <span className="ln-xs ln-muted ln-row" style={{ gap: 6 }}><Info size={13} aria-hidden="true" />{t('shared.askQubirex.answersComeFromOwn')}</span>
    </Drawer>
  );
}
