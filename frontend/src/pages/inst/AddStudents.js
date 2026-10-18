// src/pages/inst/AddStudents.js — /institution/students/add
// One flow to give students access: 1 · who (type in, upload a CSV, or pick
// existing students), 2 · which cohort, 3 · how they get in (email invite or
// printed slip). The server checks every row as you go, and "Give access"
// is a single server step — students, enrolment and invites are created
// together, so closing the page can't leave anyone half set up.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Upload, Download } from 'lucide-react';
import api from '../../utils/api';
import AccessResults from '../../components/inst/AccessResults';
import { errMsg } from '../../utils/errors';

import { useUiLang } from '../../context/UiLangContext';
const TEMPLATE = 'name,learner_ref,email\nNikhil Gupta,CSE27-A-065,nikhil.g@student.edu.in\nImran Khan,CSE27-A-067,\n';
const blankRow = () => ({ name: '', learner_ref: '', email: '' });

// Small CSV reader: quoted fields, commas or semicolons, header optional.
function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const sep = (lines[0] || '').includes(';') && !(lines[0] || '').includes(',') ? ';' : ',';
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q; } else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  };
  let rows = lines.map(split);
  let idx = { name: 0, learner_ref: 1, email: 2 };
  const head = (rows[0] || []).map(h => h.toLowerCase());
  if (head.some(h => /name|ref|roll|email/.test(h))) {
    const find = (re) => head.findIndex(h => re.test(h));
    idx = { name: find(/name/), learner_ref: find(/ref|roll|id/), email: find(/mail/) };
    rows = rows.slice(1);
  }
  return rows.map(r => ({ name: r[idx.name] || '', learner_ref: r[idx.learner_ref] || '', email: idx.email >= 0 ? r[idx.email] || '' : '' }));
}

