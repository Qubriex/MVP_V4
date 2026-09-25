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
    }).catch(() => setError('Couldn’t load your cohorts.'));
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
      .then(r => setPreview(r.data)).catch(e => setError(e.response?.data?.error || 'Couldn’t check the rows.')), 350);
    return () => clearTimeout(t);
  }, [cohortId, delivery, students, existing]); // eslint-disable-line

  const readFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setError('Upload a .csv file. In Excel, use File → Save As → CSV.'); return; }
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
    } catch (e) { setError(e.response?.data?.error || 'Couldn’t give access.'); }
    setBusy(false);
  };
  const reset = () => { setDone(null); setTyped([blankRow(), blankRow(), blankRow()]); setCsv(null); setPicked([]); setPreview(null); };

  const cohort = cohorts.find(c => c.id === cohortId);
  const s = preview?.summary;
  const checkFor = (i) => preview?.rows?.[i];

  if (done) {
    return (
      <>
        <Link to="/institution/students" className="ln-link" style={{ alignSelf: 'flex-start' }}>← Students &amp; access</Link>
        <section className="ln-card" style={{ gap: 18 }}>
          <h1 className="ln-title" style={{ fontSize: 30 }}>{done.added} student{done.added === 1 ? '' : 's'} now {done.added === 1 ? 'has' : 'have'} access</h1>
          <span className="ln-sub">Cohort: <b>{done.cohort.title}</b> · Join code <b className="in-code">{done.cohort.join_code}</b></span>
          <AccessResults invites={done.invites} slips={done.slips} kept={done.kept} skipped={done.skipped} />
          <div className="ln-row in-no-print" style={{ gap: 10 }}>
            <Link to={`/institution/students?engagement_id=${done.cohort.id}`} className="ln-btn">Back to students</Link>
            <button type="button" className="ln-btn ln-btn-primary" onClick={reset}>Add more</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Link to="/institution/students" className="ln-link" style={{ alignSelf: 'flex-start' }}>← Students &amp; access</Link>
      <h1 className="ln-title">Add students and give access</h1>

      <div className="ln-grid ln-g-detail" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
        <div className="ln-col" style={{ gap: 20, minWidth: 0 }}>
          <section className="ln-card">
            <div className="ln-between ln-wrap"><h2 className="ln-h2">1 · Who</h2>
              <div className="ln-tabs" role="tablist">
                {[['type', 'Type in'], ['csv', 'Upload CSV'], ['pick', 'Pick existing students']].map(([id, label]) => (
                  <button key={id} type="button" role="tab" className="ln-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>
            </div>

            {tab === 'type' && (
              <div className="ln-col" style={{ gap: 8 }}>
                {typed.map((r, i) => (
                  <div key={i} className="in-rowedit">
                    <input className="ln-input" aria-label={`Row ${i + 1} name`} placeholder="Full name" value={r.name} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="ln-input" aria-label={`Row ${i + 1} roll or ref number`} placeholder="Roll / ref no." value={r.learner_ref} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, learner_ref: e.target.value } : x)))} />
                    <input className="ln-input" type="email" aria-label={`Row ${i + 1} email`} placeholder="Email (optional)" value={r.email} onChange={e => setTyped(t => t.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    <button type="button" className="ln-btn ln-btn-sm" aria-label={`Remove row ${i + 1}`} onClick={() => setTyped(t => (t.length > 1 ? t.filter((_, j) => j !== i) : [blankRow()]))}><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" className="ln-btn ln-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setTyped(t => [...t, blankRow()])}><Plus size={14} aria-hidden="true" />Add row</button>
              </div>
            )}

            {tab === 'csv' && (
              <div className="ln-col" style={{ gap: 12 }}>
                <div className="ln-tile ln-between ln-wrap" style={{ padding: 14, flexDirection: 'row' }}>
                  <div className="ln-col"><b>{csv ? csv.name : 'No file yet'}</b>
                    <span className="ln-small ln-muted">{csv ? `${csv.rows.length} rows read` : 'Columns: name, learner_ref (roll no.), email. From Excel, save as CSV.'}{' · '}
                      <button type="button" className="ln-link" style={{ fontSize: 13 }} onClick={downloadTemplate}><Download size={12} aria-hidden="true" style={{ display: 'inline' }} /> Download template</button></span></div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="ln-sr" onChange={readFile} id="csvfile" />
                  <button type="button" className="ln-btn" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" />{csv ? 'Replace file' : 'Choose file'}</button>
                </div>
                {csv && (
                  <div className="ln-tablewrap">
                    <table className="ln-table"><thead><tr><th>Name</th><th>Roll / ref no.</th><th>Email</th><th>Check</th></tr></thead>
                      <tbody>{csv.rows.slice(0, 50).map((r, i) => {
                        const c = checkFor(i);
                        return <tr key={i}><td>{r.name}</td><td>{r.learner_ref}</td><td>{r.email || '—'}</td>
                          <td>{c && <span className={`ln-tag ${c.ok ? (c.check.includes('slip') ? 'ln-tag-info' : 'ln-tag-success') : 'in-state-locked'}`}>{c.ok ? '✓' : '!'} {c.check}</span>}</td></tr>;
                      })}</tbody></table>
                    {csv.rows.length > 50 && <span className="ln-small ln-muted">+ {csv.rows.length - 50} more rows</span>}
                  </div>
                )}
              </div>
            )}

            {tab === 'pick' && (
              <div className="ln-col" style={{ gap: 10 }}>
                <input className="ln-input" aria-label="Search students" placeholder="Search by name or ref" value={poolQ} onChange={e => setPoolQ(e.target.value)} />
                <div className="ln-col ln-divided" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {pool.length === 0 && <span className="ln-small ln-muted" style={{ padding: 8 }}>No other students found outside this cohort.</span>}
                  {pool.map(p => (
                    <label key={p.id} className="ln-check" style={{ padding: '8px 4px' }}>
                      <input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(x => (x.includes(p.id) ? x.filter(y => y !== p.id) : [...x, p.id]))} />
                      <span className="ln-col"><b style={{ fontWeight: 600 }}>{p.name}</b><span className="ln-xs ln-muted">{p.learner_ref} · in {p.cohorts}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {tab === 'type' && preview && (
              <div className="ln-row ln-wrap" style={{ gap: 6 }}>
                {preview.rows.map(r => <span key={r.row} className={`ln-tag ${r.ok ? 'ln-tag-success' : 'in-state-locked'}`}>{r.name || `Row ${r.row}`}: {r.check}</span>)}
              </div>
            )}
          </section>

          <section className="ln-card">
            <h2 className="ln-h2">2 · Which cohort</h2>
            {cohorts.length === 0 && <span className="ln-small ln-muted">No cohorts in your scope yet.</span>}
            <div className="ln-grid ln-g-2" style={{ gap: 10 }}>
              {cohorts.map(c => (
                <button key={c.id} type="button" className="in-choice" aria-pressed={c.id === cohortId} onClick={() => setCohortId(c.id)}>
                  <b>{c.title}</b>
                  <span className="ln-small ln-muted">{c.learner_count} students · {c.language === 'hindi' ? 'Hindi' : 'Telugu'} · Join code <b className="in-code">{c.join_code}</b></span>
                </button>
              ))}
            </div>
            <span className="ln-xs ln-muted">Students start at the first skill node. Language comes from the cohort.</span>
          </section>

          <section className="ln-card">
            <h2 className="ln-h2">3 · How they get access</h2>
            <label className="in-radio"><input type="radio" name="delivery" checked={delivery === 'email'} onChange={() => setDelivery('email')} />
              <div className="ln-col"><b>Email invite link <span className="ln-tag ln-tag-success" style={{ marginLeft: 6 }}>Recommended</span></b>
                <span className="ln-small ln-muted">Each student opens the link and sets their own PIN. You never see or share PINs. Students without an email get a printed slip instead.</span></div></label>
            <label className="in-radio"><input type="radio" name="delivery" checked={delivery === 'slips'} onChange={() => setDelivery('slips')} />
              <div className="ln-col"><b>Printed login slips</b>
                <span className="ln-small ln-muted">A one-time PIN per student on cut-out slips. The student must change the PIN at first sign-in.</span></div></label>
          </section>
        </div>

        <aside className="ln-card ln-card-dark" style={{ gap: 12, position: 'sticky', top: 24, alignSelf: 'start' }}>
          <span className="ln-kicker" style={{ color: 'var(--stage-muted)' }}>Summary</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600 }}>{s ? s.adding : 0} student{s?.adding === 1 ? '' : 's'}</span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--stage-muted)' }}>
            {cohort ? <>join <b style={{ color: 'var(--stage-text)' }}>{cohort.title}</b>.</> : 'Pick a cohort.'}
            {s && <> {s.invites ? `${s.invites} get an email invite. ` : ''}{s.slips ? `${s.slips} get printed slips. ` : ''}{s.keep_pin ? `${s.keep_pin} keep their existing PIN. ` : ''}{s.skipped ? `${s.skipped} row${s.skipped > 1 ? 's' : ''} skipped until fixed.` : ''}</>}
          </span>
          {error && <div className="ln-error" role="alert">{error}</div>}
          <button type="button" className="ln-btn ln-btn-amber" style={{ borderRadius: 'var(--radius-md)' }} disabled={busy || !s || !s.adding} onClick={submit}>{busy ? 'Giving access…' : 'Give access'}</button>
          <span className="ln-xs" style={{ color: 'var(--stage-muted)', lineHeight: 1.5 }}>This is one step on the server: students, enrolment and invites are created together, so nothing is left half-done if you close the page.</span>
        </aside>
      </div>
    </>
  );
}
