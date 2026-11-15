'use strict';

const cfg = require('./config');

const PREFIXES = [
  /^(?:来|发|整|给|搞)(?:一|两|几)?张(.*)$/,
  /^(?:来|发|整|给|搞)(?:一|两|几)?个(.*)$/,
  /^(?:看看|瞅瞅|瞧瞧|来点|来些)(.*)$/,
  /^(?:我想要|想看|要一张|来一张)(.*)$/,
];

function cleanInput(text) {
  return String(text || '')
    .replace(/@[^\s@]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[，。！？!?、,.~～…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFillers(s) {
  return String(s || '')
    .replace(/^(?:一张|张|个|点|些|一个)/, '')
    .replace(/(?:吧|呗|呀|啊|嘛|哦|呢|啦|哈|看看|瞅瞅|瞧瞧)$/g, '')
    .replace(/[的地得]$/g, '')
    .trim();
}

/**
 * 解析“来张美图 / 看看脚 / 来张风景”这类指令。
 * 返回 { ok, subjectText, raw, reason }；ok=false 表示不是本补丁的指令。
 */
function parse(text, config) {
  const raw = String(text || '');
  let s = cleanInput(raw);
  if (!s) return { ok: false, reason: 'empty' };
  // 去掉“鲸鲸”“小鲸”等称呼
  s = s.replace(/^(?:鲸鲸|小鲸|鲸鱼|whale|bot)[\s,:：]*/i, '').trim();
  if (!s) return { ok: false, reason: 'empty' };

  let subjectText = '';
  let matched = '';
  for (const re of PREFIXES) {
    const m = s.match(re);
    if (m) {
      matched = m[0];
      subjectText = stripFillers(m[1] || '');
      break;
    }
  }

  // 只发“美图”两个字
  if (!matched && /^(?:美图|图|图片|来图|发图)$/.test(s)) {
    matched = s;
    subjectText = '';
  }

  if (!matched) return { ok: false, reason: 'not_command' };

  // 去掉结尾的“的图 / 图片”
  subjectText = subjectText.replace(/(?:的图|图片|照片)$/g, '').trim();

  const bad = cfg.blocked(subjectText || s);
  if (bad) return { ok: false, reason: 'blocked', blocked: bad };

  let subject = null;
  let character = null;
  let attributes = [];
  if (subjectText) {
    character = cfg.findCharacter(config, subjectText);
    if (character) {
      attributes = cfg.findAttributes(config, subjectText);
      subject = cfg.characterSubject(character, attributes);
    }
  }
  if (!subject && subjectText) subject = cfg.findSubject(config, subjectText);
  if (!subject && /美图|图片|图/.test(matched + subjectText)) subject = cfg.defaultSubject(config);
  if (!subject) {
    return {
      ok: true,
      matched,
      subjectText,
      subject: null,
      unknownSubject: subjectText || '',
    };
  }
  return { ok: true, matched, subjectText, subject, character, attributes };
}

module.exports = { parse, cleanInput, stripFillers };
