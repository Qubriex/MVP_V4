// The browser is gentle on the voice quota: at most two requests on their
// way at once, and a busy voice (429) is retried quietly before giving up.
import api from '../utils/api';
import { fetchAudio, _voiceInFlight, MAX_IN_FLIGHT } from '../utils/voice';

jest.mock('../utils/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
// CRA resets mocks before each test, so the stubs are set here.
beforeEach(() => { api.post.mockReset(); global.URL.createObjectURL = jest.fn(() => 'blob:clip'); global.URL.revokeObjectURL = jest.fn(); });

it('never more than two voice requests at once', async () => {
  let open = 0; let most = 0;
  api.post.mockImplementation(() => { open += 1; most = Math.max(most, open); return new Promise(r => setTimeout(() => { open -= 1; r({ data: new Blob(['x']) }); }, 30)); });
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map((x, i) => fetchAudio(`line ${x} ${i}`, 'telugu')));
  expect(MAX_IN_FLIGHT).toBe(2);
  expect(most).toBe(2);
  expect(api.post).toHaveBeenCalledTimes(5);
  expect(_voiceInFlight()).toBe(0);
});

it('a busy voice (429) is retried quietly, and the clip still plays', async () => {
  const busy = Object.assign(new Error('busy'), { response: { status: 429, headers: { 'retry-after': '1' } } });
  api.post.mockRejectedValueOnce(busy).mockResolvedValueOnce({ data: new Blob(['x']) });
  await expect(fetchAudio('a busy line', 'hindi')).resolves.toBe('blob:clip');
  expect(api.post).toHaveBeenCalledTimes(2);
}, 10000);

it('gives up after about six seconds of busy, so the page can show the text', async () => {
  const busy = Object.assign(new Error('busy'), { response: { status: 429, headers: { 'retry-after': '2' } } });
  api.post.mockRejectedValue(busy);
  const t0 = Date.now();
  await expect(fetchAudio('always busy', 'english')).rejects.toBe(busy);
  const ms = Date.now() - t0;
  expect(ms).toBeGreaterThan(3500);
  expect(ms).toBeLessThan(7000);
}, 15000);
