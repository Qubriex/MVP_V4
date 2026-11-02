// A diagram that cannot be drawn shows nothing: no error graphic, no source.
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import MermaidDiagram from '../components/learn/MermaidDiagram';

jest.mock('../utils/api', () => ({ __esModule: true, default: { post: jest.fn(() => Promise.resolve()) } }));
jest.mock('../context/UiLangContext', () => ({ useUiLang: () => ({ t: (k) => k }) }));

const mock = { parse: jest.fn(), render: jest.fn(), initialize: jest.fn() };
jest.mock('mermaid', () => ({ __esModule: true, default: mock }), { virtual: false });

const BROKEN = 'graph LR\n  A["line 1: print(\\"Namaste\\")"] --> B';

beforeEach(() => { document.body.innerHTML = ''; Object.values(mock).forEach(f => f.mockReset()); });

it('a source that does not parse renders nothing and never shows the code', async () => {
  mock.parse.mockResolvedValue(false);
  const { container } = render(<MermaidDiagram source={BROKEN} where="py-m1-l1" />);
  await waitFor(() => expect(container.innerHTML).toBe(''));
  expect(document.body.textContent).not.toMatch(/Namaste|graph LR|Syntax error/);
  expect(mock.render).not.toHaveBeenCalled();
});

it('an error graphic mermaid leaves in the page is removed', async () => {
  mock.parse.mockResolvedValue(true);
  mock.render.mockImplementation(async (id) => {
    const stray = document.createElement('div');
    stray.id = `d${id}`;
    stray.innerHTML = '<svg aria-roledescription="error"><text>Syntax error in text</text><text>mermaid version 11.17.2</text></svg>';
    document.body.appendChild(stray);
    throw new Error('Parse error on line 2');
  });
  const { container } = render(<MermaidDiagram source={BROKEN} where="py-m1-l1" />);
  await waitFor(() => expect(container.innerHTML).toBe(''));
  expect(document.body.querySelector('[aria-roledescription="error"]')).toBeNull();
  expect(document.body.textContent).not.toMatch(/Syntax error|mermaid version/);
});

it('a good diagram is drawn', async () => {
  mock.parse.mockResolvedValue(true);
  mock.render.mockResolvedValue({ svg: '<svg data-ok="1"><text>Start</text></svg>' });
  const { container } = render(<MermaidDiagram source={'graph LR\n A-->B'} />);
  await waitFor(() => expect(container.querySelector('svg[data-ok]')).not.toBeNull());
});
