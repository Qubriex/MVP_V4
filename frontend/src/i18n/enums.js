// src/i18n/enums.js — fixed English values that come from the API (trend,
// growth, suggestion, sector, coverage notes) shown in the reader's language.
// Anything not listed is data (skill, topic and company names) and is shown as is.
const KEYS = {
  'Rising fast': 'enum.risingFast', Rising: 'enum.rising', Steady: 'enum.steady', Falling: 'enum.falling',
  Keep: 'enum.keep', Extend: 'enum.extend', 'Add cluster': 'enum.addGroup',
  'Not in pathway': 'enum.notInPathway', 'Not reached yet': 'enum.notReached', 'In progress': 'enum.inProgress',
  'In your path': 'enum.inPath', 'Partly in your path': 'enum.partlyInPath',
  Software: 'enum.sector.software', 'Data and AI': 'enum.sector.dataAi', 'Cloud and security': 'enum.sector.cloud',
  'Energy and EV': 'enum.sector.energy', 'Business and ops': 'enum.sector.business'
};

export function enumText(t, value) {
  if (value == null) return '';
  if (KEYS[value]) return t(KEYS[value]);
  const avg = /^(\d+)% avg$/.exec(value);
  if (avg) return t('enum.pctAvg', { pct: avg[1] });
  return value;
}
