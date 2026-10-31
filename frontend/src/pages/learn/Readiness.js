// src/pages/learn/Readiness.js — /learn/readiness: readiness for a role and
// the bridge plan. Pick a role; one grouped chart shows every skill's three
// bars (where you are, where your course takes you, what employers ask) with
// the band and a one-line summary ("2 skills short: SQL joins, pandas"); below
// it, per skill, the hours to close the gap and "Add to my plan". Also the
// skills your course won't cover and the best-fitting roles.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Check, Clock } from 'lucide-react';
import api from '../../utils/api';
import { errMsg } from '../../utils/errors';
import { useUiLang } from '../../context/UiLangContext';
import { PageHeader, Skeleton, Select, BandPill } from '../../components/shared/ui';
import { WhyThis } from '../../components/shared/Popover';
import { ReadinessWords } from '../../components/learn/journey';
import { GroupedBars } from '../../components/shared/Charts';

export default function Readiness() {
  const { t } = useUiLang();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const role = params.get('role');
  const load = useCallback(() => api.get('/learner/readiness', { params: role ? { role } : {} }).then(r => setData(r.data)).catch(e => setError(errMsg(e))), [role]);
  useEffect(() => { load(); }, [load]);
  const add = async (skill) => { try { const r = await api.post('/learner/plan', { skill, source: 'readiness' }); setData(d => ({ ...d, plan: r.data.plan })); } catch (e) { setError(errMsg(e)); } };
  const inPlan = (name) => (data?.plan || []).some(p => p.skill_name === name);

  if (!data) return error ? <div className="ln-error" role="alert">{error}</div> : <Skeleton lines={6} card />;
  const r = data.role;
  return (
    <>
      <PageHeader title={t('lj.ready.title')} subtitle={t('lj.ready.sub')}
        actions={<Select value={r?.id || ''} onChange={e => setParams({ role: e.target.value })} aria-label={t('lj.ready.pickRole')}>
          {data.roles.map(x => <option key={x.id} value={x.id}>{x.title}{x.employer ? ` · ${x.employer}` : ''}</option>)}
        </Select>} />
      {error && <div className="ln-error" role="alert">{error}</div>}
      {r && (
        <>
          <section className="ln-card ln-col" style={{ gap: 8 }}>
            <div className="ln-between ln-wrap" style={{ gap: 8 }}>
              <div className="ln-col" style={{ gap: 2 }}>
                <b>{r.title}{r.employer ? ` · ${r.employer}` : ''}</b>
                <span className="ln-small"><ReadinessWords band={r.band} short={r.short.length} /></span>
                <span className="ln-small" data-ready-summary><b>{r.short.length === 0 ? t('lj.ready.summaryNone') : t(r.short.length === 1 ? 'lj.ready.summaryOne' : 'lj.ready.summaryShort', { n: r.short.length, list: r.short.join(', ') })}</b></span>
              </div>
              <BandPill band={r.band} score={r.readiness} />
            </div>
            <span className="ln-small ln-row" style={{ gap: 6 }}><Clock size={14} aria-hidden="true" />{t('lj.ready.hours', { h: r.hours_to_close })}</span>
            <WhyThis title={t('lj.ready.whyTitle')}>{t('lj.ready.why')}</WhyThis>
            {r.source === 'qubirex' && r.band === 'ready' && <Link className="ln-btn ln-btn-primary" style={{ alignSelf: 'flex-start' }} to={`/learn/apply/${r.id}`}>{t('lj.ready.apply')}</Link>}
          </section>
          <section className="ln-col" style={{ gap: 8 }} aria-labelledby="skills-h">
            <h2 id="skills-h" className="ln-h2">{t('lj.ready.skills')}</h2>
            <div className="ln-card" data-readiness-chart>
              <GroupedBars series={[{ key: 'you', label: t('lj.bars.you') }, { key: 'course', label: t('lj.bars.course') }, { key: 'employers', label: t('lj.bars.employers') }]}
                rows={r.skills.map(s => ({ key: s.key, label: s.name, values: { you: s.you, course: s.course, employers: s.employers } }))}
                axisLabel={t('lj.ready.chartAxis')} ariaLabel={t('lj.ready.chartAria')} />
            </div>
            <h3 className="ln-small ln-muted">{t('lj.ready.actions')}</h3>
            {r.skills.map(s => (
              <div key={s.key} className="ln-card ln-col" style={{ gap: 6 }} data-skill={s.key}>
                <div className="ln-between ln-wrap" style={{ gap: 8 }}>
                  <b>{s.name} {s.required ? '' : <span className="ln-tag ln-tag-neutral">{t('lj.ready.niceToHave')}</span>}</b>
                  {s.verified ? <span className="ln-tag ln-tag-success">{t('lj.ready.proven')}</span> : (
                    <button type="button" className="ln-btn ln-btn-sm" onClick={() => add(s.name)} disabled={inPlan(s.name)}>
                      {inPlan(s.name) ? <><Check size={14} aria-hidden="true" />{t('lj.ready.inPlan')}</> : <><Plus size={14} aria-hidden="true" />{t('lj.ready.addPlan')}</>}
                    </button>
                  )}
                </div>
                {!s.verified && <span className="ln-xs ln-muted">{s.not_in_course ? t('lj.ready.notInCourse', { h: s.hours_to_close }) : t('lj.ready.leftInCourse', { n: s.nodes_left, h: s.hours_to_close })}</span>}
              </div>
            ))}
          </section>
          {r.course_wont_cover.length > 0 && (
            <section className="ln-card ln-col" style={{ gap: 6 }}>
              <b>{t('lj.ready.wontCover')}</b>
              <span className="ln-small">{r.course_wont_cover.join(', ')}</span>
              <span className="ln-xs ln-muted">{t('lj.ready.wontCoverHelp')}</span>
            </section>
          )}
        </>
      )}
      <section className="ln-card ln-col" style={{ gap: 6 }}>
        <b>{t('lj.ready.bestFit')}</b>
        {data.best_fit.map(b => (
          <button key={b.id} type="button" className="ln-link ln-between" onClick={() => setParams({ role: b.id })}>
            <span>{b.title}{b.employer ? ` · ${b.employer}` : ''}</span><span className="ln-small">{b.readiness} · {b.band_label}</span>
          </button>
        ))}
      </section>
      <section className="ln-card ln-col" style={{ gap: 6 }}>
        <b>{t('lj.ready.myPlan')}</b>
        {data.plan.length ? data.plan.map(p => <span key={p.skill_name} className="ln-small">• {p.skill_name}</span>) : <span className="ln-small ln-muted">{t('lj.ready.planEmpty')}</span>}
      </section>
    </>
  );
}
