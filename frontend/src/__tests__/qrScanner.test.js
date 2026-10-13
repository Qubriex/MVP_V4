// Issue #7: the camera is released on Stop camera, on a successful read,
// when the page is left, and when the tab is hidden; errors are explained.
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { UiLangProvider } from '../context/UiLangContext';
import QrScanner from '../components/public/QrScanner';

let track; let detect;
beforeEach(() => {
  localStorage.clear();
  track = { stop: jest.fn(), readyState: 'live' };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue(stream) } });
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue();
  detect = jest.fn().mockResolvedValue([]);
  window.BarcodeDetector = jest.fn().mockImplementation(() => ({ detect }));
  window.requestAnimationFrame = (cb) => setTimeout(cb, 5);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
});

const mount = (onCode = jest.fn()) => render(<UiLangProvider><QrScanner onCode={onCode} /></UiLangProvider>);
const startCamera = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Scan a Passport QR/ }));
  await screen.findByRole('button', { name: /Stop camera/ });
};

test('Stop camera stops every track', async () => {
  mount(); await startCamera();
  fireEvent.click(screen.getByRole('button', { name: /Stop camera/ }));
  expect(track.stop).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Scan a Passport QR/ })).toBeInTheDocument();
});

test('a successful read stops the camera and passes the Evidence ID on', async () => {
  detect.mockResolvedValue([{ rawValue: 'https://qubirex.in/verify/qbx-ab12cd34ef56' }]);
  const onCode = jest.fn();
  mount(onCode); await startCamera();
  await waitFor(() => expect(onCode).toHaveBeenCalledWith('QBX-AB12CD34EF56'));
  expect(track.stop).toHaveBeenCalled();
});

test('leaving the page (unmount) stops the camera', async () => {
  const { unmount } = mount(); await startCamera();
  unmount();
  expect(track.stop).toHaveBeenCalled();
});

test('hiding the tab stops the camera', async () => {
  mount(); await startCamera();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(track.stop).toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

test('permission denied and no camera are explained, with typing offered', async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Scan a Passport QR/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Type the Evidence ID/);
  navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotFoundError' }));
  fireEvent.click(screen.getByRole('button', { name: /Scan a Passport QR/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/No camera was found/);
});
