// core/graph/theta.js — θ resolution (v4.3 §4.3):
//   θ = max(node θ ?? 0.70, cluster θ ?? 0.70, platform floor 0.60)
// A curriculum rule, kept outside core/evidence so the passport and the
// public verifier (which may not reach evidence modules) can use it.
import params from '../../config/params.js';

export function resolveTheta(nodeThreshold, clusterThreshold) {
  const d = params.get('evidence.fusion.defaultTheta');
  return Math.max(nodeThreshold ?? d, clusterThreshold ?? d, params.get('evidence.fusion.minTheta'));
}
