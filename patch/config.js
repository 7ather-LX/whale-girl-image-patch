'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const version = require('./version');

const FILE = 'whale-image-patch.json';

const PROVIDERS = {
  openverse: {
    label: 'Openverse（CC 授权）',
    desc: '开放版权图片聚合，默认过滤成人内容，保留作者/许可证信息。',
  },
  safebooru: {
    label: 'Safebooru（安全动漫图库）',
    desc: '只请求 rating:safe，排除泳装/内衣/裸露等标签；图片版权归原作者，仅个人聊天使用。',
  },
  wikimedia: {
    label: 'Wikimedia Commons（自由版权）',
    desc: '维基共享资源，适合风景、动物、建筑等；保留作者/许可证信息。',
  },
  bilibili: {
    label: 'Bilibili 视频封面',
    desc: '从 B 站搜索结果里取视频封面（图片版权归原作者，仅个人聊天使用）。',
  },
};

const DEFAULT_SUBJECTS = [
  {
    id: 'landscape', name: '风景', aliases: ['风景', '景色', '山水', '大自然', '风光'],
    provider: 'openverse', query: 'landscape nature', enabled: true,
  },
  {
    id: 'anime', name: '动漫少女', aliases: ['动漫少女', '二次元', '动漫', '漫画少女', '少女'],
    provider: 'safebooru', query: '1girl solo', enabled: true,
  },
  {
    id: 'shoes', name: '腿足 / 鞋袜', aliases: ['脚', '足部', '腿', '腿足', '鞋', '鞋子', '鞋袜', '袜子'],
    provider: 'safebooru', query: '1girl legs feet thighhighs', enabled: true,
  },
  {
    id: 'cats', name: '猫', aliases: ['猫', '猫咪', '小猫', '猫猫'],
    provider: 'openverse', query: 'cat kitten', enabled: true,
  },
  {
    id: 'food', name: '美食', aliases: ['美食', '吃的', '食物', '好吃的'],
    provider: 'openverse', query: 'food dish', enabled: true,
  },
  {
    id: 'space', name: '星空', aliases: ['星空', '宇宙', '太空', '银河'],
    provider: 'openverse', query: 'space stars galaxy', enabled: true,
  },
  {
    id: 'bili', name: 'B站图片', aliases: ['B站', 'B站图片', '哔哩哔哩', '壁纸'],
    provider: 'bilibili', query: '动漫 壁纸', enabled: true,
  },
];

/** 命中这些词的请求直接拒绝（不搜索、不发送）。 */
const BLOCKED_TERMS = [
  '裸', '色情', '成人', '黄图', '涩图', '做爱', '性交', '生殖器', '阴部', '胸部',
  '萝莉', '幼女', '儿童', '未成年', '正太', '偷拍', '迷奸', '强奸', '约炮',
  '恋足', '足交', '丝袜', '内裤', '内衣', '比基尼', '泳衣', '挤奶', '兽交',
];

function defaults() {
  return {
    version: 1,
    enabled: true,
    replyText: true,
    cooldownSec: 15,
    maxPerHour: 30,
    noRepeatMinutes: 1440,
    scope: {
      groups: true,
      privates: false,
      overrides: {},
    },
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s, aliases: s.aliases.slice() })),
    providers: Object.keys(PROVIDERS),
    theme: 'auto',
  };
}

function fileFor(root) {
  return path.join(path.resolve(root || process.cwd()), 'data', FILE);
}

function bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  return /^(1|true|on|yes|开|是)$/i.test(String(v).trim());
}

function clamp(n, min, max, dflt) {
  const x = Number(n);
  if (!Number.isFinite(x)) return dflt;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function cleanText(v, max = 120) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function normalizeSubject(raw, index) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const name = cleanText(s.name || s.id || '未命名', 24);
  let id = cleanText(s.id || name, 32).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) id = 's' + (index + 1);
  const aliases = Array.isArray(s.aliases)
    ? s.aliases.map((x) => cleanText(x, 24)).filter(Boolean).slice(0, 20)
    : String(s.aliases || '').split(/[,，、\s]+/).map((x) => cleanText(x, 24)).filter(Boolean).slice(0, 20);
  if (name && !aliases.includes(name)) aliases.unshift(name);
  return {
    id,
    name,
    aliases,
    provider: PROVIDERS[s.provider] ? s.provider : 'openverse',
    query: cleanText(s.query || name, 400),
    enabled: bool(s.enabled, true),
  };
}

