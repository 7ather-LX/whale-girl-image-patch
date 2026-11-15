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

/** 可指定到单个角色；tag 使用 Safebooru / Danbooru 通用角色 tag。 */
const DEFAULT_CHARACTERS = [
  { id: 'tokai_teio', name: '东海帝皇', aliases: ['东海帝皇', '东海帝王', '東海帝皇', 'tokai teio', 'teio'], tag: 'tokai_teio' },
  { id: 'mejiro_mcqueen', name: '目白麦昆', aliases: ['目白麦昆', '麦昆', 'mejiro mcqueen'], tag: 'mejiro_mcqueen' },
  { id: 'special_week', name: '特别周', aliases: ['特别周', '特別週', 'special week'], tag: 'special_week' },
  { id: 'silence_suzuka', name: '无声铃鹿', aliases: ['无声铃鹿', '無聲鈴鹿', '铃鹿', 'silence suzuka'], tag: 'silence_suzuka' },
  { id: 'gold_ship', name: '黄金船', aliases: ['黄金船', '黃金船', 'gold ship'], tag: 'gold_ship' },
  { id: 'kitasan_black', name: '北部玄驹', aliases: ['北部玄驹', '北部玄駒', 'kitasan black'], tag: 'kitasan_black' },
  { id: 'nice_nature', name: '优秀素质', aliases: ['优秀素质', '優秀素質', 'nice nature'], tag: 'nice_nature' },
  { id: 'rice_shower', name: '米浴', aliases: ['米浴', 'rice shower'], tag: 'rice_shower' },
  { id: 'hatsune_miku', name: '初音未来', aliases: ['初音未来', '初音未來', '初音', 'miku', 'hatsune miku'], tag: 'hatsune_miku' },
  { id: 'rem', name: '雷姆', aliases: ['雷姆', '蕾姆', 'rem'], tag: 'rem_(re:zero)' },
  { id: 'asuna', name: '亚丝娜', aliases: ['亚丝娜', '亞絲娜', 'asuna', 'yuuki asuna'], tag: 'yuuki_asuna' },
  { id: 'zero_two', name: '02', aliases: ['02', '零二', 'zero two'], tag: 'zero_two_(darling_in_the_franxx)' },
  { id: 'frieren', name: '芙莉莲', aliases: ['芙莉莲', '芙莉蓮', 'frieren'], tag: 'frieren' },
  { id: 'anya', name: '阿尼亚', aliases: ['阿尼亚', '阿尼亞', 'anya', 'anya forger'], tag: 'anya_forger' },
  { id: 'kurumi', name: '时崎狂三', aliases: ['时崎狂三', '時崎狂三', '狂三', 'kurumi'], tag: 'tokisaki_kurumi' },
  { id: 'mai', name: '樱岛麻衣', aliases: ['樱岛麻衣', '櫻島麻衣', '麻衣', 'mai'], tag: 'sakurajima_mai' },
];

/** 角色后面可以跟的动作/属性词，映射到图库 tag。 */
const DEFAULT_ATTRIBUTES = [
  { id: 'feet', label: '脚/足', aliases: ['脚', '足', '足部', '脚脚', 'feet', 'foot'], tags: ['barefoot'] },
  { id: 'legs', label: '腿', aliases: ['腿', '腿部', '大腿', 'legs'], tags: ['thighhighs', 'legs'] },
  { id: 'thighhighs', label: '裤袜', aliases: ['裤袜', '连裤袜', '丝袜', '过膝袜', 'thighhighs'], tags: ['thighhighs'] },
  { id: 'black_thighhighs', label: '黑丝', aliases: ['黑丝', '黑色裤袜', 'black thighhighs'], tags: ['black_thighhighs'] },
  { id: 'white_thighhighs', label: '白丝', aliases: ['白丝', '白色裤袜', 'white thighhighs'], tags: ['white_thighhighs'] },
  { id: 'school', label: '校服', aliases: ['校服', '制服', 'school uniform'], tags: ['school_uniform'] },
  { id: 'kimono', label: '和服', aliases: ['和服', '浴衣', 'kimono', 'yukata'], tags: ['kimono'] },
  { id: 'maid', label: '女仆', aliases: ['女仆', '女僕', 'maid'], tags: ['maid'] },
  { id: 'wedding', label: '婚纱', aliases: ['婚纱', '婚紗', 'wedding dress'], tags: ['wedding_dress'] },
  { id: 'cat_ears', label: '猫耳', aliases: ['猫耳', '貓耳', 'cat ears'], tags: ['cat_ears'] },
  { id: 'glasses', label: '眼镜', aliases: ['眼镜', '眼鏡', 'glasses'], tags: ['glasses'] },
  { id: 'twintails', label: '双马尾', aliases: ['双马尾', '雙馬尾', 'twintails'], tags: ['twintails'] },
  { id: 'smile', label: '笑', aliases: ['笑', '微笑', '笑容', 'smile'], tags: ['smile'] },
  { id: 'idol', label: '偶像/舞台', aliases: ['偶像', '舞台', '演出', 'idol', 'stage'], tags: ['idol', 'stage'] },
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
    characters: DEFAULT_CHARACTERS.map((s) => ({ ...s, aliases: s.aliases.slice() })),
    attributes: DEFAULT_ATTRIBUTES.map((s) => ({ ...s, aliases: s.aliases.slice(), tags: s.tags.slice() })),
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

function normalizeCharacter(raw, index) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const name = cleanText(s.name || s.id || '未命名角色', 30);
  let id = cleanText(s.id || s.tag || name, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) id = 'c' + (index + 1);
  const aliases = Array.isArray(s.aliases)
    ? s.aliases.map((x) => cleanText(x, 30)).filter(Boolean).slice(0, 24)
    : String(s.aliases || '').split(/[,，、\s]+/).map((x) => cleanText(x, 30)).filter(Boolean).slice(0, 24);
  if (name && !aliases.includes(name)) aliases.unshift(name);
  let tag = cleanText(s.tag || '', 80).toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^a-z0-9_():-]+/g, '')
    .slice(0, 80);
  if (!tag) tag = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_') || id;
  return { id, name, aliases, tag, enabled: bool(s.enabled, true) };
}

