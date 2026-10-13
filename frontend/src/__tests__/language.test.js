// Issue #9 and #1: the language switch changes the interface text at once,
// is remembered, sets <html lang>, and every string exists in all three languages.
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt, Route } from '../testUtils';
import Home from '../pages/public/Home';
import Pricing from '../pages/public/Pricing';
import en from '../i18n/en.json';
import te from '../i18n/te.json';
import hi from '../i18n/hi.json';

beforeEach(() => { localStorage.clear(); document.documentElement.setAttribute('lang', 'en'); });

test('every English key has a Telugu and a Hindi string, with the same {placeholders}', () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const [k, v] of Object.entries(en)) {
    expect([k, typeof te[k]]).toEqual([k, 'string']);
    expect([k, typeof hi[k]]).toEqual([k, 'string']);
    expect([k, holes(te[k])]).toEqual([k, holes(v)]);
    expect([k, holes(hi[k])]).toEqual([k, holes(v)]);
  }
});

test('clicking తెలుగు and हिंदी changes the page text, html lang and the saved choice', () => {
  renderAt('/', <Route path="/" element={<Home />} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en['home.title']);
  const switchGroup = screen.getAllByRole('group', { name: en['lang.label'] })[0];
  fireEvent.click(switchGroup.querySelector('button[aria-label="తెలుగు"]'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(te['home.title']);
  expect(document.documentElement.getAttribute('lang')).toBe('te');
  expect(localStorage.getItem('qubirex_ui_lang')).toBe('telugu');
  // Navigation, buttons and sign-in follow too.
  expect(screen.getAllByText(te['nav.pricing']).length).toBeGreaterThan(0);
  expect(screen.queryByText(en['nav.pricing'])).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('group', { name: te['lang.label'] })[0].querySelector('button[aria-label="हिंदी"]'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(hi['home.title']);
  expect(document.documentElement.getAttribute('lang')).toBe('hi');
});

test('the saved language is used on the next page', () => {
  localStorage.setItem('qubirex_ui_lang', 'hindi');
  renderAt('/pricing', <Route path="/pricing" element={<Pricing />} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(hi['price.title']);
});
