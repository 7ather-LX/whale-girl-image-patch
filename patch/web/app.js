'use strict';

const $ = (s) => document.querySelector(s);
const state = { config: null, chats: [], tab: 'group', query: '' };

function toast(msg, bad = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

function setPill(text, kind) {
  const el = $('#pill');
  el.textContent = text;
  el.className = 'pill' + (kind ? ' ' + kind : '');
}

function isBaseOn(type) {
  return type === 'group' ? !!state.config.scope.groups : !!state.config.scope.privates;
}

function isOn(chat) {
  const ov = state.config.scope.overrides || {};
  if (Object.prototype.hasOwnProperty.call(ov, chat.id)) return ov[chat.id] === true;
  return isBaseOn(chat.type);
}

function setOn(chat, on) {
  const ov = state.config.scope.overrides || (state.config.scope.overrides = {});
  if (on === isBaseOn(chat.type)) delete ov[chat.id];
  else ov[chat.id] = on;
  renderChats();
}

function renderChats() {
  const list = $('#chatList');
  list.textContent = '';
  const rows = state.chats.filter((c) => c.type === state.tab && (!state.query || c.title.includes(state.query)));
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = state.query ? '没有匹配的聊天' : '还没有记录到聊天；先在微信里说几句话，再刷新。';
    list.append(p);
    return;
  }
  for (const chat of rows) {
    const row = document.createElement('div');
    row.className = 'chat-row';
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isOn(chat);
    cb.addEventListener('change', () => setOn(chat, cb.checked));
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = chat.title;
    lab.append(cb, name);
    const type = document.createElement('span');
    type.className = 'type';
    type.textContent = chat.type === 'group' ? '群' : '私聊';
    row.append(lab, type);
    list.append(row);
  }
}

function providerOptions(selected) {
  const opts = [
    ['openverse', 'Openverse（CC 授权）'],
    ['safebooru', 'Safebooru（安全动漫）'],
    ['wikimedia', 'Wikimedia Commons'],
    ['bilibili', 'Bilibili 视频封面'],
  ];
  return opts.map(([v, label]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    if (v === selected) o.selected = true;
    return o;
  });
}

function renderCharacters() {
  const wrap = $('#characters');
  wrap.textContent = '';
  (state.config.characters || []).forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'subject';
    const head = document.createElement('div');
    head.className = 'subject-head';
    const strong = document.createElement('strong');
    strong.textContent = c.name || ('角色 ' + (idx + 1));
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      state.config.characters.splice(idx, 1);
      renderCharacters();
      renderTestSelect();
    });
    head.append(strong, del);

    const name = document.createElement('input');
    name.type = 'text';
    name.value = c.name || '';
    name.placeholder = '角色名，如：东海帝皇';
    name.addEventListener('input', () => { c.name = name.value; strong.textContent = name.value || '角色'; renderTestSelect(); });

    const aliases = document.createElement('input');
    aliases.type = 'text';
    aliases.value = (c.aliases || []).join('、');
    aliases.placeholder = '别名，用、分隔，如：东海帝皇、东海帝王、teio';
    aliases.addEventListener('input', () => {
      c.aliases = aliases.value.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean);
    });

    const tag = document.createElement('input');
    tag.type = 'text';
    tag.value = c.tag || '';
    tag.placeholder = 'Safebooru 角色 tag，如：tokai_teio';
    tag.addEventListener('input', () => { c.tag = tag.value; });

    const enabled = document.createElement('label');
    enabled.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = c.enabled !== false;
    cb.addEventListener('change', () => { c.enabled = cb.checked; });
    enabled.append(cb, document.createTextNode(' 启用这个角色'));

    const field = (label, node) => {
      const f = document.createElement('label');
      f.className = 'field';
      f.append(document.createTextNode(label), node);
      return f;
    };
    card.append(head, field('名称', name), field('别名（指令里出现就命中）', aliases), field('Safebooru 角色 tag', tag), enabled);
    wrap.append(card);
  });
  if (!(state.config.characters || []).length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '还没有角色对象，点右上角「新建角色」。';
    wrap.append(p);
  }
}

