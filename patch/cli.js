'use strict';

const fs = require('node:fs');
const path = require('node:path');
const configModule = require('./config');
const versionInfo = require('./version');

function line(ok, text) {
  console.log((ok ? '  [OK]   ' : '  [WARN] ') + text);
}

function main() {
  const root = path.resolve(process.argv[3] || path.resolve(__dirname, '..'));
  console.log(`图片补丁 ${versionInfo.version} · 适配鲸鲸 ${versionInfo.base}`);
  console.log('目录：' + root);
  line(fs.existsSync(path.join(root, 'server.js')), 'server.js');
  line(fs.existsSync(path.join(root, 'src', 'adapters', 'gateway.js')), 'src/adapters/gateway.js');
  line(fs.existsSync(path.join(root, 'src', 'adapters', 'stickers.js')), 'src/adapters/stickers.js');
  line(fs.existsSync(path.join(root, 'whale-image-patch')), 'whale-image-patch/');
  const state = configModule.ensure(root);
  line(!state.created, '配置文件：' + state.file);
  let base = null;
  try { base = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')); } catch { /* ignore */ }
  line(Boolean(base && base.features && base.features.stickers === true), '基础软件表情包通道（features.stickers）已开启');
  line(fs.existsSync(path.join(root, 'data', 'stickers')), 'data/stickers 目录');
  try {
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8').split(/\r?\n/).slice(0, 5).join('\n');
    line(/whale-image-patch/.test(server), 'server.js 已加载图片补丁');
  } catch { /* ignore */ }
  console.log('\n管理页：http://127.0.0.1:8787/image-patch/');
}

main();
