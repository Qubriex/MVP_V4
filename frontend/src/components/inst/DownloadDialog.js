// src/components/inst/DownloadDialog.js
// Download data for a cohort: whole cohort, a selection or one student; a
// period (last 30 days, an academic year, a custom range or everything); and
// what to download — activity (CSV), skill progress (CSV) or the evidence
// report (opens a printable page to save as PDF). Every download is recorded
// in each included student's access history.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { Select } from '../shared/ui';

import { useUiLang } from '../../context/UiLangContext';
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const minus = (d, days) => new Date(Date.parse(`${d}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
// Academic years run 1 June – 31 May.
function academicYear(offset = 0) {
  const t = istToday(); const y = Number(t.slice(0, 4)) - (t.slice(5) < '06-01' ? 1 : 0) - offset;
  return { from: `${y}-06-01`, to: `${y + 1}-05-31`, label: `${y}–${String(y + 1).slice(2)}` };
}

export default function DownloadDialog({ cohort, students, initial = [], onClose }) {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const [scope, setScope] = useState(initial.length === 1 ? 'one' : initial.length ? 'selected' : 'all');
  const [picked, setPicked] = useState(initial);
  const [one, setOne] = useState(initial[0] || students[0]?.el_id || '');
  const [period, setPeriod] = useState('30');
  const [from, setFrom] = useState(minus(istToday(), 29));
  const [to, setTo] = useState(istToday());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const ay = academicYear(0); const lastAy = academicYear(1);

  const range = useMemo(() => {
    if (period === '30') return { from: minus(istToday(), 29), to: istToday() };
    if (period === 'ay') return { from: ay.from, to: ay.to };
    if (period === 'lastay') return { from: lastAy.from, to: lastAy.to };
    if (period === 'all') return { from: '2000-01-01', to: istToday() };
    return { from, to };
  }, [period, from, to, ay.from, ay.to, lastAy.from, lastAy.to]);
  const ids = scope === 'all' ? null : scope === 'one' ? [one].filter(Boolean) : picked;
  const count = ids ? ids.length : students.length;
  const qs = () => { const p = new URLSearchParams(range); if (ids) p.set('el_ids', ids.join(',')); return p.toString(); };

  const save = async (path, filename) => {
    setBusy(path); setMsg('');
    try {
      const r = await api.get(`/institution/engagements/${cohort.id}/${path}?${qs()}`, { responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = filename; a.click();
      setMsg(t('inst.downloadDialog.downloadedFor', { n: count }));
    } catch (e) { setMsg(errMsg(e, t('inst.downloadDialog.downloadFailed'))); }
    setBusy('');
  };
  const report = () => navigate(`/institution/cohorts/${cohort.id}/report?${qs()}`);
  const empty = ids && ids.length === 0;

  return (
    <div className="in-modal-scrim" role="dialog" aria-modal="true" aria-labelledby="dl-title" onClick={onClose}>
      <div className="ln-card in-modal" style={{ maxWidth: 620, width: "100%", gap: 16 }} onClick={e => e.stopPropagation()}>
        <h2 id="dl-title" className="ln-h2">{t('inst.downloadDialog.downloadDataTitle', { title: cohort.title })}</h2>

        <fieldset className="ln-col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="ln-label">{t('inst.downloadDialog.students')}</legend>
          <div className="ln-seg" role="group">
            {[['all', `Whole cohort · ${students.length}`], ['selected', t('inst.downloadDialog.chooseStudents')], ['one', t('inst.downloadDialog.oneStudent')]].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)}>{l}</button>
            ))}
          </div>
          {scope === 'one' && (
            <Select aria-label={t('inst.downloadDialog.student')} value={one} onChange={e => setOne(e.target.value)}>
              {students.map(s => <option key={s.el_id} value={s.el_id}>{s.name} · {s.learner_ref}</option>)}
            </Select>
          )}
          {scope === 'selected' && (
            <div className="ln-tile" style={{ maxHeight: 180, overflowY: 'auto', padding: 10, gap: 4 }}>
              <label className="ln-check"><input type="checkbox" checked={picked.length === students.length} onChange={e => setPicked(e.target.checked ? students.map(s => s.el_id) : [])} />{t('inst.downloadDialog.selectAll')}</label>
              {students.map(s => (
                <label key={s.el_id} className="ln-check"><input type="checkbox" checked={picked.includes(s.el_id)} onChange={() => setPicked(p => (p.includes(s.el_id) ? p.filter(x => x !== s.el_id) : [...p, s.el_id]))} />{s.name} <span className="ln-xs ln-muted">{s.learner_ref}</span></label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="ln-col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="ln-label">{t('inst.downloadDialog.period')}</legend>
          <div className="ln-seg ln-wrap" role="group">
            {[['30', t('inst.downloadDialog.last30Days')], ['ay', `Academic year ${ay.label}`], ['lastay', `Academic year ${lastAy.label}`], ['all', t('inst.downloadDialog.allTime')], ['custom', t('inst.downloadDialog.customDates')]].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="ln-row ln-wrap" style={{ gap: 10 }}>
              <label className="ln-field" style={{ flex: 1 }}><span className="ln-label">{t('inst.downloadDialog.from')}</span><input type="date" className="ln-input" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
              <label className="ln-field" style={{ flex: 1 }}><span className="ln-label">To</span><input type="date" className="ln-input" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
            </div>
          )}
          <span className="ln-xs ln-muted">{t('inst.downloadDialog.fromIndiaTime', { from: range.from, to: range.to })}</span>
        </fieldset>

        <div className="ln-col" style={{ gap: 8 }}>
          <span className="ln-label">{t('inst.downloadDialog.download')}</span>
          <div className="ln-row ln-wrap" style={{ gap: 8 }}>
            <button type="button" className="ln-btn" disabled={!!busy || empty} onClick={() => save('activity.csv', `activity-${cohort.join_code}-${range.from}-to-${range.to}.csv`)}><Download size={16} aria-hidden="true" />{busy === 'activity.csv' ? t('inst.downloadDialog.preparing') : t('inst.downloadDialog.activityCsv')}</button>
            <button type="button" className="ln-btn" disabled={!!busy || empty} onClick={() => save('progress.csv', `skill-progress-${cohort.join_code}.csv`)}><Download size={16} aria-hidden="true" />{busy === 'progress.csv' ? t('inst.downloadDialog.preparing') : t('inst.downloadDialog.skillProgressCsv')}</button>
            <button type="button" className="ln-btn ln-btn-primary" disabled={!!busy || empty} onClick={report}><FileText size={16} aria-hidden="true" />{t('inst.downloadDialog.evidenceReportPdf')}</button>
          </div>
          <span className="ln-xs ln-muted">
            {t('inst.downloadDialog.activityStartLastActive')}
          </span>
        </div>
        {msg && <div className="ln-note" role="status">{msg}</div>}
        <div className="ln-row" style={{ justifyContent: 'flex-end' }}><button type="button" className="ln-btn" onClick={onClose}>{t('inst.downloadDialog.close')}</button></div>
      </div>
    </div>
  );
}
