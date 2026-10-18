// src/pages/admin/Ontology.js — /admin/ontology — skill texts that did not
// resolve (§3.2): make each an alias of an existing skill, a new skill, or
// reject it. Approved texts become part of the ontology and pathway nodes are
// re-mapped.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { Select } from '../../components/shared/ui';

import { useUiLang } from '../../context/UiLangContext';
function Item({ item, skills, onDone }) {
  const { t } = useUiLang();
  const [mode, setMode] = useState('alias');
  const [skillId, setSkillId] = useState('');
  const [name, setName] = useState(item.text);
  const [parent, setParent] = useState('');
  const [error, setError] = useState('');
  const act = async (action) => {
    setError('');
    const body = action === 'alias' ? { action, skill_id: skillId } : action === 'create' ? { action, name, parent: parent || null, domain: skills.find(s => s.skill_id === parent)?.domain } : { action };
    try { const r = await api.post(`/admin/ontology-review/${item.id}`, body); onDone(r.data); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <article className="ln-card" style={{ gap: 8 }}>
      <div className="ln-between ln-wrap"><b>“{item.text}”</b><span className="ln-xs ln-muted">{t('adm.ontology.sourceSeenOccurrences', { source: item.source, occurrences: item.occurrences })}</span></div>
      {item.context && <div className="ln-xs ln-muted">{Object.entries(item.context).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
      {error && <div className="ln-error">{error}</div>}
      {item.status === 'pending' ? <>
        <div className="ln-pilltabs" role="tablist">
          {[['alias', t('adm.ontology.aliasOfExisting')], ['create', t('adm.ontology.newSkill')]].map(([m, l]) => <button key={m} type="button" role="tab" className="ln-pilltab" aria-selected={mode === m} onClick={() => setMode(m)}>{l}</button>)}
        </div>
        <div className="ln-row ln-wrap" style={{ gap: 8 }}>
          {mode === 'alias' ? (
            <Select aria-label={t('adm.ontology.existingSkill')} value={skillId} onChange={e => setSkillId(e.target.value)} style={{ minWidth: 260 }}>
              <option value="">{t('adm.ontology.pickSkill')}</option>{skills.map(s => <option key={s.skill_id} value={s.skill_id}>{s.parent_skill_id ? '  ↳ ' : ''}{s.name} ({s.domain})</option>)}
            </Select>
          ) : <>
            <input className="ln-input" aria-label={t('adm.ontology.skillName')} value={name} onChange={e => setName(e.target.value)} />
            <Select aria-label={t('adm.ontology.parentSkill')} value={parent} onChange={e => setParent(e.target.value)}>
              <option value="">{t('adm.ontology.noParentTopLevel')}</option>{skills.filter(s => !s.parent_skill_id).map(s => <option key={s.skill_id} value={s.skill_id}>{s.name}</option>)}
            </Select>
          </>}
          <button type="button" className="ln-btn ln-btn-primary" disabled={mode === 'alias' ? !skillId : !name.trim()} onClick={() => act(mode)}>{mode === 'alias' ? t('adm.ontology.addAlias') : t('adm.ontology.createSkill')}</button>
          <button type="button" className="ln-btn" onClick={() => act('reject')}>{t('adm.ontology.reject')}</button>
        </div>
      </> : <span className="ln-small ln-muted">{item.status}{item.resolved_skill_id ? ` → ${item.resolved_skill_id}` : ''}</span>}
    </article>
  );
}

export default function AdminOntology() {
  const { t } = useUiLang();
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [skills, setSkills] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/admin/ontology-review?status=${status}`).then(r => setData(r.data)).catch(e => setError(errMsg(e))), [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/admin/skills').then(r => setSkills(r.data.skills)).catch(() => {}); }, [note]);
  const domains = useMemo(() => [...new Set(skills.map(s => s.domain))].length, [skills]);
  return (
    <>
      <header className="ln-pagehead"><div className="ln-col" style={{ gap: 4 }}><h1 className="ln-title">{t('adm.ontology.skillsOntology')}</h1>
        <span className="ln-sub">{t('adm.ontology.lengthSkillsDomainsDomains', { length: skills.length, domains })}</span></div></header>
      {error && <div className="ln-error" role="alert">{error}</div>}
      {note && <div className="ln-note" role="status">{note}</div>}
      <div className="ln-pilltabs" role="tablist" style={{ marginBottom: 14 }}>
        {['pending', 'aliased', 'created', 'rejected'].map(s => <button key={s} type="button" role="tab" className="ln-pilltab" aria-selected={status === s} onClick={() => setStatus(s)}>{t(`adm.ontology.status.${s}`)}{data?.counts?.[s] ? ` · ${data.counts[s]}` : ''}</button>)}
      </div>
      <div className="ln-col" style={{ gap: 12 }}>
        {data && data.items.length === 0 && <p className="ln-muted">{t('adm.ontology.nothingHere')}</p>}
        {(data?.items || []).map(i => <Item key={i.id} item={i} skills={skills} onDone={(r) => { setNote([r.skill_id ? t('adm.ontology.savedAs', { id: r.skill_id }) : t('adm.ontology.saved'), r.remapped_nodes ? t('adm.ontology.remapped', { n: r.remapped_nodes }) : ''].join(' ').trim()); load(); }} />)}
      </div>
    </>
  );
}
