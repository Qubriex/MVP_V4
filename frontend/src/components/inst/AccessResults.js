// src/components/inst/AccessResults.js
// What staff get back after giving access or resetting PINs:
//   - invite links (the student sets their own PIN) — email delivery isn't
//     switched on yet, so each link can be copied and shared;
//   - login slips with one-time PINs — shown only in this response, printed
//     as cut-out cards (print CSS keeps only the slips). Students must change
//     the PIN at first sign-in.
import React from 'react';
import { Printer } from 'lucide-react';
import CopyLink from './CopyLink';

import { useUiLang } from '../../context/UiLangContext';
const loginUrl = () => `${window.location.origin}/learner-login`;

export function LoginSlips({ slips }) {
  const { t } = useUiLang();
  return (
    <div className="in-print">
      <div className="in-slips">
        {slips.map(s => (
          <div key={s.learner_ref} className="in-slip">
            <b>{s.name}</b>
            <span style={{ color: 'var(--color-text-muted)' }}>{s.cohort}</span>
            <span>{t('inst.accessResults.learnerReference')}{' '} <span className="in-code">{s.learner_ref}</span></span>
            <span>{t('inst.accessResults.joinCode')}{' '} <span className="in-code">{s.join_code}</span></span>
            <span>{t('inst.accessResults.oneTimePin')}{' '} <span className="in-code">{s.pin}</span></span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>{t('inst.accessResults.signAtLoginurlLl', { loginUrl: loginUrl() })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccessResults({ invites = [], slips = [], kept = [], skipped = [] }) {
  const { t } = useUiLang();
  return (
    <div className="ln-col" style={{ gap: 16 }}>
      {invites.length > 0 && (
        <div className="ln-card" style={{ gap: 10 }}>
          <b>{t('inst.accessResults.lengthInvite', { length: invites.length })}</b>
          <span className="ln-small ln-muted">{t('inst.accessResults.emailDeliveryIsnT')}</span>
          {invites.map(i => (
            <div key={i.learner_ref} className="ln-col" style={{ gap: 4 }}>
              <span className="ln-small"><b>{i.name}</b> · {i.learner_ref} · {i.email}</span>
              <CopyLink url={i.invite_url} />
            </div>
          ))}
        </div>
      )}
      {slips.length > 0 && (
        <div className="ln-card" style={{ gap: 12 }}>
          <div className="ln-between ln-wrap in-no-print">
            <div className="ln-col"><b>{t('inst.accessResults.lengthLoginSlip', { length: slips.length })}</b>
              <span className="ln-small ln-muted">{t('inst.accessResults.oneTimePinsShown')}</span></div>
            <button type="button" className="ln-btn ln-btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />{t('inst.accessResults.printSlipsSaveAs')}</button>
          </div>
          <LoginSlips slips={slips} />
        </div>
      )}
      {kept.length > 0 && <div className="ln-note">{t('inst.accessResults.keptPin', { n: kept.length, names: kept.map(k => k.name).join(', ') })}</div>}
      {skipped.length > 0 && <div className="ln-note" style={{ background: 'var(--status-warning-bg)', color: 'var(--warn)' }}>{t('inst.accessResults.skippedJoin', { join: skipped.map(s => `${s.name || `row ${s.row}`} (${s.check || s.reason})`).join('; ') })}</div>}
    </div>
  );
}
