// Frame capture through Chrome's screencast (sharper than Playwright's own
// video, which is about 1 Mbit/s VP8). Frames are saved as JPEGs with their
// timestamps and turned into a constant 30 fps clip by ffmpeg afterwards.
// The capture can move to another tab (a link that opens a new tab).
import fs from 'fs';
import path from 'path';

export class Capture {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
    this.frames = []; // { file, t } (t: ms since epoch)
    this.cdp = null;
    this.size = null;
  }

  async attach(page) {
    await this.detach();
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', (f) => {
      const n = this.frames.length + 1;
      const file = `f${String(n).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(this.dir, 'frames', file), Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp * 1000 });
      if (!this.size) this.size = { width: f.metadata.deviceWidth, height: f.metadata.deviceHeight };
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    const vp = page.viewportSize();
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
    this.cdp = cdp;
    this.page = page;
  }

  async detach() {
    if (!this.cdp) return;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.cdp.detach().catch(() => {});
    this.cdp = null;
  }

  /** Writes frames.txt (ffmpeg concat list) for [from, to] ms; returns the clip length in seconds. */
  writeList(from, to) {
    const keep = this.frames.filter(f => f.t <= to);
    // The frame on screen at `from` is the last one before it.
    let start = 0;
    for (let i = 0; i < keep.length; i += 1) if (keep[i].t <= from) start = i;
    const list = keep.slice(start);
    const lines = [];
    for (let i = 0; i < list.length; i += 1) {
      const a = Math.max(list[i].t, from);
      const b = i + 1 < list.length ? list[i + 1].t : to;
      const d = Math.max(0.001, (b - a) / 1000);
      lines.push(`file 'frames/${list[i].file}'`, `duration ${d.toFixed(4)}`);
    }
    if (list.length) lines.push(`file 'frames/${list[list.length - 1].file}'`);
    fs.writeFileSync(path.join(this.dir, 'frames.txt'), `${lines.join('\n')}\n`);
    return (to - from) / 1000;
  }
}
