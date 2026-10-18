// src/utils/shareCard.js — draws a 1200×630 share card for a Capability
// Passport on a canvas and downloads it as a PNG. It shows only what the
// public check already shows to anyone with the Evidence ID: the ID, counts
// and the names of Confirmed skills — never scores, loops or session text.
export async function downloadShareCard({ title, name, evidenceId, confirmedLabel, partialLabel, confirmed, partial, skills, verifyLine, tagline }) {
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  const W = 1200; const H = 630;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const body = '"Anek Latin", "Anek Telugu", "Anek Devanagari", "Hind", sans-serif';
  const head = '"Outfit", "Anek Telugu", "Anek Devanagari", sans-serif';
  g.fillStyle = '#17222B'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#F89833'; g.fillRect(0, 0, 14, H);
  g.fillStyle = '#F89833'; g.font = `600 30px ${head}`; g.fillText(title, 72, 92);
  g.fillStyle = '#FFFFFF'; g.font = `700 64px ${head}`; g.fillText(name || '', 72, 176, W - 144);
  g.font = `600 34px "JetBrains Mono", monospace`; g.fillStyle = '#C9D3DA'; g.fillText(evidenceId, 72, 236);
  // Counts.
  const pill = (x, label, n, color) => {
    g.font = `700 52px ${head}`; g.fillStyle = color; g.fillText(String(n), x, 330);
    g.font = `500 26px ${body}`; g.fillStyle = '#C9D3DA'; g.fillText(label, x, 368);
  };
  pill(72, confirmedLabel, confirmed, '#7CC99A');
  pill(372, partialLabel, partial, '#8FBBE0');
  // Up to six Confirmed skills.
  g.font = `500 28px ${body}`; g.fillStyle = '#FFFFFF';
  skills.slice(0, 6).forEach((s, i) => { g.fillText(`✓ ${s}`, 72 + (i % 2) * 540, 438 + Math.floor(i / 2) * 44, 500); });
  g.font = `500 24px ${body}`; g.fillStyle = '#A9B4BD'; g.fillText(verifyLine, 72, 590, W - 144);
  g.textAlign = 'right'; g.fillStyle = '#F89833'; g.font = `600 24px ${head}`; g.fillText(tagline, W - 60, 92);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `capability-passport-${evidenceId}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
