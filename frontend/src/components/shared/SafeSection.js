// src/components/shared/SafeSection.js — an error boundary for one part of a
// page (a lesson part, a chart, the code runner, the voice panel, a diagram,
// or a whole page under a layout). If that part breaks, only it is replaced by
// one friendly line with Try again; the rest of the page keeps working. No
// stack trace, no library error text ever reaches the screen. The failure is
// logged for admins (POST /api/ui-errors).
import React from 'react';
import api from '../../utils/api';
import { useUiLang } from '../../context/UiLangContext';

function Fallback({ onRetry, quiet }) {
  const { t } = useUiLang();
  if (quiet) return null;
  return (
    <div className="ln-note ln-row ln-wrap" role="status" style={{ gap: 8 }} data-section-failed>
      <span className="ln-small">{t('ui.section.failed')}</span>
      <button type="button" className="ln-btn ln-btn-sm" onClick={onRetry}>{t('ui.section.retry')}</button>
    </div>
  );
}

export default class SafeSection extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, attempt: 0 }; }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    const where = this.props.name || 'section';
    if (process.env.NODE_ENV !== 'production') { console.warn('section failed', where, error); return; } // eslint-disable-line no-console
    api.post('/ui-errors', { kind: 'section', where: `${where} ${window.location?.pathname || ''}`, message: String(error?.message || error).slice(0, 200) }).catch(() => {});
  }

  componentDidUpdate(prev) {
    // A new page (or new content) gets a fresh start.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); // eslint-disable-line react/no-did-update-set-state
  }

  render() {
    if (this.state.failed) return <Fallback quiet={this.props.quiet} onRetry={() => this.setState(s => ({ failed: false, attempt: s.attempt + 1 }))} />;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