function renderSubjects() {
  const wrap = $('#subjects');
  wrap.textContent = '';
  (state.config.subjects || []).forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'subject';
    const head = document.createElement('div');
    head.className = 'subject-head';
    const strong = document.createElement('strong');
    strong.textContent = s.name || ('类别 ' + (idx + 1));
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      state.config.subjects.splice(idx, 1);
      renderSubjects();
      renderTestSelect();
    });
    head.append(strong, del);

    const name = document.createElement('input');
    name.type = 'text';
    name.value = s.name || '';
    name.placeholder = '显示名称，如：动漫少女';
    name.addEventListener('input', () => { s.name = name.value; strong.textContent = name.value || '类别'; renderTestSelect(); });

    const aliases = document.createElement('input');
    aliases.type = 'text';
    aliases.value = (s.aliases || []).join('、');
    aliases.placeholder = '指令词，用、分隔，如：动漫少女、二次元';
    aliases.addEventListener('input', () => {
      s.aliases = aliases.value.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean);
    });

    const prov = document.createElement('select');
    prov.append(...providerOptions(s.provider));
    prov.addEventListener('change', () => { s.provider = prov.value; });

    const query = document.createElement('input');
    query.type = 'text';
    query.value = s.query || '';
    query.placeholder = '图库搜索词，如：anime girl / shoes socks';
    query.addEventListener('input', () => { s.query = query.value; });

    const enabled = document.createElement('label');
    enabled.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.enabled !== false;
    cb.addEventListener('change', () => { s.enabled = cb.checked; });
    enabled.append(cb, document.createTextNode(' 启用这个类别'));

    const field = (label, node) => {
      const f = document.createElement('label');
      f.className = 'field';
      f.append(document.createTextNode(label), node);
      return f;
    };

    card.append(
      head,
      field('名称', name),
      field('指令词（命中后发这个类别）', aliases),
      field('图库', prov),
      field('搜索词', query),
      enabled
    );
    wrap.append(card);
  });
  if (!(state.config.subjects || []).length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '还没有类别，点右上角「新建类别」。';
    wrap.append(p);
  }
}

function renderTestSelect() {
  const sel = $('#testSubject');
  sel.textContent = '';
  for (const s of state.config.subjects || []) {
    if (s.enabled === false) continue;
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    sel.append(o);
  }
  const csel = $('#testCharacter');
  if (csel) {
    csel.textContent = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— 角色对象 —';
    csel.append(empty);
    for (const c of state.config.characters || []) {
      if (c.enabled === false) continue;
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      csel.append(o);
    }
  }
}

function fillForm() {
  $('#enabled').checked = !!state.config.enabled;
  $('#groups').checked = !!state.config.scope.groups;
  $('#privates').checked = !!state.config.scope.privates;
  $('#cooldown').value = state.config.cooldownSec;
  $('#maxPerHour').value = state.config.maxPerHour;
  $('#noRepeat').value = state.config.noRepeatMinutes;
  $('#replyText').checked = state.config.replyText !== false;
  $('#autoCharacter').checked = state.config.autoCharacter !== false;
  renderCharacters();
  renderSubjects();
  renderTestSelect();
  renderChats();
}

async function load() {
  try {
    const data = await api('/api/image-patch/status');
    state.config = data.config;
    state.chats = data.chats || [];
    fillForm();
    const d = data.diagnostics || {};
    const parts = [];
    parts.push(d.stickerReady ? '基础软件表情包通道：已开启' : '基础软件表情包通道：未开启（需要重启/启用）');
    parts.push(d.bridge ? '微信桥接：在线' : '微信桥接：离线或未启动');
    if (d.last) parts.push(`上一张：${d.last.subject} · ${d.last.chat}`);
    if (d.lastError) parts.push(`上次错误：${d.lastError}`);
    $('#diag').textContent = parts.join('　|　');
    setPill('已连接', 'ok');
  } catch (err) {
    setPill('未连接', 'bad');
    $('#diag').textContent = String(err.message || err);
  }
}

