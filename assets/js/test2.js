import { CONFIG } from './config.js';
import { bankC, DEBRIEF } from './surveyC.js';
import { Quiz, esc } from './engine.js';
import { answerLabels, scoreCSSTNFQ, scoreAttention } from './scoring.js';
import { normalizeCode, isValidFormat } from './code.js';
import { store, progress, driver, formatWait } from './storage.js';

const app = document.getElementById('app');
const KEY = 'test2';
const qs = (sel, root = app) => root.querySelector(sel);
const params = new URLSearchParams(location.search);
const nowISO = () => new Date().toISOString();
const delayDays = Number(CONFIG.flow.test2DelayDays) || 0;

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeState() {
  return {
    step: 'code',
    code: '',
    input: '',
    answersC: {},
    answerSecondsC: {},
    pageC: 0,
    startedAt: null,
    finishedAt: null,
    submissionId: null,
    error: '',
    saveError: '',
  };
}

let state = Object.assign(makeState(), progress.load(KEY) || {});
if (!state.input && params.get('code')) state.input = normalizeCode(params.get('code'));
const save = () => progress.save(KEY, state);

function render() {
  window.scrollTo(0, 0);
  switch (state.step) {
    case 'bankC': return renderBankC();
    case 'done': return renderDone();
    case 'missing': return renderMissing();
    case 'saveError': return renderSaveError();
    default: return renderCodeEntry();
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resetToEntry(message = '') {
  const keep = state.code || state.input;
  state = Object.assign(makeState(), { input: keep, error: message });
  save();
  render();
}

/* ---------------- 步骤 1：输入编号 ---------------- */

function renderCodeEntry() {
  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">二测 · 第二次参与</p>
    <h2>输入你的一测编号</h2>
    <p class="muted">编号共 16 位，由字母和数字组成，在完成一测后生成。
      ${delayDays > 0 ? `一测完成 ${delayDays} 天后才能进入二测。` : ''}</p>
    <form class="code-form" data-el="form" novalidate>
      <input class="code-input" name="code" type="text" inputmode="latin"
        autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="24"
        placeholder="请输入 16 位编号" value="${esc(state.input || '')}">
      <button class="btn btn-primary" type="submit" data-act="verify">验证并进入</button>
    </form>
    <div class="alert alert-danger" data-el="error" ${state.error ? '' : 'hidden'}>${esc(state.error || '')}</div>
    <p class="hint">找不到编号？请确认是否完整复制。${driver === 'local' ? '当前是本机存储模式，需要在一测的同一台设备、同一个浏览器里打开。' : ''}</p>
  </section>`;

  const form = qs('[data-el="form"]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    verify(form.elements.code.value);
  });

  if (state.input) {
    const input = form.elements.code;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function gateMessage(res) {
  const days = delayDays || 7;
  if (res.reason === 'not_found') {
    return driver === 'local'
      ? '未找到该编号。请确认使用的是完成一测的同一台设备、同一个浏览器。'
      : '未找到该编号，请确认是否输入正确。';
  }
  if (res.reason === 'not_eligible') return '这个编号在第一次作答后未进入后续环节，不需要参加这次问卷。如有疑问请联系主试。';
  if (res.reason === 'already_done') return '该编号已经完成过二测，不需要重复作答。';
  if (res.reason === 'invalid_code') return '编号格式不正确：应为 16 位字母或数字（不含 I、O、0、1）。';
  if (res.reason === 'too_early') {
    const ready = res.createdAt
      ? new Date(new Date(res.createdAt).getTime() + days * 86400000).toISOString()
      : '';
    return `一测完成还没满 ${days} 天，还需等待 ${formatWait(res.waitSeconds)}`
      + (ready ? `（${fmtDate(ready)} 之后可以参加）。` : '。');
  }
  return '暂时无法验证编号，请稍后再试。';
}

async function verify(raw) {
  const code = normalizeCode(raw);
  state.input = code;
  state.error = '';

  const btn = qs('[data-act="verify"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '验证中…';
  }

  try {
    if (!isValidFormat(code)) {
      throw new Error('编号格式不正确：应为 16 位字母或数字（不含 I、O、0、1）。');
    }

    const status = await store.checkTest2(code);
    if (!status.ok) throw new Error(gateMessage(status));

    state.code = code;
    state.step = 'bankC';
    state.startedAt = nowISO();
    state.submissionId = makeId();
    state.answersC = {};
    state.pageC = 0;
    state.error = '';
    save();
    render();
  } catch (err) {
    state.error = err.message || String(err);
    save();
    render();
  }
}

/* ---------------- 步骤 2：题库 C ---------------- */

function renderBankC() {
  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">第二次参与 · 编号 ${esc(state.code)}</p>
    <div id="quiz"></div>
  </section>`;

  new Quiz({
    bank: bankC,
    container: qs('#quiz'),
    answers: state.answersC,
    answerSeconds: state.answerSecondsC,
    page: state.pageC,
    pageSize: bankC.pageSize || 8,
    onChange: (answers) => { state.answersC = answers; save(); },
    onTiming: (seconds) => { state.answerSecondsC = seconds; save(); },
    onPage: (page) => { state.pageC = page; save(); },
    onComplete: (answers) => {
      state.answersC = answers;
      save();
      submitC();
    },
  });
}

async function submitC() {
  state.saveError = '';
  save();

  if (!state.submissionId) state.submissionId = makeId();

  const finishedAt = nowISO();
  const payload = {
    submissionId: state.submissionId,
    code: state.code,
    startedAt: state.startedAt,
    finishedAt,
    answers: state.answersC,
    answerText: answerLabels(bankC, state.answersC),
    answerSeconds: state.answerSecondsC,
    scores: { csstnfqT3: scoreCSSTNFQ(state.answersC) },
    attention: scoreAttention(bankC, state.answersC),
    bankVersion: bankC.version,
    meta: {
      ua: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      lang: navigator.language,
      storage: driver,
    },
  };

  let lastError = '';

  // 自动重试，不询问用户是否保存
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await store.submitTest2(state.code, payload);

      if (result.ok) {
        state.step = 'done';
        state.finishedAt = finishedAt;
        state.saveError = '';
        save();
        render();
        return;
      }

      if (result.reason === 'not_found') {
        state.step = 'missing';
        save();
        render();
        return;
      }

      if (result.reason === 'already_done') {
        resetToEntry('该编号已经完成过二测，不需要重复作答。');
        return;
      }

      if (result.reason === 'too_early') {
        resetToEntry(gateMessage(result));
        return;
      }

      lastError = result.reason || '未知状态';
    } catch (err) {
      lastError = err.message || String(err);
    }

    if (attempt < 3) await sleep(attempt * 1200);
  }

  state.step = 'saveError';
  state.saveError = `已自动重试 3 次仍未保存成功${lastError ? `（${lastError}）` : ''}。`;
  save();
  render();
}