function normalizeAttribute(raw, index) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const label = cleanText(s.label || s.name || s.id || '属性', 20);
  const id = cleanText(s.id || label, 30).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || ('a' + (index + 1));
  const aliases = Array.isArray(s.aliases)
    ? s.aliases.map((x) => cleanText(x, 20)).filter(Boolean).slice(0, 20)
    : String(s.aliases || '').split(/[,，、\s]+/).map((x) => cleanText(x, 20)).filter(Boolean).slice(0, 20);
  const tags = Array.isArray(s.tags)
    ? s.tags.map((x) => cleanText(x, 40).toLowerCase().replace(/\s+/g, '_')).filter((x) => /^[a-z0-9_():-]+$/.test(x)).slice(0, 8)
    : String(s.tags || '').split(/[,，、\s]+/).map((x) => cleanText(x, 40).toLowerCase().replace(/\s+/g, '_')).filter((x) => /^[a-z0-9_():-]+$/.test(x)).slice(0, 8);
  return { id, label, aliases, tags, enabled: bool(s.enabled, true) };
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
  const characters = Array.isArray(src.characters)
    ? src.characters.map(normalizeCharacter).filter((x) => x.name)
    : d.characters.map((x) => ({ ...x, aliases: x.aliases.slice() }));
  const attributes = Array.isArray(src.attributes) && src.attributes.length
    ? src.attributes.map(normalizeAttribute).filter((x) => x.aliases.length && x.tags.length)
    : d.attributes.map((x) => ({ ...x, aliases: x.aliases.slice(), tags: x.tags.slice() }));
  return {
    version: 3,
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
    characters,
    attributes,
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

function findCharacter(cfg, text) {
  const needle = String(text || '').toLowerCase();
  let best = null;
  for (const c of cfg.characters || []) {
    if (c.enabled === false) continue;
    for (const a of c.aliases || []) {
      const alias = String(a).toLowerCase().trim();
      if (!alias) continue;
      if (/^[a-z0-9]{1,2}$/.test(alias) && needle !== alias) continue;
      if (needle === alias || needle.includes(alias)) {
        if (!best || alias.length > best.alias.length) best = { character: c, alias };
      }
    }
  }
  return best ? best.character : null;
}

function findAttributes(cfg, text) {
  const s = String(text || '').toLowerCase();
  const out = [];
  const seen = new Set();
  for (const a of cfg.attributes || []) {
    if (a.enabled === false) continue;
    const aliases = (a.aliases || []).map((x) => String(x).toLowerCase()).sort((x, y) => y.length - x.length);
    if (aliases.some((alias) => alias && s.includes(alias)) && !seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

function characterSubject(character, attributes = []) {
  const attrTags = [];
  for (const a of attributes) for (const tag of a.tags || []) if (!attrTags.includes(tag)) attrTags.push(tag);
  const base = [character.tag, ...attrTags, '1girl', 'solo'].filter(Boolean).join(' ');
  const withoutSolo = [character.tag, ...attrTags, '1girl'].filter(Boolean).join(' ');
  const onlyCharacter = [character.tag, '1girl', 'solo'].filter(Boolean).join(' ');
  const labels = attributes.map((a) => a.label).filter(Boolean);
  return {
    id: 'char-' + String(character.tag || character.id).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 30),
    name: character.name + (labels.length ? ' · ' + labels.join('/') : ''),
    provider: 'safebooru',
    query: base,
    queries: [...new Set([base, withoutSolo, onlyCharacter, character.tag].filter(Boolean))],
    fallbackQueries: [[character.name, ...labels].filter(Boolean).join(' '), character.name],
    minWidth: 500,
    minHeight: 500,
    minScore: 0,
    character: character.id,
    attributes: attributes.map((a) => a.id),
    enabled: true,
  };
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
  FILE, PROVIDERS, DEFAULT_SUBJECTS, DEFAULT_CHARACTERS, DEFAULT_ATTRIBUTES, BLOCKED_TERMS,
  defaults, normalize, load, save, ensure, isChatEnabled,
  findSubject, findCharacter, findAttributes, characterSubject, defaultSubject, blocked, hash, fileFor,
  version,
};
