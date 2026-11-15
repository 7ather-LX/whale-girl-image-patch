'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfgmod = require('./config');
const command = require('./command');
const providers = require('./providers');
const { downloadImage } = require('./http');

class ImageService {
  constructor(runtime) {
    this.runtime = runtime;
    this.root = runtime && runtime.config && runtime.config.root ? runtime.config.root : process.cwd();
    this.bot = runtime && runtime.bot;
    this.logger = (runtime && runtime.logger) || console;
    this.state = cfgmod.ensure(this.root);
    this.config = this.state.config;
    this.cooldown = new Map();
    this.hourly = [];
    this.last = null;
    this.lastError = '';
    this.fetchBusy = false;
    this.historyFile = path.join(this.root, 'data', 'whale-image-patch-history.json');
    this.characterCacheFile = path.join(this.root, 'data', 'whale-image-patch-characters.json');
    this.characterCache = this.loadCharacterCache();
    this.history = this.loadHistory();
  }

  loadCharacterCache() {
    try {
      const data = JSON.parse(fs.readFileSync(this.characterCacheFile, 'utf8'));
      return data && typeof data.items === 'object' ? data.items : {};
    } catch {
      return {};
    }
  }

  saveCharacterCache() {
    try {
      const entries = Object.entries(this.characterCache || {})
        .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
        .slice(0, 300);
      this.characterCache = Object.fromEntries(entries);
      fs.mkdirSync(path.dirname(this.characterCacheFile), { recursive: true });
      const tmp = this.characterCacheFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, items: this.characterCache }, null, 2), 'utf8');
      fs.renameSync(tmp, this.characterCacheFile);
    } catch (err) {
      this.logger.warn?.('[image-patch] character cache save failed: ' + (err && err.message || err));
    }
  }

  async resolveCharacterTag(name) {
    const key = String(name || '').toLowerCase().trim();
    if (!key) return '';
    const hit = this.characterCache[key];
    if (hit && Date.now() - Number(hit.at || 0) < 30 * 24 * 3600 * 1000) return hit.tag || '';
    const llm = this.runtime && this.runtime.llm;
    if (!llm || typeof llm.complete !== 'function' || llm.isMock) return '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const baseSystem = [
      '你是动漫角色名到 Safebooru/Danbooru 角色 tag 的转换器。',
      '用户会给你中文、日文或英文昵称；输出对应的角色 tag。',
      'tag 只能包含小写英文、数字、下划线，必要时可带括号，例如 tokai_teio、gotoh_hitori、rem_(re:zero)、mejiro_ardan_(umamusume)。',
      '拼写必须准确；角色有系列时优先带系列后缀，例如 mejiro_ardan_(umamusume)。',
      '只输出一个 tag，不要解释、不要 Markdown、不要引号。无法确定就输出 UNKNOWN。',
      '示例：东海帝皇 => tokai_teio；波奇酱 => gotoh_hitori；雷姆 => rem_(re:zero)；目白阿尔丹 => mejiro_ardan_(umamusume)。',
    ].join('\n');
    try {
      let lastTag = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const system = attempt === 0
          ? baseSystem
          : baseSystem + `\n上一次你输出了 ${lastTag}，但 Safebooru 没有这个 tag。请重新给出准确 tag（注意拼写和系列后缀）。`;
        const answer = await llm.complete({
          system,
          turns: [{ role: 'user', content: key }],
          maxTokens: 40,
          thinking: false,
          signal: controller.signal,
          purpose: 'image-patch-character',
        });
        const tag = String(answer || '').trim().toLowerCase()
          .replace(/^[`'"]+|[`'"]+$/g, '')
          .replace(/[\s/]+/g, '_')
          .replace(/[^a-z0-9_():-]+/g, '')
          .slice(0, 80);
        if (!tag || tag === 'unknown' || !/^[a-z0-9_():-]+$/.test(tag)) continue;
        let valid = true;
        try {
          valid = await providers.safebooruTag(tag, { timeout: 8000 });
        } catch { /* 标签接口失败时先信任模型 */ }
        if (valid) {
          this.characterCache[key] = { tag, at: Date.now(), name: String(name).slice(0, 60) };
          this.saveCharacterCache();
          this.logger.info?.(`[image-patch] auto character ${name} -> ${tag}`);
          return tag;
        }
        lastTag = tag;
        this.logger.warn?.(`[image-patch] model tag not on Safebooru: ${name} -> ${tag}`);
      }
      this.characterCache[key] = { tag: '', at: Date.now(), name: String(name).slice(0, 60) };
      this.saveCharacterCache();
      return '';
    } catch (err) {
      this.logger.warn?.('[image-patch] auto character resolve failed: ' + (err && err.message || err));
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  async dynamicSubject(objectText, attributes) {
    const name = String(objectText || '').trim().slice(0, 60);
    if (!name) return null;
    const tag = await this.resolveCharacterTag(name);
    if (tag) {
      return cfgmod.characterSubject({
        id: 'dynamic-' + this.hashOf(name).slice(0, 10),
        name,
        aliases: [name],
        tag,
        enabled: true,
      }, attributes);
    }
    // 没有可验证的 Safebooru tag 时宁可不发，避免把 B 站随机封面当成该角色。
    return null;
  }

  reload() {
    this.state = cfgmod.ensure(this.root);
    this.config = this.state.config;
    return this.config;
  }

  save(next) {
    this.config = cfgmod.save(this.root, next);
    return this.config;
  }

  stickerDir() {
    let base = path.join(this.root, 'data', 'stickers');
    try {
      // 复用鲸鲸自己的表情包目录规则，保证 bridge 的路径校验能通过。
      const stickers = require(path.join(this.root, 'src', 'adapters', 'stickers'));
      base = stickers.stickerDir(this.runtime.config, this.root);
    } catch { /* 测试或旧版本：回退默认目录 */ }
    return path.join(base, 'auto-images');
  }

  maxBytes() { return 8 * 1024 * 1024; }

  loadHistory() {
    try {
      const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      const items = data && data.items && typeof data.items === 'object' ? data.items : {};
      this.history = items;
      this.pruneHistory();
      return items;
    } catch {
      return {};
    }
  }

  pruneHistory() {
    const cutoff = Date.now() - (Number(this.config.noRepeatMinutes) || 1440) * 60 * 1000;
    for (const [k, ts] of Object.entries(this.history || {})) {
      if (!ts || ts < cutoff) delete this.history[k];
    }
    const entries = Object.entries(this.history || {}).sort((a, b) => b[1] - a[1]);
    if (entries.length > 600) this.history = Object.fromEntries(entries.slice(0, 600));
  }

  saveHistory() {
    try {
      this.pruneHistory();
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      const tmp = this.historyFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, items: this.history }, null, 2), 'utf8');
      fs.renameSync(tmp, this.historyFile);
    } catch (err) {
      this.logger.warn?.('[image-patch] history save failed: ' + (err && err.message || err));
    }
  }

  hashOf(value) {
    return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 20);
  }

  historyKey(kind, value) { return kind + ':' + this.hashOf(value); }

  isRecentKey(key) {
    const ts = this.history && this.history[key];
    return Boolean(ts && Date.now() - ts < (Number(this.config.noRepeatMinutes) || 1440) * 60 * 1000);
  }

  isDuplicateHit(hit) {
    return [hit.url, hit.thumb].filter(Boolean).some((u) => this.isRecentKey(this.historyKey('u', u)));
  }

  remember(hit, file) {
    const now = Date.now();
    for (const u of [hit.url, hit.thumb].filter(Boolean)) this.history[this.historyKey('u', u)] = now;
    if (file && (file.sha1 || file.name)) this.history[this.historyKey('f', file.sha1 || file.name)] = now;
    this.saveHistory();
  }

  cooldownLeft(chatId) {
    const sec = Number(this.config.cooldownSec) || 0;
    const last = this.cooldown.get(chatId) || 0;
    return Math.max(0, sec * 1000 - (Date.now() - last));
  }

  hourlyCount() {
    const cutoff = Date.now() - 3600 * 1000;
    this.hourly = this.hourly.filter((t) => t > cutoff);
    return this.hourly.length;
  }

  markSent(chatId) {
    this.cooldown.set(chatId, Date.now());
    this.hourly.push(Date.now());
  }

  async search(subject, page = 1) {
    const queries = Array.isArray(subject.queries) && subject.queries.length
      ? subject.queries
      : [subject.query];
    let firstError = null;
    const all = [];
    const seen = new Set();
    for (const query of queries) {
      try {
        const list = await providers.search({ ...subject, query }, {
          timeout: 15000,
          page,
          minWidth: subject.minWidth,
          minHeight: subject.minHeight,
          minScore: subject.minScore,
        });
        for (const hit of list) {
          const key = hit.url || hit.thumb;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          all.push(hit);
          if (all.length >= 12) break;
        }
        if (all.length >= 12) break;
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    if (all.length) return all;
    if (firstError) throw firstError;
    throw new Error('没有搜到合适的图片');
  }

  async fetch(subject) {
    // 跨会话并发时也要串行化：先查重、再下载、再记历史，避免两个群同时拿到同一张。
    while (this.fetchBusy) await new Promise((r) => setTimeout(r, 40));
    this.fetchBusy = true;
    try {
      return await this.fetchUnlocked(subject);
    } finally {
      this.fetchBusy = false;
    }
  }

  async tryPool(pool, subject, started) {
    for (const hit of pool.slice(0, 12)) {
      if (Date.now() - started > 52000) break;
      if (this.isDuplicateHit(hit)) continue;
      for (const url of [hit.thumb, hit.url].filter(Boolean)) {
        try {
          const file = await downloadImage(url, this.stickerDir(), {
            maxBytes: this.maxBytes(), prefix: subject.id, timeout: 9000,
          });
          if (file && (file.sha1 || file.name) && this.isRecentKey(this.historyKey('f', file.sha1 || file.name))) continue;
          this.remember(hit, file);
          return { ...hit, ...file };
        } catch (err) {
          this.logger.warn?.(`[image-patch] 图片下载失败 ${url.slice(0, 80)}: ${err && err.message || err}`);
        }
      }
    }
    return null;
  }

  async fetchUnlocked(subject) {
    let lastErr = null;
    const started = Date.now();
    // 同一张图在所有聊天里都不重复：最多换 3 页/3 轮搜索。
    for (let round = 0; round < 3; round++) {
      if (Date.now() - started > 45000) break;
      const page = subject.character ? 1 : (1 + Math.floor(Math.random() * 5));
      let pool;
      try {
        pool = await this.search(subject, page);
      } catch (err) {
        lastErr = err;
        continue;
      }
      const got = await this.tryPool(pool, subject, started);
      if (got) return got;
      break;
    }
    // 主图库的图床整体打不开时，换一个来源再试一轮（Openverse 的 Flickr 图床经常 502）。
    // 指定角色的请求不用 B 站封面兜底：中文搜索出来的封面经常不是该角色。
    if (!subject.character && Date.now() - started < 50000) {
      const altProvider = subject.provider === 'bilibili' ? 'wikimedia' : 'bilibili';
      const altQuery = (subject.fallbackQueries && subject.fallbackQueries[0]) || subject.query;
      try {
        const alt = await providers.search({ ...subject, query: altQuery, provider: altProvider }, {
          timeout: 15000,
          page: 1 + Math.floor(Math.random() * 3),
          minWidth: subject.minWidth,
          minHeight: subject.minHeight,
          minScore: subject.minScore,
        });
        const got = await this.tryPool(alt, { ...subject, id: subject.id + '-' + altProvider }, started);
        if (got) return got;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    throw new Error('这段时间的图都发过了，换一个类别或稍后再试');
  }

  makeJob(msg, file) {
    const svc = this.bot && this.bot.stickerService;
    if (!svc || typeof svc.add !== 'function') throw new Error('当前版本没有表情包发送通道');
    if (this.runtime.config.features && this.runtime.config.features.stickers !== true) {
      throw new Error('基础软件的表情包发送功能未开启');
    }
    const chatName = msg.chatTitle || msg.chatId;
    const job = svc.add(
      { emotion: 'x:image-patch', path: file },
      chatName,
      msg.chatId,
      `wechat:${msg.chatId}`,
      'queued'
    );
    return job;
  }

  replyFor(subject, hit) {
    const bits = [`「${subject.name}」`];
    if (hit.source) bits.push(hit.source);
    if (hit.creator) bits.push(hit.creator);
    if (hit.license) bits.push(hit.license);
    return bits.join(' · ').slice(0, 140);
  }

  /**
   * @returns {Promise<null|{reply:string, job?:object, unknownSubject?:string, reason?:string}>}
   */
  async handleMessage(msg) {
    if (!msg || msg.platform !== 'wechat' || !msg.chatId) return null;
    const config = this.reload();
    if (!config.enabled) return null;
    if (!cfgmod.isChatEnabled(config, msg.chatId, msg.chatType)) return null;
    const text = msg.cleanText || msg.text || '';
    const parsed = command.parse(text, config);
    if (!parsed.ok) {
      if (parsed.reason === 'blocked' && parsed.blocked) {
        this.lastError = 'blocked:' + parsed.blocked;
        this.logger.warn?.(`[image-patch] 拒绝不安全请求 keyword=${parsed.blocked}`);
      }
      return null;
    }
    let subject = parsed.subject;
    if (parsed.unknownSubject !== undefined) {
      if (!config.autoCharacter) {
        return { reply: `还没有配置「${parsed.unknownSubject || '这个'}」这个角色，去图片管理页加一个，或打开「自动识别角色」。`, reason: 'unknown_subject' };
      }
      try {
        subject = await this.dynamicSubject(parsed.objectText || parsed.unknownSubject, parsed.attributes || []);
      } catch (err) {
        this.logger.warn?.('[image-patch] dynamic character failed: ' + (err && err.message || err));
      }
      if (!subject) {
        return { reply: `没找到「${parsed.objectText || parsed.unknownSubject || '这个角色'}」在 Safebooru 的安全图库（可能没有这个角色 tag）。可以在图片管理页手动填一个确认存在的 tag。`, reason: 'unknown_subject' };
      }
      this.logger.info?.(`[image-patch] dynamic subject=${subject.id} query=${subject.query}`);
    }
    if (!subject) return null;
    if (this.hourlyCount() >= (Number(config.maxPerHour) || 30)) {
      return { reply: '今天图片发得有点多，先歇一会儿～', reason: 'rate_limited' };
    }
    const left = this.cooldownLeft(msg.chatId);
    if (left > 0) {
      this.logger.info?.(`[image-patch] cooldown chat=${msg.chatId} left=${Math.ceil(left / 1000)}s`);
      return null;
    }
    try {
      const hit = await this.fetch(subject);
      const job = this.makeJob(msg, hit.path);
      this.markSent(msg.chatId);
      this.last = { at: Date.now(), subject: subject.name, source: hit.source, license: hit.license, path: hit.path, chat: msg.chatTitle || msg.chatId };
      this.logger.info?.(`[image-patch] sent subject=${subject.id} chat=${msg.chatId} source=${hit.source}`);
      return { reply: this.replyFor(subject, hit), job, hit, subject: subject.id };
    } catch (err) {
      this.lastError = String(err && err.message || err);
      this.logger.warn?.(`[image-patch] failed: ${this.lastError}`);
      return { reply: '这次没找到合适的图，等会儿再试试吧。', reason: 'search_failed', error: this.lastError };
    }
  }

  status() {
    return {
      version: require('./version').version,
      enabled: this.config.enabled,
      chats: {
        groups: this.config.scope.groups,
        privates: this.config.scope.privates,
        overrides: this.config.scope.overrides,
      },
      subjects: this.config.subjects,
      cooldownSec: this.config.cooldownSec,
      maxPerHour: this.config.maxPerHour,
      noRepeatMinutes: this.config.noRepeatMinutes,
      historyCount: Object.keys(this.history || {}).length,
      stickerReady: Boolean(this.runtime.config.features && this.runtime.config.features.stickers === true),
      last: this.last,
      lastError: this.lastError,
    };
  }
}

module.exports = { ImageService };