function normalize(raw) {
  const d = defaults();
  const src = raw && typeof raw === 'object' ? raw : {};  const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
  const subjects = Array.isArray(src.subjects) && src.subjects.length
    ? src.subjects.map(normalizeSubject)
    : d.subjects;
  // v1.0.0 的旧默认值：Openverse 的「鞋袜」会搜到运动鞋，和实际想要的腿足不符。
  // 只迁移完全等于旧默认值的那一条，用户自己改过的分类不动。
  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    if (s.id === 'shoes' && s.provider === 'openverse' && /shoes footwear socks/i.test(s.query || '')) {
      const fresh = d.subjects.find((x) => x.id === 'shoes');
      if (fresh) subjects[i] = { ...fresh, aliases: fresh.aliases.slice() };
    } else if (s.id === 'shoes' && s.provider === 'safebooru'
      && [
        '1girl legs feet thighhighs -shoes -sneakers -boots',
        '1girl legs feet thighhighs -swimsuit -bikini -lingerie -underwear -cleavage -panties -nude -topless -loli -child -shota',
      ].includes(String(s.query || ''))) {
      const fresh = d.subjects.find((x) => x.id === 'shoes');
      if (fresh) subjects[i] = { ...fresh, aliases: fresh.aliases.slice() };
    } else if (s.id === 'shoes' && s.provider === 'safebooru'
      && /^1girl legs feet thighhighs -swimsuit -bikini/i.test(String(s.query || ''))) {
      const fresh = d.subjects.find((x) => x.id === 'shoes');
      if (fresh) subjects[i] = { ...fresh, aliases: fresh.aliases.slice() };
    }
  }
  if ((Number(src.version) || 1) < 2 && !subjects.some((s) => s.id === 'bili')) {
    const bili = d.subjects.find((s) => s.id === 'bili');
    if (bili) subjects.push({ ...bili, aliases: bili.aliases.slice() });
  }
  const overrides = {};
  if (scope.overrides && typeof scope.overrides === 'object') {
    for (const [k, v] of Object.entries(scope.overrides)) {
      if (typeof k === 'string' && k.length <= 160) overrides[k] = bool(v, false);
    }
  }
  return {
    version: 2,
    enabled: bool(src.enabled, d.enabled),
    replyText: bool(src.replyText, d.replyText),
    cooldownSec: clamp(src.cooldownSec, 0, 3600, d.cooldownSec),
    maxPerHour: clamp(src.maxPerHour, 1, 500, d.maxPerHour),
    noRepeatMinutes: clamp(src.noRepeatMinutes, 1, 10080, d.noRepeatMinutes),
    scope: {
      groups: bool(scope.groups, d.scope.groups),
      privates: bool(scope.privates, d.scope.privates),
      overrides,
    },
    subjects,
    providers: Object.keys(PROVIDERS),
    theme: src.theme === 'light' ? 'light' : 'auto',
  };
}

function load(root) {
  const file = fileFor(root);
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') raw = null;
  }
  return { file, config: normalize(raw), created: !raw };
}

function save(root, cfg) {
  const file = fileFor(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = normalize(cfg);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return data;
}

function ensure(root) {
  const state = load(root);
  if (state.created) save(root, state.config);
  return state;
}

function isChatEnabled(cfg, chatId, chatType) {
  if (!cfg || cfg.enabled !== true) return false;
  const id = String(chatId || '');
  const type = chatType === 'group' ? 'group' : 'private';
  const base = type === 'group' ? cfg.scope.groups : cfg.scope.privates;
  if (Object.prototype.hasOwnProperty.call(cfg.scope.overrides, id)) {
    return cfg.scope.overrides[id] === true;
  }
  return base === true;
}

function findSubject(cfg, text) {
  const needle = String(text || '').toLowerCase();
  let best = null;
  for (const s of cfg.subjects || []) {
    if (!s.enabled) continue;
    for (const a of s.aliases || []) {
      const alias = String(a).toLowerCase();
      if (!alias) continue;
      if (needle === alias || needle.includes(alias)) {
        if (!best || alias.length > best.alias.length) best = { subject: s, alias };
      }
    }
  }
  return best ? best.subject : null;
}

function defaultSubject(cfg) {
  return (cfg.subjects || []).find((s) => s.enabled && s.id === 'landscape')
    || (cfg.subjects || []).find((s) => s.enabled)
    || null;
}

function blocked(text) {
  const s = String(text || '');
  return BLOCKED_TERMS.find((w) => s.includes(w)) || '';
}

function hash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
}

module.exports = {
  FILE, PROVIDERS, DEFAULT_SUBJECTS, BLOCKED_TERMS,
  defaults, normalize, load, save, ensure, isChatEnabled,
  findSubject, defaultSubject, blocked, hash, fileFor,
  version,
};
