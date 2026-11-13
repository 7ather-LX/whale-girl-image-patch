'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../patch/config');
const command = require('../patch/command');

const cfg = config.normalize(config.defaults());

test('来张美图 -> 默认风景', () => {
  const p = command.parse('来张美图', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.subject.id, 'landscape');
});

test('看看脚 -> 鞋袜/足部安全类别', () => {
  const p = command.parse('看看脚', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.subject.id, 'shoes');
});

test('来张动漫少女 -> safebooru 类别', () => {
  const p = command.parse('来张动漫少女', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.subject.id, 'anime');
});

test('普通聊天不触发', () => {
  assert.equal(command.parse('今天吃什么', cfg).ok, false);
});

test('不安全的词被拒绝', () => {
  const p = command.parse('看看萝莉', cfg);
  assert.equal(p.ok, false);
  assert.equal(p.reason, 'blocked');
});

test('未配置类别给出提示', () => {
  const p = command.parse('看看外星人', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.subject, null);
  assert.equal(p.unknownSubject, '外星人');
});

test('聊天开关：默认群聊开、私聊关，可逐个覆盖', () => {
  assert.equal(config.isChatEnabled(cfg, 'g1', 'group'), true);
  assert.equal(config.isChatEnabled(cfg, 'u1', 'private'), false);
  const c = config.normalize({ ...cfg, scope: { ...cfg.scope, overrides: { g1: false, u1: true } } });
  assert.equal(config.isChatEnabled(c, 'g1', 'group'), false);
  assert.equal(config.isChatEnabled(c, 'u1', 'private'), true);
});

test('配置归一化限制频率和非法 provider', () => {
  const c = config.normalize({ enabled: true, cooldownSec: -5, maxPerHour: 9999, subjects: [{ name: '测试', provider: 'evil', query: 'x' }] });
  assert.equal(c.cooldownSec, 0);
  assert.equal(c.maxPerHour, 500);
  assert.equal(c.subjects[0].provider, 'openverse');
});
