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
import { useLearningLanguage } from '../../utils/learningLanguage';
import { LEARNING_LABEL } from '../learn/LearningLangPicker';

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
// Learners pick the answer language from their learning languages; it starts
// on their current learning language, not on the screen language.
const LEARNER_LANGS = ['telugu', 'hindi', 'english', 'telugu_en', 'hindi_en'];
const SUGGEST_CODE = { telugu: 'te', hindi: 'hi', english: 'en', telugu_en: 'te', hindi_en: 'hi', en: 'en', te: 'te', hi: 'hi' };
const BCP47 = { te: 'te-IN', hi: 'hi-IN', en: 'en-IN' };

export default function AskQubirex({ side = 'learner', onClose, initialLang = 'en', initialQuestion = '' }) {
  const { t } = useUiLang();
  const learner = side === 'learner';
  const [learning] = useLearningLanguage(learner);
  const [lang, setLang] = useState(learner ? null : initialLang);
  const current = lang || learning || 'telugu';
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const code = SUGGEST_CODE[current] || 'en';
  const bcp47 = BCP47[code];

  const askIt = async (question, { as = current, again = false } = {}) => {
    const text = String(question || '').trim();
    if (!text || busy) return;
    setQ(''); setError(''); setBusy(true);
    if (!again) setThread(t => [...t, { who: 'you', text }]);
    try {
      const r = await api.post('/assist/ask', { question: text, lang: as });
      setThread(t => [...t, { who: 'qbx', text: r.data.answer, links: r.data.links || [] }]);
    } catch (e) { setError(errMsg(e, t('shared.askQubirex.askQubirexCouldNot'))); }
    setBusy(false);
  };
  const mic = useSpeechInput({ lang: bcp47, onFinal: (text) => askIt(text) });
  // Opened from a page's command box with a question already typed (learners:
  // once their learning language is known, so the answer comes in it).
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (initialQuestion && !asked.current && (!learner || learning)) { asked.current = true; askIt(initialQuestion); }
  }, [learning]); // eslint-disable-line
  // Changing the language answers the last question again in the new one.
  const changeLang = (v) => {
    setLang(v);
    const last = [...thread].reverse().find(m => m.who === 'you');
    if (last) askIt(last.text, { as: v, again: true });
  };

  return (
    <Drawer title={t('shared.askQubirex.askQubirex')} onClose={onClose}>
      {learner ? (
        <label className="lj-langpick" data-ask-language={current}>
          <span className="ln-xs">{t('shared.askQubirex.answerIn')}</span>
          <select value={current} onChange={e => changeLang(e.target.value)} aria-label={t('shared.askQubirex.answerLanguage')}>
            {LEARNER_LANGS.map(v => <option key={v} value={v}>{LEARNING_LABEL[v]}</option>)}
          </select>
        </label>
      ) : (
        <div className="ln-seg sk-langs" role="group" aria-label={t('shared.askQubirex.answerLanguage')}>
          {LANGS.map(([id, label]) => <button key={id} type="button" aria-pressed={current === id} onClick={() => changeLang(id)} className="ln-indic">{label}</button>)}
        </div>
      )}
      {thread.length === 0 && (
        <div className="ln-col" style={{ gap: 8 }}>
          <span className="ln-kicker">{t('shared.askQubirex.tryAsking')}</span>
          {(SUGGEST[side][code] || SUGGEST[side].en).map(s => <button key={s} type="button" className="sk-suggest ln-indic" onClick={() => askIt(t(s))}>{t(s)}</button>)}
        </div>
      )}
      <div className="ln-col sk-thread" aria-live="polite">
        {thread.map((m, i) => (
          <div key={i} className={`sk-msg ${m.who === 'you' ? 'is-you' : ''}`}>
            <span className="ln-indic" data-ask-msg={m.who}>{m.text}</span>
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
