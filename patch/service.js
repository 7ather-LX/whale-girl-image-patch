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
    this.history = this.loadHistory();
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
    for (const query of queries) {
      try {
        const list = await providers.search({ ...subject, query }, {
          timeout: 15000,
          page,
          minWidth: subject.minWidth,
          minHeight: subject.minHeight,
          minScore: subject.minScore,
        });
        if (list.length) return list.slice(0, 12);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
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
    for (const hit of pool.slice(0, 8)) {
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
      const page = 1 + Math.floor(Math.random() * 5);
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
    if (Date.now() - started < 50000) {
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
    if (parsed.unknownSubject !== undefined) {
      return { reply: `还没有配置「${parsed.unknownSubject || '这个'}」这个类别，去图片补丁页面加一个吧。`, reason: 'unknown_subject' };
    }
    const subject = parsed.subject;
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
