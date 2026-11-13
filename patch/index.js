'use strict';

/**
 * 鲸鲸图片补丁入口。
 *
 * 不改鲸鲸业务源码：安装器只在 server.js 第一行插一句
 *   require('./whale-image-patch').install();
 * 其余全部在运行时包一层：Gateway.handleInbound（识别指令/发图）+ createRouter（管理页/API）。
 */

const path = require('node:path');
const versionInfo = require('./version');
const configModule = require('./config');
const { install: installGatewayHook } = require('./hook');
const proxy = require('./proxy');

const STATE_KEY = '__WHALE_IMAGE_PATCH__';
let installed = false;
let runtimeRef = null;
let rootRef = '';
let lastErrorAt = 0;
let lastErrorText = '';

function log(level, text) {
  const logger = runtimeRef && runtimeRef.logger;
  try {
    if (logger && typeof logger[level] === 'function') logger[level](text);
    else if (level === 'error' || level === 'warn') console.error(text);
    else console.log(text);
  } catch { /* ignore */ }
}

function logOnce(text) {
  const now = Date.now();
  if (text === lastErrorText && now - lastErrorAt < 10 * 60 * 1000) return;
  lastErrorAt = now;
  lastErrorText = text;
  log('warn', text);
}

function registerRoutes(root) {
  const routes = require('../src/http/routes');
  if (routes.__whaleImagePatchWrapped) return;
  const original = routes.createRouter;
  routes.createRouter = function createRouterWithImagePatch(runtime) {
    const router = original(runtime);
    try {
      require('./routes').register(router, runtime, { root });
    } catch (err) {
      logOnce('图片补丁管理接口注册失败（不影响聊天）：' + ((err && err.message) || err));
    }
    return router;
  };
  routes.__whaleImagePatchWrapped = true;
}

function patchRuntime(root) {
  const app = require('../src/app');
  if (app.__whaleImagePatchWrapped) return;
  const original = app.createRuntime;
  app.createRuntime = function createRuntimeWithImagePatch(opts = {}) {
    const runtime = original(opts);
    try {
      runtimeRef = runtime;
      if (!rootRef) rootRef = root || (opts && opts.root ? path.resolve(opts.root) : path.resolve(__dirname, '..'));
      const state = configModule.load(rootRef);
      log('info', `🖼️ 图片补丁 ${versionInfo.version} 已加载：`
        + `${state.config.enabled ? '开' : '关'} · ${state.config.subjects.length} 个类别`
        + ` · 回复${state.config.replyText ? '带来源' : '不带来源'}`);
    } catch (err) {
      logOnce('图片补丁初始化失败（不影响鲸鲸本体）：' + ((err && err.message) || err));
    }
    return runtime;
  };
  app.__whaleImagePatchWrapped = true;
}

function install(opts = {}) {
  if (installed || global[STATE_KEY]) return global[STATE_KEY] || null;
  const root = path.resolve(opts.root || path.resolve(__dirname, '..'));
  rootRef = root;
  let state;
  try { state = configModule.ensure(root); } catch { state = configModule.load(root); }
  if (!state.config.enabled) {
    installed = true;
    global[STATE_KEY] = { installed: true, disabled: true, version: versionInfo.version, root };
    return global[STATE_KEY];
  }
  try {
    proxy.enable();
    installGatewayHook();
    registerRoutes(root);
    patchRuntime(root);
  } catch (err) {
    logOnce('图片补丁安装失败（不影响鲸鲸本体）：' + ((err && err.message) || err));
  }
  installed = true;
  global[STATE_KEY] = {
    installed: true,
    version: versionInfo.version,
    base: versionInfo.base,
    root,
    configFile: state.file,
  };
  return global[STATE_KEY];
}

function getInfo() {
  return {
    ...versionInfo,
    root: rootRef,
    runtime: Boolean(runtimeRef),
    installed,
  };
}

function getRuntime() { return runtimeRef; }

module.exports = {
  install,
  getInfo,
  getRuntime,
  versionInfo,
  config: configModule,
  STATE_KEY,
};
