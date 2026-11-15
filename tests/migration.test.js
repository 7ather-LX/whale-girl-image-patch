'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../patch/config');
const command = require('../patch/command');

test('旧版 Openverse 鞋袜配置会迁移到腿足 Safebooru', () => {
  const old = config.defaults();
  old.version = 1;
  old.subjects = [{
    id: 'shoes', name: '鞋袜 / 足部', aliases: ['脚'], provider: 'openverse', query: 'shoes footwear socks', enabled: true,
  }];
  const c = config.normalize(old);
  const s = c.subjects.find((x) => x.id === 'shoes');
  assert.equal(s.provider, 'safebooru');
  assert.match(s.query, /thighhighs/);
  assert.equal(c.version, 4);
});

test('看看 B 站 -> B站图片', () => {
  const c = config.normalize(config.defaults());
  const p = command.parse('看看B站', c);
  assert.equal(p.ok, true);
  assert.equal(p.subject.id, 'bili');
});

test('默认同一张图 24 小时不重复', () => {
  assert.equal(config.normalize(config.defaults()).noRepeatMinutes, 1440);
});
