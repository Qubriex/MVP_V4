// Table: sticky header on desktop; below 640 px each row becomes a card with
// the column names written beside the values. TableLabels (mounted once in the
// app) gives every existing .ln-table the same phone behaviour by copying each
// column's header into its cells' data-label.
import React, { useEffect } from 'react';

import { useUiLang } from '../../../context/UiLangContext';
export function Table({ columns, rows, rowKey, empty, caption, onRowClick }) {
  const { t } = useUiLang();
  return (
    <div className="ln-tablewrap">
      <table className="ln-table ui-table">
        {caption && <caption className="ln-sr">{caption}</caption>}
        <thead><tr>{columns.map(c => <th key={c.key} scope="col" className={c.numeric ? 'ui-num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && empty ? <tr><td colSpan={columns.length}>{empty}</td></tr> : rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} className={onRowClick ? 'ui-row-click' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map(c => <td key={c.key} data-label={typeof c.label === 'string' ? c.label : undefined} className={c.numeric ? 'ui-num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function label(table) {
  const heads = [...table.querySelectorAll(':scope > thead > tr > th')].map(th => th.textContent.trim());
  if (!heads.length) return;
  table.querySelectorAll(':scope > tbody > tr').forEach(tr => {
    let col = 0;
    [...tr.children].forEach(td => {
      if (!td.hasAttribute('data-label') || td.dataset.auto) { td.setAttribute('data-label', heads[col] || ''); td.dataset.auto = '1'; }
      col += td.colSpan || 1;
    });
  });
}

export function TableLabels() {
  useEffect(() => {
    let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => document.querySelectorAll('table.ln-table').forEach(label)); };
    run();
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
