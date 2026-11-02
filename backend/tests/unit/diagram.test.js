// AI tutor diagrams: only drawable ones reach the learner.
import { describe, it, expect } from 'vitest';
import { diagramProblem, safeDiagram } from '../../core/util/diagram.js';

describe('a TEACH diagram is checked before it is sent', () => {
  it('keeps diagrams that draw', () => {
    expect(diagramProblem('graph LR\n  A[Start] --> B{Is it > 5?}\n  B -->|yes| C["print(#quot;Big#quot;)"]')).toBeNull();
    expect(diagramProblem('graph TD\n  Parent -->|props: total| SeatCounter\n  SeatCounter -->|setBooked| state[(booked)]')).toBeNull();
    expect(diagramProblem('sequenceDiagram\n  A->>B: hi')).toBeNull();
  });
  it('drops what would show an error graphic', () => {
    expect(diagramProblem('graph LR\n  A["line 1: print(\\"Namaste\\")"] --> B')).toBe('escaped quotes');
    expect(diagramProblem('graph LR\n  A[Start --> B')).toBe('unbalanced brackets or quotes');
    expect(diagramProblem('print("hello")')).toBe('unknown diagram type');
    expect(diagramProblem('```mermaid\ngraph LR\nA-->B\n```')).toBe('unknown diagram type');
    expect(safeDiagram('graph LR\n  A["x\\"y"] --> B', 'test')).toBeNull();
    expect(safeDiagram(null)).toBeNull();
  });
});
