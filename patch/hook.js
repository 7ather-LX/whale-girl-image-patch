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
    let msg = null;
    try {
      if (opts && opts.local && this.platform === 'wechat') {
        msg = normalizeInbound(payload, this.platform);
        if (msg && msg.chatId && !ignoredChat(this.bot, msg)) {
          const denial = sendDenial(this.bot.config, {
            id: msg.chatId,
            names: [msg.chatTitle],
            isGroup: msg.chatType === 'group',
            platform: this.platform,
          });
          if (denial) return { ok: true, action: 'ignore', reason: denial };

          const svc = serviceFor(this.bot);
          const result = svc && await svc.handleMessage(msg);
          if (result) {
            const reply = String(result.reply || '').trim();
            if (result.job) {
              if (svc.config.replyText === false) {
                // 只发图：bridge 看到 stickerOnly 会跳过文字，直接粘贴图片。
                return {
                  ok: true,
                  action: 'reply',
                  reply: '',
                  stickerOnly: true,
                  sticker: result.job,
                  imagePatch: true,
                };
              }
              return {
                ok: true,
                action: 'reply',
                reply,
                bubbles: [reply],
                sticker: result.job,
                imagePatch: true,
              };
            }
            if (reply) {
              return { ok: true, action: 'reply', reply, bubbles: [reply], imagePatch: true };
            }
          }
        }
      }
    } catch (err) {
      (this.logger || console).warn?.('[image-patch] hook failed: ' + (err && err.message || err));
    }
    return original.call(this, payload, opts);
  };
  Gateway.prototype[KEY] = true;
}

module.exports = { install, serviceFor };
