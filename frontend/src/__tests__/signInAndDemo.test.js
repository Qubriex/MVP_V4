// Issue #11: Sign in asks who you are first (header menu only). /demo is the
// working demo: pick a sample person and Start (no screen-only demo pages).
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt, Route } from '../testUtils';
import Home from '../pages/public/Home';
import Demo from '../pages/public/Demo';
import api from '../utils/api';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('Sign in opens a choice of Learner, College staff and Employer', () => {
  renderAt('/', <Route path="/" element={<Home />} />);
  const button = screen.getByRole('button', { name: /Sign in/ });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  const items = screen.getAllByRole('menuitem');
  expect(items.map(a => [a.textContent, a.getAttribute('href')])).toEqual([
    ['Learner', '/learner-login'], ['College staff', '/login'], ['Employer', '/employer/login']
  ]);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('sign-in choices live only in the header menu, not repeated on the home page (team point 5)', () => {
  renderAt('/', <Route path="/" element={<Home />} />);
  expect(screen.queryByRole('heading', { level: 2, name: 'Sign in' })).not.toBeInTheDocument();
  const main = document.querySelector('main');
  expect(main.querySelector('a[href="/learner-login"], a[href="/login"], a[href="/employer/login"]')).toBeNull();
});

test('/demo offers six sample people, each with Start, says what is real, and has Back to home', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: { enabled: true, ai_mode: 'live' } });
  renderAt('/demo', <Route path="/demo" element={<Demo />} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Try Qubirex as…' })).toBeInTheDocument();
  const starts = await screen.findAllByRole('button', { name: /Start/ });
  expect(starts).toHaveLength(6);
  await waitFor(() => starts.forEach(b => expect(b).toBeEnabled()));
  expect(screen.queryByRole('button', { name: /View/ })).not.toBeInTheDocument();
  expect(screen.getByText('What’s real and what’s not')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', '/');
});

test('Start builds a sandbox, signs in as that person and opens their home', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: { enabled: true, ai_mode: 'live' } });
  const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { token: 'x.eyJkZW1vIjp0cnVlfQ.y', role: 'employer', user: { email: 'r@demo' }, home: '/employer/home', persona: 'recruiter', ends_at: new Date(Date.now() + 7200000).toISOString() } });
  renderAt('/demo', [<Route key="d" path="/demo" element={<Demo />} />, <Route key="h" path="/employer/home" element={<div data-testid="landed" />} />]);
  const card = (await screen.findByText('Meera Iyer')).closest('article');
  await waitFor(() => expect(card.querySelector('button')).toBeEnabled());
  fireEvent.click(card.querySelector('button'));
  expect(await screen.findByTestId('landed')).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith('/demo/start', { persona: 'recruiter' });
  expect(JSON.parse(localStorage.getItem('qubirex_demo')).persona).toBe('recruiter');
});

test('the old screen-only demo pages are gone from the demo page', () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: { enabled: false } });
  renderAt('/demo', <Route path="/demo" element={<Demo />} />);
  expect(screen.queryByText('Demo mode · sample data · nothing is saved')).not.toBeInTheDocument();
});
