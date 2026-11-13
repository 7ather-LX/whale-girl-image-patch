'use strict';

const { Gateway, normalizeInbound } = require('../src/adapters/gateway');
const { sendDenial } = require('../src/core/wechatSendPolicy');
const { ImageService } = require('./service');

const KEY = '__whaleImagePatchInstalled';
const services = new WeakMap();

function serviceFor(bot) {
  if (!bot) return null;
  let svc = services.get(bot);
  if (svc) return svc;
  try {
    svc = new ImageService({
      config: bot.config,
      root: bot.config && bot.config.root,
      bot,
      logger: bot.logger || console,
    });
    services.set(bot, svc);
    return svc;
  } catch (err) {
    (bot.logger || console).warn?.('[image-patch] service init failed: ' + (err && err.message || err));
    return null;
  }
}

function ignoredChat(bot, msg) {
  const list = bot && bot.config && bot.config.wechat && bot.config.wechat.ignoreSenders;
  if (!Array.isArray(list) || !list.length) return false;
  const name = String(msg.chatTitle || '');
  return list.some((x) => x && (name === x || name.includes(x)));
}

function install() {
  if (Gateway.prototype[KEY]) return;
  const original = Gateway.prototype.handleInbound;
  Gateway.prototype.handleInbound = async function handleInbound(payload, opts = {}) {
    const out = await original.call(this, payload, opts);
    try {
      if (!opts || !opts.local || this.platform !== 'wechat') return out;
      const msg = normalizeInbound(payload, this.platform);
      if (!msg || !msg.chatId) return out;
      if (ignoredChat(this.bot, msg)) return out;
      const svc = serviceFor(this.bot);
      if (!svc) return out;
      const result = await svc.handleMessage(msg);
      if (!result) return out;
      const reply = String(result.reply || '').trim();
      if (!reply) return out;
      const sticker = result.job || null;
      // 如果鲸鲸自己按模型回复挑了一张本地表情包，取消它，避免一次指令发两张图。
      if (out && out.sticker && out.sticker.id && (!sticker || out.sticker.id !== sticker.id)) {
        try {
          const old = this.bot.stickerService && this.bot.stickerService.jobs
            && this.bot.stickerService.jobs.get(out.sticker.id);
          if (old && old.status !== 'sending') old.status = 'cancelled';
        } catch { /* ignore */ }
      }
      if (out && out.action === 'reply') {
        out.reply = reply;
        out.bubbles = [reply];
        if (sticker) out.sticker = sticker;
        return out;
      }
      // 模型判定不回复（例如群里没 @ 她），但这是明确指令：补一条回复 + 图片。
      // 先过鲸鲸自己的禁言/白名单策略，避免绕过用户设置。
      const denial = sendDenial(this.bot.config, {
        id: msg.chatId,
        names: [msg.chatTitle],
        isGroup: msg.chatType === 'group',
        platform: this.platform,
      });
      if (denial) return out;
      return {
        ok: true,
        action: 'reply',
        reply,
        bubbles: [reply],
        ...(sticker ? { sticker } : {}),
        imagePatch: true,
      };
    } catch (err) {
      (this.logger || console).warn?.('[image-patch] hook failed: ' + (err && err.message || err));
      return out;
    }
  };
  Gateway.prototype[KEY] = true;
}

module.exports = { install, serviceFor };
