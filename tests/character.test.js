'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../patch/config');
const command = require('../patch/command');

const cfg = config.normalize(config.defaults());

test('指定角色 + 足部属性', () => {
  const p = command.parse('看看东海帝皇的脚', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.character.name, '东海帝皇');
  assert.equal(p.subject.provider, 'safebooru');
  assert.match(p.subject.query, /tokai_teio/);
  assert.match(p.subject.query, /barefoot/);
  assert.equal(p.subject.name, '东海帝皇 · 脚/足');
});

test('指定角色 + 裤袜属性', () => {
  const p = command.parse('看看东海帝皇的黑丝', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.character.name, '东海帝皇');
  assert.match(p.subject.query, /black_thighhighs/);
});

test('角色别名和单独角色', () => {
  const p = command.parse('来张东海帝王', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.character.name, '东海帝皇');
  assert.doesNotMatch(p.subject.query, /barefoot/);
});

test('未知角色仍然是未配置提示', () => {
  const p = command.parse('看看某个不存在的角色', cfg);
  assert.equal(p.ok, true);
  assert.equal(p.subject, null);
  assert.equal(p.unknownSubject, '某个不存在的角色');
});

test('角色配置可以自定义 tag', () => {
  const c = config.normalize(config.defaults());
  c.characters.push({ id: 'custom', name: '自定义角色', aliases: ['自定义角色'], tag: 'custom_character', enabled: true });
  const p = command.parse('看看自定义角色', c);
  assert.equal(p.subject.query.startsWith('custom_character'), true);
});
