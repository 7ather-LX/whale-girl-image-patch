'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { json, readBody } = require('../src/http/util');
const { isLoopbackRequest } = require('../src/http/security');
const configModule = require('./config');
const command = require('./command');
const { ImageService } = require('./service');

const STATIC = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
};

function loopbackOnly(req, res) {
  if (isLoopbackRequest(req)) return false;
  json(res, 403, { ok: false, error: '图片补丁页面只允许在本机打开' });
  return true;
}

function chatList(runtime) {
  const chats = [];
  const store = runtime && runtime.store;
  const map = store && store.chatStore && store.chatStore.chats;
  if (!map) return chats;
  for (const chat of map.values()) {
    if (!chat || chat.chatId === 'filehelper') continue;
    const title = String(chat.title || '').trim();
    if (!title) continue;
    if (String(chat.platform || 'wechat') !== 'wechat') continue;
    chats.push({
      id: String(chat.chatId || ''),
      title,
      type: chat.chatType === 'group' ? 'group' : 'private',
      messages: Array.isArray(chat.messages) ? chat.messages.length : 0,
      lastActiveAt: Number(chat.lastActiveAt) || 0,
    });
  }
  chats.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return chats.slice(0, 200);
}

function service(runtime) {
  // service 以 bot 为键缓存；路由通过 hook 暴露的同一实例。
  const { serviceFor } = require('./hook');
  const svc = serviceFor(runtime.bot);
  if (!svc) throw new Error('图片服务未初始化');
  return svc;
}

function register(router, runtime, ctx) {
  const root = (ctx && ctx.root) || runtime.config.root || path.resolve(__dirname, '..');

  router.get('/image-patch', (rt, req, res) => {
    res.writeHead(302, { Location: '/image-patch/' });
    res.end();
  });

  router.get('/image-patch/', (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    try {
      const html = fs.readFileSync(path.join(__dirname, 'web', 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': STATIC['index.html'], 'Cache-Control': 'no-store' });
      res.end(html);
    } catch {
      json(res, 500, { ok: false, error: '图片补丁页面文件缺失，请重新安装' });
    }
  });

  for (const name of ['app.js', 'style.css']) {
    router.get(`/image-patch/${name}`, (rt, req, res) => {
      if (loopbackOnly(req, res)) return;
      try {
        const body = fs.readFileSync(path.join(__dirname, 'web', name));
        res.writeHead(200, { 'Content-Type': STATIC[name], 'Cache-Control': 'no-store' });
        res.end(body);
      } catch {
        json(res, 404, { ok: false, error: 'not found' });
      }
    });
  }

  router.get('/api/image-patch/status', (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const state = configModule.load(root);
    let svc = null;
    try { svc = service(rt); } catch { /* ignore */ }
    let bridgeOnline = false;
    try {
      const gw = rt.gateways && rt.gateways.get && rt.gateways.get('wechat');
      bridgeOnline = Boolean(gw && gw.status().bridge.online);
    } catch { /* ignore */ }
    return json(res, 200, {
      ok: true,
      patch: { version: require('./version').version, base: require('./version').base, file: state.file },
      config: state.config,
      chats: chatList(rt),
      diagnostics: {
        stickerReady: Boolean(rt.config.features && rt.config.features.stickers === true),
        bridge: bridgeOnline,
        last: svc ? svc.last : null,
        lastError: svc ? svc.lastError : '',
      },
    });
  });

  router.get('/api/image-patch/config', (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const state = configModule.load(root);
    return json(res, 200, { ok: true, config: state.config, file: state.file });
  });

  router.post('/api/image-patch/config', async (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const body = await readBody(req);
    try {
      if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: '无效配置' });
      if (body.enabled !== undefined || body.scope || body.subjects) {
        const cfg = configModule.save(root, body);
        try { service(rt).reload(); } catch { /* ignore */ }
        return json(res, 200, { ok: true, config: cfg });
      }
      return json(res, 400, { ok: false, error: '没有要保存的内容' });
    } catch (err) {
      return json(res, 400, { ok: false, error: String(err && err.message || err) });
    }
  });

  router.post('/api/image-patch/test', async (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const body = await readBody(req);
    try {
      const svc = service(rt);
      svc.reload();
      const cfg = svc.config;
      let subject = null;
      if (body && body.subjectId) subject = cfg.subjects.find((s) => s.id === body.subjectId) || null;
      if (!subject && body && body.command) {
        const p = command.parse(body.command, cfg);
        subject = p.ok ? p.subject : null;
      }
      if (!subject) return json(res, 400, { ok: false, error: '请选择一个类别或输入有效指令' });
      const hit = await svc.fetch(subject);
      return json(res, 200, {
        ok: true,
        subject: { id: subject.id, name: subject.name },
        source: hit.source,
        creator: hit.creator,
        license: hit.license,
        page: hit.page,
        image: `/image-patch/preview/${encodeURIComponent(path.basename(hit.path))}`,
        bytes: hit.bytes,
      });
    } catch (err) {
      return json(res, 502, { ok: false, error: String(err && err.message || err) });
    }
  });

  router.pattern(/^\/image-patch\/preview\/([^/]+)$/, (rt, req, res, info) => {
    if (loopbackOnly(req, res)) return;
    const name = path.basename(String((info && info.params && info.params[0]) || ''));
    if (!/^[a-z0-9_-]+\.(jpe?g|png|webp|gif)$/i.test(name)) return json(res, 400, { ok: false, error: 'bad name' });
    let dir;
    try { dir = service(rt).stickerDir(); } catch { dir = path.join(root, 'data', 'stickers', 'auto-images'); }
    const file = path.join(dir, name);
    try {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { ok: false, error: 'not found' });
      const ext = path.extname(file).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' });
      res.end(fs.readFileSync(file));
    } catch {
      json(res, 404, { ok: false, error: 'not found' });
    }
  });
}

module.exports = { register, chatList };
