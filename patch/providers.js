'use strict';

const { getJson } = require('./http');

const OPENVERSE = 'https://api.openverse.org/v1/images/';
const WIKIMEDIA = 'https://commons.wikimedia.org/w/api.php';
const SAFEBOORU = 'https://safebooru.org/index.php';

const LICENSE_LABEL = {
  cc0: 'CC0',
  pdm: 'Public Domain',
  by: 'CC BY',
  'by-sa': 'CC BY-SA',
  'by-nc': 'CC BY-NC',
  'by-nd': 'CC BY-ND',
  'by-nc-sa': 'CC BY-NC-SA',
  'by-nc-nd': 'CC BY-NC-ND',
  'pdm-mark': 'Public Domain',
};

function text(v, max = 200) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function isHttpImage(url) {
  return /^https:\/\//i.test(String(url || '')) && /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(String(url));
}

async function openverse(query, { timeout = 12000, limit = 12 } = {}) {
  const q = new URLSearchParams({
    q: query,
    page_size: String(limit),
    license: 'cc0,pdm,by,by-sa',
    mature: 'false',
  });
  const data = await getJson(OPENVERSE + '?' + q.toString(), { timeout });
  const out = [];
  for (const x of data.results || []) {
    if (!x || !isHttpImage(x.url)) continue;
    out.push({
      url: x.url,
      thumb: x.thumbnail || '',
      title: text(x.title || 'Openverse image'),
      creator: text(x.creator || ''),
      license: LICENSE_LABEL[x.license] || text(x.license || 'CC'),
      source: 'Openverse / ' + text(x.source || 'open'),
      page: x.foreign_landing_url || x.url,
      provider: 'openverse',
    });
  }
  return out;
}

function stripHtml(s) {
  return text(String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' '));
}

async function wikimedia(query, { timeout = 12000, limit = 12 } = {}) {
  const q = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    format: 'json',
    formatversion: '2',
  });
  const data = await getJson(WIKIMEDIA + '?' + q.toString(), { timeout });
  const out = [];
  for (const page of (data.query && data.query.pages) || []) {
    const info = (page.imageinfo || [])[0] || {};
    if (!info.url || !/^image\/(jpeg|png|webp|gif)/i.test(info.mime || '')) continue;
    const meta = info.extmetadata || {};
    const lic = stripHtml(meta.LicenseShortName && meta.LicenseShortName.value);
    out.push({
      url: info.url,
      title: text(page.title || 'Wikimedia image'),
      creator: stripHtml(meta.Artist && meta.Artist.value),
      license: lic || 'Wikimedia Commons',
      source: 'Wikimedia Commons',
      page: info.descriptionurl || info.url,
      provider: 'wikimedia',
    });
  }
  return out;
}

async function safebooru(query, { timeout = 12000, limit = 20 } = {}) {
  const tags = `rating:safe ${query} -swimsuit -bikini -lingerie -underwear -cleavage -panties -nude -topless -loli -child -shota`;
  const q = new URLSearchParams({
    page: 'dapi', s: 'post', q: 'index', json: '1', limit: String(limit), tags,
  });
  const data = await getJson(SAFEBOORU + '?' + q.toString(), { timeout });
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.post) ? data.post : []);
  const out = [];
  for (const x of rows) {
    const url = x.file_url || x.sample_url;
    if (!isHttpImage(url)) continue;
    if (Number(x.width) < 500 || Number(x.height) < 500) continue;
    out.push({
      url,
      title: text((x.tags || '').split(' ').slice(0, 8).join(' ') || 'Safebooru image'),
      creator: '',
      license: '版权归原作者（仅个人聊天使用）',
      source: 'Safebooru',
      page: x.source || `https://safebooru.org/index.php?page=post&s=view&id=${x.id}`,
      provider: 'safebooru',
    });
  }
  return out;
}

async function search(subject, opts = {}) {
  const provider = subject.provider || 'openverse';
  const query = subject.query || subject.name;
  const primary = provider === 'safebooru' ? safebooru : provider === 'wikimedia' ? wikimedia : openverse;
  const fallback = provider === 'openverse' ? wikimedia : openverse;
  let firstError = null;
  try {
    const list = await primary(query, opts);
    if (list.length) return list;
  } catch (err) {
    firstError = err;
  }
  // Openverse 的图床/接口在部分网络下会 502；换一个同样正规的自由版权源。
  try {
    const list = await fallback(query, opts);
    if (list.length) return list;
  } catch (err) {
    if (!firstError) firstError = err;
  }
  if (firstError) throw firstError;
  return [];
}

module.exports = { search, openverse, wikimedia, safebooru, LICENSE_LABEL };
