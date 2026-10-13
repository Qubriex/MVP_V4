// Issue #11: Sign in asks who you are first. Issue #4: demo pages have the
// demo banner with Exit demo and a Back to home link.
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt, Route } from '../testUtils';
import Home from '../pages/public/Home';
import Demo, { DemoSide } from '../pages/public/Demo';

beforeEach(() => localStorage.clear());

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

test('the home page also offers the three sign-in options', () => {
  renderAt('/', <Route path="/" element={<Home />} />);
  const section = screen.getByRole('heading', { level: 2, name: 'Sign in' }).closest('section');
  expect([...section.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/learner-login', '/login', '/employer/login']);
});

test.each(['/demo', '/demo/learner', '/demo/college', '/demo/employer'])('%s has the demo banner, Exit demo and Back to home', (path) => {
  renderAt(path, [<Route key="a" path="/demo" element={<Demo />} />, <Route key="b" path="/demo/:side" element={<DemoSide />} />]);
  expect(screen.getByText('Demo mode · sample data · nothing is saved')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', '/');
  fireEvent.click(screen.getByRole('button', { name: /Exit demo/ }));
  expect(screen.getByTestId('landed')).toBeInTheDocument();
});

test('Start a bridge programme opens the form and adds a demo-only item', () => {
  renderAt('/demo/college', <Route path="/demo/:side" element={<DemoSide />} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start a bridge programme' }));
  expect(screen.getByLabelText('Skill to strengthen')).toBeInTheDocument();
  expect(screen.getByLabelText('Due date')).toBeInTheDocument();
  expect(screen.getByLabelText('Re-test the skill on the due date')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Create programme' }));
  expect(screen.getAllByText(/Demo only, nothing is saved/).length).toBeGreaterThan(0);
  expect(screen.queryByText('None yet. Start one above.')).not.toBeInTheDocument();
});
