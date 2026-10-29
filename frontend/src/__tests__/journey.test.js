// The learner journey pieces every screen shares: the result card (what was
// good / missing / next time and the label change), "How to reach Confirmed",
// readiness in words, pipeline stages in words, and no test-tutor text.
import React from 'react';
import { screen } from '@testing-library/react';
import { renderAt, Route } from '../testUtils';
import { ResultCard, ConfirmedSteps, ReadinessWords, StatusWord, cleanAiText } from '../components/learn/journey';
import { StageTag } from '../components/inst/Journey';
import en from '../i18n/en.json';

beforeEach(() => { localStorage.clear(); localStorage.setItem('qubirex_ui_lang', 'english'); });
const show = (el) => renderAt('/', <Route path="/" element={el} />);

test('the result card shows the three feedback lines and the label change', () => {
  show(<ResultCard result="fail" feedback={{ good: 'You named map.', missing: 'filter keeps only some items.', next: 'Try one example.' }} labelChange={{ from: 'none', to: 'Partial', missing_for_confirmed: ['second_kind'] }} />);
  const card = screen.getByRole('status');
  expect(card).toHaveAttribute('data-result', 'fail');
  expect(card).toHaveTextContent('You named map.');
  expect(card).toHaveTextContent('filter keeps only some items.');
  expect(card).toHaveTextContent('Try one example.');
  expect(card).toHaveTextContent(en['lj.confirmed.howTo']);
  expect(card).toHaveTextContent(en['learn.evidenceText.missing.secondKind']);
});

test('How to reach Confirmed links the second kind of evidence to the work task', () => {
  show(<ConfirmedSteps missing={['second_kind', 'time_span']} nodeId="n1" />);
  expect(screen.getByRole('link', { name: en['lj.confirmed.openTask'] })).toHaveAttribute('href', '/learn/skill/n1?tab=apply');
});

test('readiness and pipeline stages are words, never codes', () => {
  show(<><ReadinessWords band="building" short={4} /><StatusWord stage="access_granted" /><StageTag stage="S4" /></>);
  expect(screen.getByText(`${en['lj.band.building']} · ${en['lj.band.needs'].replace('{n}', '4')}`)).toBeInTheDocument();
  expect(screen.getByText(en['lj.status.accessGranted'])).toBeInTheDocument();
  expect(screen.queryByText(/access_granted/)).toBeNull();
  expect(screen.getByText(en['devx.stage.S4'])).toBeInTheDocument();
});

test('the test tutor\'s placeholder text never reaches the learner', () => {
  const t = (k) => en[k];
  expect(cleanAiText('mock: TEACH.instruction', t)).toBe(en['lj.testMode']);
  expect(cleanAiText('A real sentence.', t)).toBe('A real sentence.');
});
