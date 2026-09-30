// Capability Graph (v4.3 §3): resolveSkill, prerequisite DAG, coverage.
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb } from '../helpers/setup.js';
import { resolveSkill, normalise } from '../../core/graph/resolveSkill.js';
import { addPrereq, mapNode } from '../../core/graph/ontology.js';
import { pathwayMap, coverageOf, coverageStatus, mapPathway } from '../../core/graph/coverage.js';

beforeAll(freshDb);

describe('resolveSkill', () => {
  it('normalises: NFKC, lowercase, & → and, punctuation, filler words', () => {
    expect(normalise('Introduction to HTML & CSS!')).toBe('html and css');
    expect(normalise('Fundamentals of Python loops')).toBe('python loops');
    expect(normalise('Node.js basics')).toBe('node js');
  });

  it('resolves an exact alias with confidence 1', () => {
    expect(resolveSkill('Joins in SQL', { queue: false })).toMatchObject({ skill: { skill_id: 'sql_joins' }, conf: 1, via: 'alias' });
  });

  it('resolves by token Jaccard ≥ 0.60', () => {
    const r = resolveSkill('React state management', { queue: false });
    expect(r).toMatchObject({ skill: { skill_id: 'react_state_props' }, via: 'token' });
    expect(r.conf).toBeGreaterThanOrEqual(0.6);
  });

  it('never defaults silently: unmapped text goes to the review queue, once, counting repeats', () => {
    expect(resolveSkill('Kubernetes operators', { source: 'jd' })).toEqual({ skill: null, conf: 0, via: 'unmapped' });
    resolveSkill('kubernetes  OPERATORS', { source: 'jd' });
    expect(dal.one("SELECT occurrences, status FROM ontology_review_queue WHERE text_norm = 'kubernetes operators'")).toEqual({ occurrences: 2, status: 'pending' });
  });
});

describe('prerequisite DAG', () => {
  it('rejects an edge that would close a cycle', () => {
    // seed: sql_joins requires sql_select
    expect(() => addPrereq('sql_select', 'sql_joins')).toThrow(/cycle/);
    expect(() => addPrereq('sql_joins', 'sql_joins')).toThrow(/cycle/);
  });
});

describe('coverage', () => {
  it('sums node weights, adds child coverage, and bands at 0.8 / 0.3', () => {
    dal.run("INSERT INTO institutions (id, name, type, contact_email, password_hash) VALUES ('gi', 'I', 'other', 'g@i.t', 'x')");
    dal.run("INSERT INTO capability_targets (id, institution_id, version, title, path) VALUES ('gct', 'gi', '1', 'T', 'A')");
    dal.run("INSERT INTO skill_clusters (id, capability_target_id, cluster_label) VALUES ('gc', 'gct', 'Data')");
    [['n1', 'SQL queries'], ['n2', 'Joins'], ['n3', 'SQL joins practice'], ['n4', 'Quantum widgets']].forEach(([id, label], i) =>
      dal.run('INSERT INTO skill_nodes (id, cluster_id, node_label, sequence_order) VALUES (?, ?, ?, ?)', id, 'gc', label, i));
    const r = mapPathway('gct');
    expect(r.unmapped).toEqual(['Quantum widgets']);
    const map = pathwayMap('gct');
    // two nodes map to sql_joins → 0.5 each; sql_joins fully covered
    expect(map.bySkill.get('sql_joins').map(x => x.weight)).toEqual([0.5, 0.5]);
    expect(coverageOf('sql_joins', map)).toBe(1);
    // sql has 6 children; select + joins covered → 2/6
    expect(coverageOf('sql', map)).toBeCloseTo(2 / 6);
    expect(coverageStatus(coverageOf('sql', map))).toBe('partly');
    expect(coverageStatus(coverageOf('python', map))).toBe('missing');
    mapNode('n4', 'sql', { source: 'review' });
    expect(coverageStatus(coverageOf('sql', pathwayMap('gct')))).toBe('covered');
  });
});
