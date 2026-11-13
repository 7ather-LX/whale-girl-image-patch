'use strict';

/**
 * 国内网络经常需要走系统代理（Clash 等）。Node 默认不读 Windows 的代理设置，
 * 这里把 IE/WinHTTP 的代理读出来，交给 Node 24 的 http.setGlobalProxyFromEnv()。
 * 只影响补丁进程内的外网请求；连不上代理时退回直连。
 */
const http = require('node:http');
const { execFileSync } = require('node:child_process');

let done = false;

function regValue(name) {
  try {
    const out = execFileSync('reg', [
      'query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
      '/v', name,
    ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(new RegExp(name + '\\s+REG_\\w+\\s+(.+)', 'i'));
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

function systemProxy() {
  const enabled = regValue('ProxyEnable');
  if (!/^0x0*1$/i.test(enabled) && enabled !== '1') return '';
  const raw = regValue('ProxyServer');
  if (!raw) return '';
  if (raw.includes('=')) {
    const map = {};
    for (const part of raw.split(';')) {
      const [k, v] = part.split('=');
      if (k && v) map[k.trim().toLowerCase()] = v.trim();
    }
    return map.https || map.http || '';
  }
  return raw;
}

function enable() {
  if (done) return;
  done = true;
  try {
    let proxy = process.env.HTTPS_PROXY || process.env.https_proxy || systemProxy();
    if (!proxy) return;
    if (!/^https?:\/\//i.test(proxy)) proxy = 'http://' + proxy;
    process.env.HTTPS_PROXY = proxy;
    process.env.HTTP_PROXY = proxy;
    process.env.NO_PROXY = process.env.NO_PROXY || '127.0.0.1,localhost,::1';
    process.env.no_proxy = process.env.NO_PROXY;
    if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();
    console.log('[image-patch] 外网代理：' + proxy.replace(/\/\/[^@]*@/, '//***@'));
  } catch (err) {
    console.warn?.('[image-patch] 代理初始化失败，使用直连：' + (err && err.message || err));
  }
}

module.exports = { enable, systemProxy, regValue };
