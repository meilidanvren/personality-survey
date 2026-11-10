import { CONFIG } from './config.js';
import { bankA, bankT2 } from './surveyA.js';
import { esc } from './engine.js';
import { store, progress, driver } from './storage.js';

const app = document.getElementById('admin');
const qs = (sel, root = app) => root.querySelector(sel);

let records = [];
let unlocked = sessionStorage.getItem('qs.admin') === '1';

function render() {
  if (!unlocked) return renderGate();
  return renderPanel();
}

/* ---------------- 口令 ---------------- */

function renderGate() {
  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">数据管理</p>
    <h2>请输入管理口令</h2>
    <p class="muted">此页面只用于导出数据，请不要把链接发给被试。</p>
    <form class="code-form" data-el="form">
      <input class="code-input" type="password" name="pass" placeholder="管理口令" autocomplete="current-password">
      <button class="btn btn-primary" type="submit">进入</button>
    </form>
    <div class="alert alert-danger" data-el="error" hidden>口令不正确</div>
  </section>`;

  qs('[data-el="form"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = e.target.elements.pass.value;
    if (pass === CONFIG.adminPass) {
      unlocked = true;
      sessionStorage.setItem('qs.admin', '1');
      render();
    } else {
      qs('[data-el="error"]').hidden = false;
    }
  });
}

/* ---------------- 面板 ---------------- */

function renderPanel() {
  const isLocalHost = ['localhost', '127.0.0.1', ''].includes(location.hostname);

  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">数据管理</p>
    <h2>作答数据</h2>
    <p class="muted">
      存储方式：<b>${driver === 'local' ? '本机浏览器（localStorage）' : 'Supabase 云端'}</b>
      ${driver === 'local' ? '，只会显示这台电脑这个浏览器里产生的数据。' : '。'}
    </p>
    ${driver === 'local' && !isLocalHost
      ? '<div class="alert alert-danger">当前还是本机存储模式，被试的作答只会留在他们自己的手机里，你收不到。正式发放前请按 README 切换到 Supabase。</div>'
      : ''}
    ${driver === 'supabase'
      ? '<div class="alert">云端模式下，本页不再直接读取数据（避免网页端的密钥能看全部作答）。请在 Supabase 后台导出，或查看数据备份仓库。</div>'
      : ''}
    <div class="stat-grid" data-el="stats"></div>
    <div class="row">
      <button class="btn btn-primary" data-act="csv">导出 CSV</button>
      <button class="btn btn-ghost" data-act="json">导出 JSON</button>
      <button class="btn btn-ghost" data-act="reload">刷新</button>
    </div>
    <div class="row">
      <button class="btn btn-ghost" data-act="clear" ${driver === 'local' ? '' : 'disabled'}>清空本机数据</button>
    </div>
    <div class="alert" data-el="msg" hidden></div>
  </section>

  <section class="card">
    <h3>记录列表</h3>
    <div class="table-wrap" data-el="table"></div>
    <p class="hint">表格只显示最近 50 条，完整数据请导出 CSV / JSON。</p>
  </section>`;

  qs('[data-act="csv"]').addEventListener('click', () => exportCSV());
  qs('[data-act="json"]').addEventListener('click', () => exportJSON());
  qs('[data-act="reload"]').addEventListener('click', () => load());
  qs('[data-act="clear"]').addEventListener('click', clearAll);

  load();
}

async function load() {
  try {
    records = await store.listRecords();
    records.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    renderStats();
    renderTable();
  } catch (err) {
    records = [];
    renderStats();
    const wrap = qs('[data-el="table"]');
    if (wrap) wrap.innerHTML = `<p class="muted" style="padding:16px">${esc(err.message || String(err))}</p>`;
  }
}

function renderStats() {
  const done1 = records.length;
  const done2 = records.filter((r) => r.test2).length;
  const groupCount = {};
  records.forEach((r) => {
    const name = r.test1?.group || '未分组';
    groupCount[name] = (groupCount[name] || 0) + 1;
  });
  const typeLine = Object.entries(groupCount).map(([k, v]) => `${k} ${v}`).join(' / ') || '—';

  const stats = qs('[data-el="stats"]');
  if (!stats) return;
  stats.innerHTML = `
    <div class="stat"><b>${done1}</b><span>完成一测</span></div>
    <div class="stat"><b>${done2}</b><span>完成二测</span></div>
    <div class="stat"><b>${done1 ? Math.round((done2 / done1) * 100) : 0}%</b><span>二测完成率</span></div>
    <div class="stat"><b style="font-size:13px;line-height:1.5">${esc(typeLine)}</b><span>分组分布</span></div>`;
}

const ARM_NAME = { exp: '实验组', general: '通用组', control: '对照组' };

function groupCell(t1) {
  if (t1.eligible === false) return '未入组';
  if (!t1.group) return '—';
  return t1.arm ? `${t1.group}（${ARM_NAME[t1.arm] || t1.arm}）` : t1.group;
}

function big5Cell(t1) {
  const dims = t1.scores?.bfi || {};
  const keys = ['E', 'A', 'C', 'N', 'O'];
  if (!keys.some((k) => typeof dims[k] === 'number')) return '—';
  const levels = t1.big5?.levels || {};
  const body = keys
    .filter((k) => typeof dims[k] === 'number')
    .map((k) => `${k}${dims[k]}${levels[k] ? `(${levels[k]})` : ''}`)
    .join(' ');
  const dom = t1.big5?.dominantName;
  return dom ? `${body} · 主导 ${dom}` : body;
}

