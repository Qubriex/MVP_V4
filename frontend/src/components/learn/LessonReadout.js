// src/components/learn/LessonReadout.js — one lesson, read-only, all ten parts
// in order: one line, use case, explanation, picture, code with line notes and
// output, mistakes, quick questions, the try-it task, cheat sheet. Used by the
// public free sample ("See our topics") and by faculty reviewing a lesson.
// `parts` is the `parts` object from the lesson API (lessonView).
import React, { useState } from 'react';
import { useUiLang } from '../../context/UiLangContext';
import MermaidDiagram from './MermaidDiagram';

function CodeBlock({ code }) {
  const { t } = useUiLang();
  const notes = new Map((code.notes || []).map(n => [n.line, n.note]));
  return (
    <div className="ln-col" style={{ gap: 8 }}>
      <pre className="lj-code" data-code-panel>
        {code.source.split('\n').map((l, i) => (
          <span key={i} className="lj-code-line" data-line={i + 1}>
            <span className="lj-code-n" aria-hidden="true">{i + 1}</span><code>{l || ' '}</code>
          </span>
        ))}
      </pre>
      <ul className="ln-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {[...notes.entries()].map(([line, note]) => <li key={line}><b>{t('lj.lesson.lineN', { n: line })}</b> {note}</li>)}
      </ul>
      {code.output && <><b className="ln-small">{t('lj.lesson.output')}</b><pre className="lj-output" data-output>{code.output}</pre></>}
    </div>
  );
}

function QuickRead({ items }) {
  const { t } = useUiLang();
  const [picked, setPicked] = useState({});
  return (
    <div className="ln-col" style={{ gap: 10 }}>
      {items.map(q => (
        <div key={q.i} className="ln-col" style={{ gap: 6 }}>
          <pre className="lj-q">{q.q}</pre>
          <div className="ln-row ln-wrap" style={{ gap: 6 }}>
            {q.options.map((o, k) => (
              <button key={k} type="button" className={`ln-btn ln-btn-sm lj-opt ${picked[q.i] === k ? (k === q.answer ? 'is-right' : 'is-wrong') : ''}`} onClick={() => setPicked(p => ({ ...p, [q.i]: k }))}>{o}</button>
            ))}
          </div>
          {picked[q.i] != null && <span className="ln-small" role="status">{picked[q.i] === q.answer ? '✓ ' : '✗ '}{q.why}</span>}
        </div>
      ))}
      {!items.length && <span className="ln-small ln-muted">{t('lj.readout.none')}</span>}
    </div>
  );
}

const Part = ({ title, children, id }) => (
  <section className="ln-card ln-col" style={{ gap: 8 }} data-part={id}>
    <b>{title}</b>
    {children}
  </section>
);

export default function LessonReadout({ parts, solution, checkQuestions }) {
  const { t } = useUiLang();
  if (!parts) return null;
  return (
    <div className="ln-col" style={{ gap: 12 }} data-readout>
      <Part id="oneLine" title={t('lj.lesson.inOneLine')}><p style={{ margin: 0 }}>{parts.oneLine}</p></Part>
      <Part id="useCase" title={t('lj.lesson.useIt')}><p style={{ margin: 0 }}>{parts.useCase}</p></Part>
      <Part id="explain" title={t('lj.lesson.explain')}>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{(parts.explain || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
        {parts.simpler?.length > 0 && <p className="ln-small ln-muted" style={{ margin: 0 }}><b>{t('lj.lesson.simpler')}:</b> {parts.simpler.join(' ')}</p>}
        {parts.anotherExample?.length > 0 && <p className="ln-small ln-muted" style={{ margin: 0 }}><b>{t('lj.lesson.anotherExample')}:</b> {parts.anotherExample.join(' ')}</p>}
      </Part>
      {parts.picture && <Part id="picture" title={t('lj.lesson.picture')}><MermaidDiagram source={parts.picture} /></Part>}
      <Part id="code" title={t('lj.lesson.codeTitle')}><CodeBlock code={parts.code} /></Part>
      <Part id="mistakes" title={t('lj.lesson.mistakes')}>
        {parts.mistakes.map((m, i) => <div key={i} className="ln-col" style={{ gap: 4 }}><pre className="lj-code-small"><code>{m.wrong}</code></pre><span className="ln-small">{m.fix}</span></div>)}
      </Part>
      <Part id="quick" title={t('lj.lesson.quick')}><QuickRead items={parts.quick} /></Part>
      <Part id="task" title={t('lj.lesson.tryIt')}>
        <p style={{ margin: 0 }}>{parts.task.prompt}</p>
        {parts.task.starter && <pre className="lj-code">{parts.task.starter}</pre>}
        <span className="ln-xs ln-muted">{t('lj.lesson.testsInfo', { shown: parts.task.tests.length, hidden: parts.task.hidden_tests })}</span>
        {solution && <details><summary className="ln-small">{t('lj.lesson.solution')}</summary><pre className="lj-code">{solution}</pre></details>}
      </Part>
      <Part id="cheat" title={t('lj.lesson.cheat')}>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{(parts.cheat || []).map((s, i) => <li key={i}><code>{s}</code></li>)}</ul>
      </Part>
      {checkQuestions?.length > 0 && (
        <Part id="check" title={t('lj.lesson.checkTitle')}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{checkQuestions.map((q, i) => <li key={i} className="ln-small">{typeof q === 'string' ? q : (q.en || Object.values(q)[0])}</li>)}</ul>
        </Part>
      )}
    </div>
  );
}
