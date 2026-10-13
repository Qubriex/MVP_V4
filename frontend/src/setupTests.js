// Jest setup for React Testing Library (npm test).
import '@testing-library/jest-dom';

// jsdom has no media playback; the app's audio unlock calls play() on a tap.
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
