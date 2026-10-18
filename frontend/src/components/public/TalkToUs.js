// src/components/public/TalkToUs.js — "Talk to us": a short form that goes
// to the Qubirex help inbox (POST /api/help/contact, no sign-in needed),
// with an email link as a fallback.
import React, { useState } from 'react';
import api from '../../utils/api';
import Drawer from '../shared/Drawer';
import { useUiLang } from '../../context/UiLangContext';
import { CONTACT } from '../../config/contact';
import { Select } from '../shared/ui';

const ROLES = ['talk.roleLearner', 'talk.roleCollege', 'talk.roleEmployer', 'talk.roleOther'];

export default function TalkToUs({ onClose }) {
  const { t } = useUiLang();
  const [f, setF] = useState({ name: '', reply_to: '', role: ROLES[1], message: '' });
  const [state, setState] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const send = async (e) => {
    e.preventDefault(); setErr(''); setState('sending');
    try {
      await api.post('/help/contact', { type: 'question', reply_to: f.reply_to, message: `[${t(f.role)}] ${f.name}: ${f.message}` });
      setState('sent');
    } catch (x) { setErr(x.response?.data?.error && typeof x.response.data.error === 'string' ? x.response.data.error : t('talk.failed')); setState(''); }
  };
  return (
    <Drawer title={t('nav.talk')} onClose={onClose} width={420}>
      {state === 'sent' ? (
        <div className="ln-col" style={{ gap: 10 }} role="status"><b>{t('talk.thanks')}</b><span className="ln-small ln-muted">{t('talk.reply')}</span><button type="button" className="ln-btn" onClick={onClose}>{t('common.close')}</button></div>
      ) : (
        <form className="ln-col" style={{ gap: 12 }} onSubmit={send}>
          <span className="ln-small ln-muted">{t('talk.intro')}</span>
          <div className="ln-field"><label className="ln-label" htmlFor="tk-name">{t('talk.name')}</label><input id="tk-name" className="ln-input" value={f.name} onChange={set('name')} required autoComplete="name" /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="tk-reply">{t('talk.replyTo')}</label><input id="tk-reply" className="ln-input" value={f.reply_to} onChange={set('reply_to')} required autoComplete="email" placeholder={t('talk.replyToHint')} /></div>
          <div className="ln-field"><label className="ln-label" htmlFor="tk-role">{t('talk.iam')}</label>
            <Select id="tk-role" value={f.role} onChange={set('role')}>{ROLES.map(r => <option key={r} value={r}>{t(r)}</option>)}</Select></div>
          <div className="ln-field"><label className="ln-label" htmlFor="tk-msg">{t('talk.message')}</label><textarea id="tk-msg" className="ln-input" rows={5} value={f.message} onChange={set('message')} required minLength={5} /></div>
          {err && <span className="ln-small" style={{ color: 'var(--danger)' }} role="alert">{err}</span>}
          <button type="submit" className="ln-btn ln-btn-primary" disabled={state === 'sending'}>{state === 'sending' ? t('talk.sending') : t('talk.send')}</button>
          <span className="ln-xs ln-muted">{t('talk.orEmail')} <a className="ln-link" href={`mailto:${CONTACT.sales}`}>{CONTACT.sales}</a></span>
        </form>
      )}
    </Drawer>
  );
}
