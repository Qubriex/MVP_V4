// src/components/shared/TopActions.js — the row at the top of every signed-in
// page: Ask Qubirex, Help, Notifications and the language switch
// (EN · తెలుగు · हिंदी; a globe button on phones). One component for all three sides.
import React, { useState } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { useUiLang } from '../../context/UiLangContext';
import AskQubirex from './AskQubirex';
import HelpPanel from './HelpPanel';
import LangSwitch from './LangSwitch';
import { BellButton, NotificationsPanel, useNotifications } from './Notifications';

const SHORT = [['english', 'EN', 'en'], ['telugu', 'తె', 'te'], ['hindi', 'हि', 'hi']];

export default function TopActions({ side = 'learner', settingsHref }) {
  const { lang, t } = useUiLang();
  const [panel, setPanel] = useState(null); // ask | help | notes
  const notes = useNotifications();
  const askLang = (SHORT.find(s => s[0] === lang) || SHORT[0])[2];
  return (
    <>
      <div className="sk-topactions" role="toolbar" aria-label={t('top.toolbar')}>
        <button type="button" className="sk-askbtn" onClick={() => setPanel('ask')} aria-label={t('top.ask')}><Sparkles size={16} aria-hidden="true" /><span className="sk-askbtn-label">{t('top.ask')}</span></button>
        <span style={{ flex: 1 }} />
        <LangSwitch />
        <button type="button" className="sk-iconbtn" onClick={() => setPanel('help')} aria-label={t('top.help')}><HelpCircle size={18} aria-hidden="true" /></button>
        <BellButton unread={notes.unread} onClick={() => setPanel('notes')} />
      </div>
      {panel === 'ask' && <AskQubirex side={side} initialLang={askLang} onClose={() => setPanel(null)} />}
      {panel === 'help' && <HelpPanel side={side} onClose={() => setPanel(null)} />}
      {panel === 'notes' && <NotificationsPanel data={notes} settingsHref={settingsHref} onClose={() => { setPanel(null); notes.reload(); }} />}
    </>
  );
}
