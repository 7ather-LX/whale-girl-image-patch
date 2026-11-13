'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertPublicUrl, isImageMime, sniff } = require('./policy');

const UA = 'whale-image-patch/1.0 (+https://github.com/7ather-LX/whale-girl-image-patch)';

function request(url, { method = 'GET', headers = {}, timeout = 12000, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    if (u.protocol !== 'https:') return reject(new Error('only https is allowed'));
    const req = https.request(u.toString(), {
      method,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json,image/*,*/*;q=0.8',
        ...headers,
      },
      timeout,
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && maxRedirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, u).toString();
        return resolve(request(next, { method, headers, timeout, maxRedirects: maxRedirects - 1 }));
      }
      if (status < 200 || status >= 300) {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => reject(new Error(`HTTP ${status} ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`)));
        return;
      }
      resolve({ res, url: u.toString() });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function getJson(url, opts = {}) {
  let last = null;
  for (let i = 0; i < 2; i++) {
    try {
      await assertPublicUrl(url);
      const { res } = await request(url, opts);
      const chunks = [];
      let total = 0;
      for await (const chunk of res) {
        total += chunk.length;
        if (total > 4 * 1024 * 1024) throw new Error('JSON response too large');
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      try { return JSON.parse(text); } catch { throw new Error('invalid JSON response'); }
    } catch (err) {
      last = err;
      if (i === 0) await new Promise((r) => setTimeout(r, 350));
    }
  }
  throw last;
}

async function downloadImage(url, destDir, { maxBytes = 8 * 1024 * 1024, prefix = 'img', timeout = 12000 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await downloadOnce(url, destDir, { maxBytes, prefix, timeout });
    } catch (err) {
      last = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw last;
}

async function downloadOnce(url, destDir, { maxBytes, prefix, timeout }) {
  await assertPublicUrl(url);
  const { res } = await request(url, { headers: { Accept: 'image/*' }, timeout });
  const type = String(res.headers['content-type'] || '').split(';')[0].trim();
  if (type && !isImageMime(type)) {
    res.resume();
    throw new Error('not an image: ' + type);
  }
  const len = Number(res.headers['content-length'] || 0);
  if (len > maxBytes) {
    res.resume();
    throw new Error('image too large');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of res) {
    total += chunk.length;
    if (total > maxBytes) {
      res.destroy();
      throw new Error('image too large');
    }
    chunks.push(chunk);
  }
  const buf = Buffer.concat(chunks);
  const mime = sniff(buf) || type;
  if (!isImageMime(mime)) throw new Error('invalid image data');
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : mime === 'image/gif' ? '.gif' : '.jpg';
  fs.mkdirSync(destDir, { recursive: true });
  const name = `${prefix}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)}${ext}`;
  const file = path.join(destDir, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return { path: file, bytes: buf.length, mime, name };
}

async function getText(url, opts = {}) {
  const { res } = await request(url, { ...opts, headers: { Accept: 'text/html,*/*;q=0.8', ...(opts.headers || {}) } });
  const chunks = [];
  let total = 0;
  for await (const chunk of res) {
    total += chunk.length;
    if (total > 3 * 1024 * 1024) throw new Error('HTML response too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = { UA, request, getJson, getText, downloadImage };
