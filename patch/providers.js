'use strict';

const { getJson, getText } = require('./http');

const OPENVERSE = 'https://api.openverse.org/v1/images/';
const WIKIMEDIA = 'https://commons.wikimedia.org/w/api.php';
const SAFEBOORU = 'https://safebooru.org/index.php';
const BILIBILI_SEARCH = 'https://search.bilibili.com/all';

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

async function openverse(query, { timeout = 12000, limit = 12, page = 1 } = {}) {
  const q = new URLSearchParams({
    q: query,
    page: String(page),
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
      thumb: '',
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

async function safebooruTag(name, { timeout = 10000 } = {}) {
  const q = new URLSearchParams({ page: 'dapi', s: 'tag', q: 'index', json: '1', limit: '20', name: String(name || '') });
  const xml = await getText(SAFEBOORU + '?' + q.toString(), { timeout });
  const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<tag\\b[^>]*\\bname="${escaped}"`, 'i').test(xml);
}

async function safebooru(query, { timeout = 12000, limit = 20, page = 1, minWidth = 500, minHeight = 500, minScore = 0 } = {}) {
  const tags = `rating:safe ${query} -swimsuit -bikini -lingerie -underwear -cleavage -panties -nude -topless -loli -child -shota -spread_legs -sex -cum -ass -shoes -sneakers -boots`;
  const q = new URLSearchParams({
    page: 'dapi', s: 'post', q: 'index', json: '1', limit: String(limit), pid: String(Math.max(1, page) - 1), tags,
  });
  const data = await getJson(SAFEBOORU + '?' + q.toString(), { timeout });
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.post) ? data.post : []);
  const BAD_TAG = /(?:^|\s)(swimsuit|bikini|lingerie|underwear|cleavage|sideboob|large_breasts|huge_breasts|nude|topless|ass|spread_legs|sex|cum|panties|bodystocking|bodysuit)(?:\s|$)/;
  const out = [];
  for (const x of rows) {
    const url = x.file_url || x.sample_url;
    if (!isHttpImage(url)) continue;
    if (Number(x.width) < Number(minWidth) || Number(x.height) < Number(minHeight)) continue;
    if (Number(x.score || 0) < Number(minScore || 0)) continue;
    const tags = String(x.tags || '');
    if (BAD_TAG.test(tags)) continue;
    out.push({
      url,
      title: text(tags.split(' ').slice(0, 8).join(' ') || 'Safebooru image'),
      creator: '',
      license: '版权归原作者（仅个人聊天使用）',
      source: 'Safebooru',
      page: x.source || `https://safebooru.org/index.php?page=post&s=view&id=${x.id}`,
      provider: 'safebooru',
      score: Number(x.score || 0),
      width: Number(x.width || 0),
      height: Number(x.height || 0),
    });
  }
  // 画质优先：分数高的先试，同分则面积大的先试。
  out.sort((a, b) => (b.score - a.score) || (b.width * b.height - a.width * a.height));
  return out;
}

async function bilibili(query, { timeout = 12000, limit = 12, page = 1 } = {}) {
  const q = new URLSearchParams({ keyword: query, page: String(page) });
  const html = await getText(BILIBILI_SEARCH + '?' + q.toString(), {
    timeout,
    headers: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });
  const out = [];
  const seen = new Set();
  const re = /\/\/i(\d)\.hdslb\.com\/bfs\/archive\/([a-f0-9]+)\.(?:jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const hash = m[2];
    if (seen.has(hash)) continue;
    seen.add(hash);
    // 取原图 .jpg，而不是 @672w...webp：微信语音/表情通道对 webp 支持不稳定，
    // 过去会变成“文件”而不是图片。
    const url = `https://i${m[1]}.hdslb.com/bfs/archive/${hash}.jpg`;
    out.push({
      url,
      thumb: '',
      title: text(query + ' · B站视频封面'),
      creator: '',
      license: '版权归原作者（仅个人聊天使用）',
      source: 'Bilibili / 视频封面',
      page: BILIBILI_SEARCH + '?' + q.toString(),
      provider: 'bilibili',
    });
  }
  return out;
}


async function search(subject, opts = {}) {
  const provider = subject.provider || 'openverse';
  const query = subject.query || subject.name;
  const page = Math.max(1, Number(opts.page) || 1);
  const primary = provider === 'safebooru' ? safebooru
    : provider === 'wikimedia' ? wikimedia
      : provider === 'bilibili' ? bilibili
        : openverse;
  let firstError = null;
  try {
    const list = await primary(query, { ...opts, page });
    if (list.length) return list;
  } catch (err) {
    firstError = err;
  }
  // 主图库 502/被墙时换 B站封面，再换自由版权图库。
  const fallbacks = provider === 'bilibili'
    ? [openverse, wikimedia]
    : [bilibili, provider === 'openverse' ? wikimedia : openverse];
  for (const fallback of fallbacks) {
    try {
      const list = await fallback(query, { ...opts, page });
      if (list.length) return list;
    } catch (err) {
      if (!firstError) firstError = err;
    }
  }
  if (firstError) throw firstError;
  return [];
}

module.exports = { search, openverse, wikimedia, safebooru, safebooruTag, bilibili, LICENSE_LABEL };
