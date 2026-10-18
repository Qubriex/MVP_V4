// src/components/shared/HelpPanel.js — Help: common questions per side, a
// contact form (answered on WhatsApp or email within 1 working day) and
// whether the service is running.
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import Drawer from './Drawer';
import { Select } from './ui';

import { useUiLang, uiLocale } from '../../context/UiLangContext';
const DOCS = {
  learner: [
    ['shared.helpPanel.docs.howIsReadinessCounted', 'shared.helpPanel.docs.readinessComparesTheSkills'],
    ['shared.helpPanel.docs.whoCanSeeMy', 'shared.helpPanel.docs.anyoneWithYourEvidence'],
    ['shared.helpPanel.docs.iForgotMyPin', 'shared.helpPanel.docs.onTheSignIn'],
    ['shared.helpPanel.docs.whyWasISigned', 'shared.helpPanel.docs.yourAccountWorksOn'],
    ['shared.helpPanel.docs.howDoReviewsWork', 'shared.helpPanel.docs.aFewDaysAfter']
  ],
  staff: [
    ['shared.helpPanel.docs.howIsReadinessCounted', 'shared.helpPanel.docs.forEachStudentHow'],
    ['shared.helpPanel.docs.whoCanSeeA', 'shared.helpPanel.docs.anyoneCanCheckA'],
    ['shared.helpPanel.docs.howDoIReset', 'shared.helpPanel.docs.studentsAccessSelectThe'],
    ['shared.helpPanel.docs.howDoIStart', 'shared.helpPanel.docs.bridgeProgrammesNewChoose'],
    ['shared.helpPanel.docs.whatDoTheLive', 'shared.helpPanel.docs.greenLearningNowYellow']
  ],
  employer: [
    ['shared.helpPanel.docs.whatDoesAPassport', 'shared.helpPanel.docs.thatTheRecordIs'],
    ['shared.helpPanel.docs.whenCanISee', 'shared.helpPanel.docs.searchIsAnonymousYou'],
    ['shared.helpPanel.docs.isVerifyingFree', 'shared.helpPanel.docs.yesOnePassportAt']
  ]
};

export default function HelpPanel({ side = 'learner', onClose }) {
  const { t } = useUiLang();
  const [tab, setTab] = useState('docs');
  const [open, setOpen] = useState(null);
  const [type, setType] = useState('question');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState('');
  const [status, setStatus] = useState(null);
  useEffect(() => { if (tab === 'status') api.get('/help/status').then(r => setStatus(r.data)).catch(() => setStatus({ ok: false })); }, [tab]);
  const send = async (e) => {
    e.preventDefault(); setSent('');
    try { const r = await api.post('/help/contact', { type, message }); setSent(r.data.message); setMessage(''); } catch (err) { setSent(errMsg(err, t('shared.helpPanel.couldnTSendTry'))); }
  };
  return (
    <Drawer title={t('shared.helpPanel.help')} onClose={onClose}>
      <div className="ln-tabs" role="tablist">
        {[['docs', t('shared.helpPanel.docs')], ['contact', t('shared.helpPanel.contact')], ['status', t('shared.helpPanel.status')]].map(([id, l]) => <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {tab === 'docs' && (
        <div className="ln-col" style={{ gap: 6 }}>
          {DOCS[side].map(([qq, a], i) => (
            <div key={qq} className="sk-faq">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(o => (o === i ? null : i))}>{t(qq)}<span aria-hidden="true">{open === i ? '–' : '›'}</span></button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === 'contact' && (
        <form className="ln-col" style={{ gap: 10 }} onSubmit={send}>
          <label className="ln-field"><span className="ln-label">{t('shared.helpPanel.type')}</span>
            <Select value={type} onChange={e => setType(e.target.value)}>
              <option value="question">{t('shared.helpPanel.question')}</option><option value="problem">{t('shared.helpPanel.somethingNotWorking')}</option>
              <option value="data_request">{t('shared.helpPanel.myData')}</option><option value="grievance">{t('shared.helpPanel.complaintGrievanceOfficer')}</option>
            </Select></label>
          <label className="ln-field"><span className="ln-label">{t('shared.helpPanel.message')}</span>
            <textarea className="ln-textarea" rows={5} value={message} onChange={e => setMessage(e.target.value)} required minLength={5} /></label>
          <button type="submit" className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }}>{t('shared.helpPanel.send')}</button>
          <span className="ln-xs ln-muted">{t('shared.helpPanel.weReplyWhatsappEmail')}</span>
          {sent && <span className="ln-small" role="status">{sent}</span>}
        </form>
      )}
      {tab === 'status' && (
        <div className="ln-col" style={{ gap: 8 }}>
          {!status ? <span className="ln-small ln-muted">{t('shared.helpPanel.checking')}</span> : (
            <>
              <span className="ln-row" style={{ gap: 8, fontWeight: 600 }}><span className={`in-light ${status.ok ? 'is-green' : 'is-red'}`}><i aria-hidden="true" /></span>{status.ok ? t('shared.helpPanel.allSystemsRunning') : t('shared.helpPanel.somePartsNotResponding')}</span>
              <span className="ln-small">{t('shared.helpPanel.lessonsAiHelp')}{' '} {status.ai ? t('shared.helpPanel.running') : t('shared.helpPanel.notSetUpDeployment')}</span>
              <span className="ln-xs ln-muted">{t('shared.helpPanel.lastChecked')}{' '} {status.checked_at ? new Date(status.checked_at).toLocaleTimeString(uiLocale(), { hour: 'numeric', minute: '2-digit' }) : t('shared.helpPanel.justNow')}</span>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