async function save() {
  if (!state.config) return;
  state.config.enabled = $('#enabled').checked;
  state.config.scope.groups = $('#groups').checked;
  state.config.scope.privates = $('#privates').checked;
  state.config.cooldownSec = Number($('#cooldown').value) || 0;
  state.config.maxPerHour = Number($('#maxPerHour').value) || 30;
  state.config.noRepeatMinutes = Number($('#noRepeat').value) || 1440;
  state.config.replyText = $('#replyText').checked;
  state.config.autoCharacter = $('#autoCharacter').checked;
  try {
    const data = await api('/api/image-patch/config', {
      method: 'POST',
      body: JSON.stringify(state.config),
    });
    state.config = data.config;
    fillForm();
    toast('已保存，下一轮聊天生效');
  } catch (err) {
    toast('保存失败：' + (err.message || err), true);
  }
}

async function test() {
  const characterId = $('#testCharacter') ? $('#testCharacter').value : '';
  const attr = $('#testAttr') ? $('#testAttr').value.trim() : '';
  const id = $('#testSubject').value;
  let body = { subjectId: id };
  if (characterId) {
    const ch = (state.config.characters || []).find((x) => x.id === characterId);
    if (!ch) return toast('角色不存在', true);
    body = { command: `看看${ch.name}${attr ? '的' + attr : ''}` };
  } else if (!id) {
    return toast('先建一个类别或角色', true);
  }
  const btn = $('#testBtn');
  btn.disabled = true;
  btn.textContent = '搜索中…';
  try {
    const data = await api('/api/image-patch/test', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    $('#preview').src = data.image + '?t=' + Date.now();
    $('#previewMeta').textContent = [data.source, data.creator, data.license].filter(Boolean).join(' · ');
    $('#previewWrap').classList.remove('hidden');
    $('#testInfo').textContent = data.bytes ? `${Math.round(data.bytes / 1024)} KB` : '';
  } catch (err) {
    $('#previewWrap').classList.add('hidden');
    toast('搜索失败：' + (err.message || err), true);
  } finally {
    btn.disabled = false;
    btn.textContent = '搜索并预览';
  }
}

function bind() {
  $('#save').addEventListener('click', save);
  $('#enabled').addEventListener('change', () => {
    if (state.config) state.config.enabled = $('#enabled').checked;
  });
  $('#autoCharacter').addEventListener('change', () => {
    if (state.config) state.config.autoCharacter = $('#autoCharacter').checked;
  });
  $('#groups').addEventListener('change', () => {
    if (!state.config) return;
    state.config.scope.groups = $('#groups').checked;
    renderChats();
  });
  $('#privates').addEventListener('change', () => {
    if (!state.config) return;
    state.config.scope.privates = $('#privates').checked;
    renderChats();
  });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    renderChats();
  }));
  $('#chatSearch').addEventListener('input', (e) => { state.query = e.target.value.trim(); renderChats(); });
  $('#addCharacter').addEventListener('click', () => {
    if (!state.config) return;
    state.config.characters = state.config.characters || [];
    state.config.characters.push({
      id: 'custom-' + Date.now().toString(36),
      name: '新角色',
      aliases: [],
      tag: '',
      enabled: true,
    });
    renderCharacters();
    renderTestSelect();
  });
  $('#addSubject').addEventListener('click', () => {
    if (!state.config) return;
    state.config.subjects.push({
      id: 'custom-' + Date.now().toString(36),
      name: '新类别',
      aliases: [],
      provider: 'openverse',
      query: '',
      enabled: true,
    });
    renderSubjects();
    renderTestSelect();
  });
  $('#testBtn').addEventListener('click', test);
}

bind();
load();
