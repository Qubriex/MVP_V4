// The working demo's bar (components/DemoBar.js) and the DEMO banner on Verify.
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt, Route } from '../testUtils';
import DemoBar from '../components/DemoBar';
import Verify from '../pages/Verify';
import api from '../utils/api';

const ME = {
  persona: 'recruiter', ends_at: new Date(Date.now() + 90 * 60000).toISOString(), story: ['jd', 'search'], inbox_count: 2,
  ai: { mode: 'live' }, sample_jd: 'Frontend developer…', sample_role_id: 'dmx-e1-r1'
};
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('the demo bar shows sample data, the time left, switch, story, inbox, reset and exit', async () => {
  localStorage.setItem('qubirex_demo', JSON.stringify({ persona: 'recruiter' }));
  jest.spyOn(api, 'get').mockImplementation(url => Promise.resolve({ data: url === '/demo/inbox'
    ? { messages: [{ id: 'm1', channel: 'whatsapp', recipient: 'Lakshmi Prasanna', subject: 'Sample Tech invited you to a Day-One practice run', body: '', created_at: new Date().toISOString() }] }
    : ME }));
  renderAt('/employer/home', <Route path="/employer/home" element={<DemoBar />} />);
  expect(await screen.findByText('Demo · sample data')).toBeInTheDocument();
  expect(screen.getByText(/resets in 1h (29|30)m/)).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Switch to…' })).toHaveValue('recruiter');
  expect(screen.getByRole('button', { name: /Reset my demo/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Exit demo/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Guided story 2\/8/ }));
  expect(screen.getAllByRole('button', { name: /Show me/ })).toHaveLength(8);
  expect(screen.getAllByText('Done')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: /Demo inbox \(2\)/ }));
  expect(await screen.findByText('Sample Tech invited you to a Day-One practice run')).toBeInTheDocument();
  expect(screen.getByText(/WhatsApp to Lakshmi Prasanna/)).toBeInTheDocument();
});

test('no demo marker, no bar', () => {
  const get = jest.spyOn(api, 'get');
  renderAt('/', <Route path="/" element={<DemoBar />} />);
  expect(screen.queryByText('Demo · sample data')).not.toBeInTheDocument();
  expect(get).not.toHaveBeenCalled();
});

test('Verify shows “DEMO — not a real credential” for a demo Passport', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: { status: 'valid', demo: true, evidence_id: 'QBX-ABCD2345EFGH', valid_until: '2028-01-01T00:00:00Z', valid_from: '2026-10-01T00:00:00Z', issuer: 'did:web:x:demo', target: { title: 'Full-Stack Developer Programme', commissionedBy: 'Sample Engineering College (demo)' }, skills_public: false, skills: [] } });
  renderAt('/verify/QBX-ABCD2345EFGH', <Route path="/verify/:id" element={<Verify />} />);
  await waitFor(() => expect(screen.getByText('DEMO — not a real credential')).toBeInTheDocument());
});