function renderTable() {
  const wrap = qs('[data-el="table"]');
  if (!wrap) return;
  if (!records.length) {
    wrap.innerHTML = '<p class="muted" style="padding:16px">暂无数据。</p>';
    return;
  }

  const rows = records.slice(-50).reverse().map((r) => {
    const t1 = r.test1 || {};
    const hasT2 = Boolean(r.test2);
    const video = t1.video?.ended ? '已看完' : (t1.video?.skipped ? '已跳过' : '—');
    const aN = Object.keys(t1.answers || {}).length;
    const bN = Object.keys(t1.answersB || {}).length;
    const cN = Object.keys(r.test2?.answers || {}).length;
    const answerCell = `A${aN} / B${bN}${cN ? ` / C${cN}` : ''}`;
    return `<tr>
      <td class="mono">${esc(r.code)}${r.orphan ? ' <span class="badge wait">孤立</span>' : ''}</td>
      <td>${esc(groupCell(t1))}</td>
      <td>${esc(t1.profile?.label || '—')}</td>
      <td>${esc(big5Cell(t1))}</td>
      <td>${esc(fmtTime(r.createdAt))}</td>
      <td>${hasT2 ? '<span class="badge ok">已完成</span>' : '<span class="badge wait">未完成</span>'}</td>
      <td>${esc(video)}</td>
      <td>${esc(answerCell)}</td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table class="data">
    <thead><tr><th>编号</th><th>分组</th><th>画像</th><th>大五判定</th><th>一测存入时间</th><th>二测</th><th>视频</th><th>已存题数</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ---------------- 导出 ---------------- */

function answerText(bank, qid, value) {
  if (value === undefined || value === null || value === '') return '';
  const q = bank.questions.find((x) => x.id === qid);
  if (q?.options) {
    const vals = Array.isArray(value) ? value : [value];
    return vals
      .map((v) => {
        const opt = q.options.find((o, i) => Number(o.value ?? i + 1) === Number(v));
        return opt?.text ?? v;
      })
      .join(' | ');
  }
  return Array.isArray(value) ? value.join('|') : value;
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCSV() {
  const qA = bankA.questions.map((q) => q.id);
  const qT2 = bankT2.questions.map((q) => q.id);

  const header = [
    '编号', '分组', '一测存入时间', '一测开始', '一测结束', '一测用时(秒)',
    'BFI_E', 'BFI_A', 'BFI_C', 'BFI_N', 'BFI_O', 'CRT', 'STAI', 'CSSTNFQ_T1', '注意力通过',
    '视频状态', '视频观看(秒)',
    ...qA.map((id) => `一测_${id}`),
    '二测开始', '二测结束', '二测用时(秒)', 'CSSTNFQ_T3',
    ...qT2.map((id) => `二测_${id}`),
  ];

  const lines = records.map((r) => {
    const t1 = r.test1 || {};
    const t2 = r.test2 || {};
    const s = t1.scores || {};
    const video = t1.video?.ended ? '看完' : (t1.video?.skipped ? '跳过' : '未看完');
    return [
      r.code,
      t1.group || '',
      fmtTime(r.createdAt),
      fmtTime(t1.startedAt),
      fmtTime(t1.finishedAt),
      seconds(t1.startedAt, t1.finishedAt),
      s.bfi?.E ?? '', s.bfi?.A ?? '', s.bfi?.C ?? '', s.bfi?.N ?? '', s.bfi?.O ?? '',
      s.crt?.total ?? '', s.stai?.total ?? '', s.csstnfqT1?.total ?? '',
      t1.attention?.passed ?? '',
      video,
      t1.video?.watched ? Math.round(t1.video.watched) : '',
      ...qA.map((id) => answerText(bankA, id, t1.answers?.[id])),
      fmtTime(t2.startedAt),
      fmtTime(t2.finishedAt),
      seconds(t2.startedAt, t2.finishedAt),
      t2.scores?.csstnfqT3?.total ?? '',
      ...qT2.map((id) => answerText(bankT2, id, t2.answers?.[id])),
    ].map(csvCell).join(',');
  });

  return '\ufeff' + [header.map(csvCell).join(','), ...lines].join('\r\n');
}

function exportCSV() {
  if (!records.length) return showMsg('还没有数据可以导出。');
  download(`问卷数据_${stamp()}.csv`, buildCSV(), 'text/csv;charset=utf-8');
  showMsg(`已导出 ${records.length} 条记录。`);
}

function exportJSON() {
  if (!records.length) return showMsg('还没有数据可以导出。');
  download(`问卷数据_${stamp()}.json`, JSON.stringify(records, null, 2), 'application/json');
  showMsg(`已导出 ${records.length} 条记录。`);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function clearAll() {
  if (!confirm('确定要清空本机保存的所有编号和作答数据吗？此操作不可恢复。')) return;
  await store.clearAll();
  progress.clear('test1');
  progress.clear('test2');
  records = [];
  renderStats();
  renderTable();
  showMsg('已清空本机数据。');
}

/* ---------------- 工具 ---------------- */

function showMsg(text, isError = false) {
  const el = qs('[data-el="msg"]');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('alert-danger', isError);
  el.hidden = false;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function seconds(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : '';
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

render();