export default function AddStudents() {
  const { t: tx } = useUiLang();
  const [params] = useSearchParams();
  const [tab, setTab] = useState('type');
  const [typed, setTyped] = useState([blankRow(), blankRow(), blankRow()]);
  const [csv, setCsv] = useState(null); // { name, rows }
  const [pool, setPool] = useState([]);
  const [poolQ, setPoolQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState(params.get('cohort') || '');
  const [delivery, setDelivery] = useState('email');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/institution/engagements').then(r => {
      setCohorts(r.data);
      if (!cohortId && r.data[0]) setCohortId(r.data[0].id);
    }).catch(() => setError(tx('inst.addStudents.couldnTLoadCohorts')));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!cohortId) return;
    const t = setTimeout(() => api.get(`/institution/students-pool?exclude_engagement_id=${cohortId}&q=${encodeURIComponent(poolQ)}`).then(r => setPool(r.data)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [cohortId, poolQ]);

  const students = useMemo(() => {
    const src = tab === 'csv' ? (csv?.rows || []) : tab === 'type' ? typed : [];
    return src.filter(r => r.name.trim() || r.learner_ref.trim() || r.email.trim());
  }, [tab, csv, typed]);
  const existing = useMemo(() => (tab === 'pick' ? picked : []), [tab, picked]);

  useEffect(() => {
    if (!cohortId || (!students.length && !existing.length)) { setPreview(null); return undefined; }
    const t = setTimeout(() => api.post('/institution/students/enrol/preview', { engagement_id: cohortId, delivery, students, existing_learner_ids: existing })
      .then(r => setPreview(r.data)).catch(e => setError(errMsg(e, tx('inst.addStudents.couldnTCheckRows')))), 350);
    return () => clearTimeout(t);
  }, [cohortId, delivery, students, existing]); // eslint-disable-line

  const readFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setError(tx('inst.addStudents.uploadCsvFileExcel')); return; }
    const reader = new FileReader();
    reader.onload = () => { setError(''); setCsv({ name: file.name, rows: parseCsv(String(reader.result)) }); };
    reader.readAsText(file);
  };
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    a.download = 'qubirex-students-template.csv';
    a.click();
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post('/institution/students/enrol', { engagement_id: cohortId, delivery, students, existing_learner_ids: existing });
      setDone(res.data);
    } catch (e) { setError(errMsg(e, tx('inst.addStudents.couldnTGiveAccess'))); }
    setBusy(false);
  };
  const reset = () => { setDone(null); setTyped([blankRow(), blankRow(), blankRow()]); setCsv(null); setPicked([]); setPreview(null); };

  const cohort = cohorts.find(c => c.id === cohortId);
  const s = preview?.summary;
  const checkFor = (i) => preview?.rows?.[i];

  if (done) {
    return (
      <>
        <Link to="/institution/students" className="ln-link" style={{ alignSelf: 'flex-start' }}>{tx('inst.addStudents.studentsAccess')}</Link>
        <section className="ln-card" style={{ gap: 18 }}>
          <h1 className="ln-title" style={{ fontSize: 'var(--fs-h1)' }}>{tx('inst.addStudents.doneTitle', { n: done.added })}</h1>
          <span className="ln-sub">{tx('inst.addStudents.cohort')}{' '} <b>{done.cohort.title}</b> {' '}{tx('inst.addStudents.joinCode')}{' '} <b className="in-code">{done.cohort.join_code}</b></span>
          <AccessResults invites={done.invites} slips={done.slips} kept={done.kept} skipped={done.skipped} />
          <div className="ln-row in-no-print" style={{ gap: 10 }}>
            <Link to={`/institution/students?engagement_id=${done.cohort.id}`} className="ln-btn">{tx('inst.addStudents.backStudents')}</Link>
            <button type="button" className="ln-btn ln-btn-primary" onClick={reset}>{tx('inst.addStudents.addMore')}</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Link to="/institution/students" className="ln-link" style={{ alignSelf: 'flex-start' }}>{tx('inst.addStudents.studentsAccess')}</Link>
      <h1 className="ln-title">{tx('inst.addStudents.addStudentsGiveAccess')}</h1>

      <div className="ln-grid ln-g-detail ui-g-side">
        <div className="ln-col" style={{ gap: 20, minWidth: 0 }}>
          <section className="ln-card">
            <div className="ln-between ln-wrap"><h2 className="ln-h2">{tx('inst.addStudents.1Who')}</h2>
              <div className="ln-tabs" role="tablist">
                {[['type', tx('inst.addStudents.typeIn')], ['csv', tx('inst.addStudents.uploadCsv')], ['pick', tx('inst.addStudents.pickExistingStudents')]].map(([id, label]) => (
                  <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>
            </div>

            {tab === 'type' && (
              <div className="ln-col" style={{ gap: 8 }}>
                {typed.map((r, i) => (
                  <div key={i} className="in-rowedit">
                    <input className="ln-input" aria-label={tx('inst.addStudents.rowValueName', { value: i + 1 })} placeholder={tx('inst.addStudents.fullName')} value={r.name} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="ln-input" aria-label={tx('inst.addStudents.rowValueRollRef', { value: i + 1 })} placeholder={tx('inst.addStudents.rollRefNo')} value={r.learner_ref} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, learner_ref: e.target.value } : x)))} />
                    <input className="ln-input" type="email" aria-label={tx('inst.addStudents.rowValueEmail', { value: i + 1 })} placeholder={tx('inst.addStudents.emailOptional')} value={r.email} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    <button type="button" className="ln-btn ln-btn-sm" aria-label={tx('inst.addStudents.removeRowValue', { value: i + 1 })} onClick={() => setTyped(t => (t.length > 1 ? t.filter((_, j) => j !== i) : [blankRow()]))}><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setTyped(t => [...t, blankRow()])}><Plus size={14} aria-hidden="true" />{tx('inst.addStudents.addRow')}</button>
              </div>
            )}

            {tab === 'csv' && (
              <div className="ln-col" style={{ gap: 12 }}>
                <div className="ln-tile ln-between ln-wrap" style={{ padding: 14, flexDirection: 'row' }}>
                  <div className="ln-col"><b>{csv ? csv.name : tx('inst.addStudents.noFileYet')}</b>
                    <span className="ln-small ln-muted">{csv ? tx('inst.addStudents.rowsRead', { n: csv.rows.length }) : tx('inst.addStudents.columnsNameLearnerRef')}{' · '}
                      <button type="button" className="ln-link" style={{ fontSize: 'var(--fs-small)' }} onClick={downloadTemplate}><Download size={12} aria-hidden="true" style={{ display: 'inline' }} /> {' '}{tx('inst.addStudents.downloadTemplate')}</button></span></div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="ln-sr" onChange={readFile} id="csvfile" />
                  <button type="button" className="ln-btn" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" />{csv ? tx('inst.addStudents.replaceFile') : tx('inst.addStudents.chooseFile')}</button>
                </div>
                {csv && (
                  <div className="ln-tablewrap">
                    <table className="ln-table"><thead><tr><th>{tx('inst.addStudents.name')}</th><th>{tx('inst.addStudents.rollRefNo')}</th><th>{tx('inst.addStudents.email')}</th><th>{tx('inst.addStudents.check')}</th></tr></thead>
                      <tbody>{csv.rows.slice(0, 50).map((r, i) => {
                        const c = checkFor(i);
                        return <tr key={i}><td>{r.name}</td><td>{r.learner_ref}</td><td>{r.email || '—'}</td>
                          <td>{c && <span className={`ln-tag ${c.ok ? (c.check.includes('slip') ? 'ln-tag-info' : 'ln-tag-success') : 'in-state-locked'}`}>{c.ok ? '✓' : '!'} {c.check}</span>}</td></tr>;
                      })}</tbody></table>
                    {csv.rows.length > 50 && <span className="ln-small ln-muted">{tx('inst.addStudents.valueMoreRows', { value: csv.rows.length - 50 })}</span>}
                  </div>
                )}
              </div>
            )}

            {tab === 'pick' && (
              <div className="ln-col" style={{ gap: 10 }}>
                <input className="ln-input" aria-label={tx('inst.addStudents.searchStudents')} placeholder={tx('inst.addStudents.searchByNameRef')} value={poolQ} onChange={e => setPoolQ(e.target.value)} />
                <div className="ln-col ln-divided" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {pool.length === 0 && <span className="ln-small ln-muted" style={{ padding: 8 }}>{tx('inst.addStudents.noOtherStudentsFound')}</span>}
                  {pool.map(p => (
                    <label key={p.id} className="ln-check" style={{ padding: '8px 4px' }}>
                      <input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(x => (x.includes(p.id) ? x.filter(y => y !== p.id) : [...x, p.id]))} />
                      <span className="ln-col"><b style={{ fontWeight: 600 }}>{p.name}</b><span className="ln-xs ln-muted">{tx('inst.addStudents.learnerRefCohorts', { learner_ref: p.learner_ref, cohorts: p.cohorts })}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {tab === 'type' && preview && (
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>
                {preview.rows.map(r => <span key={r.row} className={`ln-tag ${r.ok ? 'ln-tag-success' : 'in-state-locked'}`}>{r.name || tx('inst.addStudents.rowN', { n: r.row })}: {r.check}</span>)}
              </div>
            )}
          </section>

          <section className="ln-card">
            <h2 className="ln-h2">{tx('inst.addStudents.2WhichCohort')}</h2>
            {cohorts.length === 0 && <span className="ln-small ln-muted">{tx('inst.addStudents.noCohortsScopeYet')}</span>}
            <div className="ln-grid ln-g-2" style={{ gap: 10 }}>
              {cohorts.map(c => (
                <button key={c.id} type="button" className="in-choice" aria-pressed={c.id === cohortId} onClick={() => setCohortId(c.id)}>
                  <b>{c.title}</b>
                  <span className="ln-small ln-muted">{tx('inst.addStudents.learnerCountStudents', { learner_count: c.learner_count })}{' '} {c.language === 'hindi' ? tx('inst.addStudents.hindi') : tx('inst.addStudents.telugu')} {' '}{tx('inst.addStudents.joinCode')}{' '} <b className="in-code">{c.join_code}</b></span>
                </button>
              ))}
            </div>
            <span className="ln-xs ln-muted">{tx('inst.addStudents.studentsStartAtFirst')}</span>
          </section>

          <section className="ln-card">
            <h2 className="ln-h2">{tx('inst.addStudents.3HowTheyGet')}</h2>
            <label className="in-radio"><input type="radio" name="delivery" checked={delivery === 'email'} onChange={() => setDelivery('email')} />
              <div className="ln-col"><b>{tx('inst.addStudents.emailInviteLink')}{' '} <span className="ln-tag ln-tag-success" style={{ marginLeft: 6 }}>{tx('inst.addStudents.recommended')}</span></b>
                <span className="ln-small ln-muted">{tx('inst.addStudents.eachStudentOpensLink')}</span></div></label>
            <label className="in-radio"><input type="radio" name="delivery" checked={delivery === 'slips'} onChange={() => setDelivery('slips')} />
              <div className="ln-col"><b>{tx('inst.addStudents.printedLoginSlips')}</b>
                <span className="ln-small ln-muted">{tx('inst.addStudents.oneTimePinPer')}</span></div></label>
          </section>
        </div>

        <aside className="ln-card ln-card-dark" style={{ gap: 12, position: 'sticky', top: 24, alignSelf: 'start' }}>
          <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>{tx('inst.addStudents.summary')}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)', fontWeight: 600 }}>{s?.adding === 1 ? tx('inst.addStudents.oneStudent') : tx('inst.addStudents.nStudents', { n: s ? s.adding : 0 })}</span>
          <span style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--stage-muted)' }}>
            {cohort ? <>{tx('inst.addStudents.cohort')}{' '} <b style={{ color: 'var(--stage-text)' }}>{cohort.title}</b></> : tx('inst.addStudents.pickCohort')}
            {s && <> {[s.invites && tx('inst.addStudents.sumInvites', { n: s.invites }), s.slips && tx('inst.addStudents.sumSlips', { n: s.slips }), s.keep_pin && tx('inst.addStudents.sumKeep', { n: s.keep_pin }), s.skipped && tx('inst.addStudents.sumSkipped', { n: s.skipped })].filter(Boolean).join(' ')}</>}
          </span>
          {error && <div className="ln-error" role="alert">{error}</div>}
          <button type="button" className="ln-btn ln-btn-primary ln-btn-lg" style={{ borderRadius: 'var(--radius-md)' }} disabled={busy || !s || !s.adding} onClick={submit}>{busy ? tx('inst.addStudents.givingAccess') : tx('inst.addStudents.giveAccess')}</button>
          <span className="ln-xs" style={{ color: 'var(--stage-muted)', lineHeight: 1.5 }}>{tx('inst.addStudents.oneStepServerStudents')}</span>
        </aside>
      </div>
    </>
  );
}
