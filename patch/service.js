'use strict';

const fs = require('fs');
const path = require('path');
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

  async search(subject) {
    const list = await providers.search(subject, { timeout: 15000 });
    if (!list.length) throw new Error('没有搜到合适的图片');
    // 取前 8 张，逐张尝试下载；某一图床被墙/502 时换下一张。
    return list.slice(0, 8);
  }

  async fetch(subject) {
    const pool = await this.search(subject);
    let lastErr = null;
    for (const hit of pool) {
      for (const url of [hit.thumb, hit.url].filter(Boolean)) {
        try {
          const file = await downloadImage(url, this.stickerDir(), { maxBytes: this.maxBytes(), prefix: subject.id });
          return { ...hit, ...file };
        } catch (err) {
          lastErr = err;
          this.logger.warn?.(`[image-patch] 图片下载失败 ${url.slice(0, 80)}: ${err && err.message || err}`);
        }
      }
    }
    throw lastErr || new Error('没有下载到可用的图片');
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
      stickerReady: Boolean(this.runtime.config.features && this.runtime.config.features.stickers === true),
      last: this.last,
      lastError: this.lastError,
    };
  }
}

module.exports = { ImageService };