/* ---------------- 步骤 3：完成 / 保存失败 ---------------- */

function renderDone() {
  app.innerHTML = `
  <section class="card center">
    <div class="done-mark">✓</div>
    <h2>全部完成，感谢你的参与</h2>
    <p class="muted">你的编号是：<b class="mono">${esc(state.code)}</b><br>本次作答已记录。</p>
    <div class="debrief">
      <h3>事后解说</h3>
      <p>${esc(DEBRIEF)}</p>
    </div>
    <p class="hint">你可以关闭本页面了。如有疑问，请联系主试。</p>
    <button class="btn btn-ghost" data-act="leave">完成</button>
  </section>`;

  qs('[data-act="leave"]').addEventListener('click', () => {
    progress.clear(KEY);
    location.href = './index.html';
  });
}

function renderMissing() {
  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">二测</p>
    <h2>找不到这个编号对应的一测记录</h2>
    <p class="muted">编号：<b class="mono">${esc(state.code || '—')}</b></p>
    <p>可能的原因：</p>
    <ul class="facts">
      <li><b>设备</b><span>一测是在另一台设备或另一个浏览器里完成的</span></li>
      <li><b>地址</b><span>这次打开用的网址和上次不一样（例如 localhost 与 127.0.0.1）</span></li>
      <li><b>数据</b><span>浏览器数据被清理过，或一测没有保存成功</span></li>
    </ul>
    <p class="muted">${driver === 'local'
      ? '当前是本机存储模式，二测必须用完成一测的那台设备、那个浏览器打开。'
      : '如果确认编号无误，请联系主试核对后台记录。'}</p>
    <button class="btn btn-primary btn-block" data-act="leave">返回首页</button>
  </section>`;

  qs('[data-act="leave"]').addEventListener('click', () => {
    progress.clear(KEY);
    location.href = './index.html';
  });
}

function renderSaveError() {
  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">二测</p>
    <h2>数据还没保存成功</h2>
    <div class="alert alert-danger">${esc(state.saveError || '未知错误')}</div>
    <p class="muted">你的作答仍保存在本机，没有丢失。页面会自动重试；也可以检查网络后手动再试一次。</p>
    <button class="btn btn-primary btn-block" data-act="retry">重新尝试</button>
  </section>`;

  qs('[data-act="retry"]').addEventListener('click', submitC);
}

/**
 * 恢复进度前先核对编号：避免“旧进度 + 本机没有记录”时，
 * 被试答完 C 才在保存阶段看到报错。
 */
async function boot() {
  if (state.step === 'code' || state.step === 'done' || state.step === 'missing') {
    render();
    return;
  }

  if (!state.code) {
    resetToEntry();
    return;
  }

  try {
    const status = await store.checkTest2(state.code);

    if (status.ok) {
      render();
      return;
    }

    if (status.reason === 'already_done') {
      resetToEntry('该编号已经完成过二测，不需要重复作答。');
      return;
    }

    if (status.reason === 'too_early') {
      resetToEntry(gateMessage(status));
      return;
    }

    resetToEntry('没有找到这个编号对应的一测记录，请重新输入编号。');
  } catch (_) {
    // 网络异常时保留原页面，用户仍可重试保存
    render();
  }
}

boot();
