import { CONFIG } from './config.js';
import { bankA } from './surveyA.js';
import { bankBFor, A1_CORRECT_COLOR } from './surveyB.js';
import { Quiz, esc } from './engine.js';
import {
  answerLabels, scoreBFI, scoreCRT, scoreCSSTNFQ,
  scoreSTAI6, scoreCRTParallel, scoreManipulation,
  codeDemo, scoreAttention, assignVideo, parseAnswerNumber, classifyBigFive,
} from './scoring.js';
import { generateUniqueCode } from './code.js';
import { store, progress, driver } from './storage.js';

const app = document.getElementById('app');
const KEY = 'test1';
const qs = (sel, root = app) => root.querySelector(sel);
const nowISO = () => new Date().toISOString();
const delayDays = Number(CONFIG.flow.test2DelayDays) || 0;

const VIDEO_BY_GROUP = {
  'V-A': { title: '请观看下面这段视频', src: 'assets/videos/video-1.mp4' },
  'V-B': { title: '请观看下面这段视频', src: 'assets/videos/video-2.mp4' },
  'V-C': { title: '请观看下面这段视频', src: 'assets/videos/video-3.mp4' },
  'V-N': { title: '请观看下面这段视频', src: 'assets/videos/video-4.mp4' },
};

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeState() {
  return {
    step: 'intro',
    startedAt: null,
    finishedAt: null,
    answers: {},
    answerSeconds: {},
    page: 0,
    scores: null,
    attention: null,
    group: null,
    arm: null,
    profile: null,
    eligible: null,
    video: null,
    answersB: {},
    answerSecondsB: {},
    pageB: 0,
    timings: {},
    submissionId: null,
    code: null,
    saved: false,
    saveError: '',
  };
}

let state = Object.assign(makeState(), progress.load(KEY) || {});
const save = () => progress.save(KEY, state);

function render() {
  window.scrollTo(0, 0);
  switch (state.step) {
    case 'survey': return renderSurvey();
    case 'video': return renderVideo();
    case 't2': return renderSurveyB();
    case 'code': return renderCode();
    default: return renderIntro();
  }
}

/* ---------------- 步骤 0：说明 ---------------- */

function renderIntro() {
  app.innerHTML = `
  <section class="card hero">
    <p class="eyebrow">第一次参与</p>
    <h1>${esc(CONFIG.studyTitle)}</h1>
    <p class="lead">${esc(CONFIG.studyIntro)}</p>
    <ul class="facts">
      <li><b>这一部分</b><span>几组问卷，约 12 分钟</span></li>
      <li><b>接着</b><span>观看一段短视频</span></li>
      <li><b>然后</b><span>再填一份问卷，约 4 分钟</span></li>
      <li><b>结束后</b><span>生成 16 位编号，${delayDays > 0 ? `${delayDays} 天后凭编号参加第二次` : '可随时凭编号参加第二次'}</span></li>
    </ul>
    <button class="btn btn-primary btn-block" data-act="start">开始作答</button>
    <p class="hint">作答过程请尽量一次完成；如果中途刷新或关闭页面，重新打开会接着上次的进度。</p>
  </section>`;

  qs('[data-act="start"]').addEventListener('click', () => {
    state.startedAt = state.startedAt || nowISO();
    state.step = 'survey';
    save();
    render();
  });
}

/* ---------------- 步骤 1：五段问卷（只显示指导语） ---------------- */

function renderSurvey() {
  app.innerHTML = `
  <section class="card">
    <div id="quiz"></div>
  </section>`;

  new Quiz({
    bank: bankA,
    container: qs('#quiz'),
    answers: state.answers,
    answerSeconds: state.answerSeconds,
    page: state.page,
    pageSize: bankA.pageSize,
    onChange: (answers) => {
      state.answers = answers;
      maybeAssignGroup(answers);
      save();
    },
    onTiming: (seconds) => { state.answerSeconds = seconds; save(); },
    onPage: (page) => { state.page = page; save(); },
    onComplete: (answers) => {
      state.answers = answers;
      state.timings.surveyFinishedAt = nowISO();
      scoreAndAssign();
      if (state.eligible === false) {
        state.timings.surveyFinishedAt = nowISO();
        save();
        finishTest();
        return;
      }
      state.timings.videoStartedAt = nowISO();
      state.step = 'video';
      save();
      render();
    },
  });
}

/**
 * BFI 一答完就分流，不等整份问卷结束 —— 人口学及其后的问卷都不参与分组。
 * 只分一次：被试回头改 BFI 答案也不会重分。
 */
function maybeAssignGroup(answers) {
  if (state.group) return;

  const bfiSection = bankA.sections.find((s) => s.key === 'bfi');
  const bfiIds = bfiSection.questions.filter((q) => q.id.startsWith('BFI')).map((q) => q.id);
  if (!bfiIds.every((id) => answers?.[id] !== undefined)) return;

  const { dims } = scoreBFI(answers);
  state.big5 = classifyBigFive(dims);
  applyAssignment(dims);
  state.groupDims = dims;
  state.groupAssignedAt = nowISO();
}

/** 按《匹配规则》定画像、随机分组、定视频；都不满足则不入组。 */
function applyAssignment(dims) {
  const res = assignVideo(dims);
  if (!res) return;
  state.profile = res.profile;
  state.arm = res.arm;
  state.group = res.group;
  state.eligible = res.eligible;
}

function scoreAndAssign() {
  const a = state.answers;
  const bfi = scoreBFI(a);
  state.scores = {
    bfi: bfi.dims,
    demo: codeDemo(a),
    crt: scoreCRT(a),
    stai6T1: scoreSTAI6(a),
    csstnfqT1: scoreCSSTNFQ(a),
  };
  state.attention = scoreAttention(bankA, a);
  if (!state.big5) state.big5 = classifyBigFive(bfi.dims);
  if (state.eligible === null || state.eligible === undefined) {
    applyAssignment(bfi.dims);
    state.groupDims = bfi.dims;
    state.groupAssignedAt = nowISO();
  }
}

/* ---------------- 步骤 2：视频（对照组跳过） ---------------- */

function renderVideo() {
  const conf = VIDEO_BY_GROUP[state.group] || null;

  if (!state.video) {
    state.video = {
      group: state.group,
      src: conf?.src || '',
      title: conf?.title || '',
      ended: false,
      skipped: false,
      watched: 0,
    };
    save();
  }

  const v = state.video;
  const requireWatch = CONFIG.flow.requireFullVideo && Boolean(v.src);
  const canProceed = !requireWatch || v.ended || v.skipped;

  app.innerHTML = `
  <section class="card">
    <h2>${esc(conf?.title || '请观看下面这段视频')}</h2>
    <p class="muted">请完整观看视频，播放结束后再点击下面的按钮。</p>
    ${v.src
      ? `<div class="video-wrap"><video id="video" src="${esc(v.src)}" controls playsinline preload="metadata"></video></div>`
      : '<div class="video-missing">视频文件还没有配置，请联系主试。</div>'}
    <div class="alert ${v.ended || v.skipped ? 'alert-ok' : ''}" data-el="alert" ${v.ended || v.skipped ? '' : 'hidden'}>
      ${v.skipped ? '已跳过视频，请稍后联系主试补看。' : '视频已观看完毕。'}
    </div>
    <button class="btn btn-primary btn-block" data-act="afterVideo" ${canProceed ? '' : 'disabled'}>看完了，继续</button>
    <p class="hint center"><button type="button" class="linkish" data-act="videoHelp">视频无法播放？</button></p>
  </section>`;

  const nextBtn = qs('[data-act="afterVideo"]');
  nextBtn.addEventListener('click', () => {
    state.step = 't2';
    save();
    render();
  });

  qs('[data-act="videoHelp"]').addEventListener('click', handleVideoError);

  const video = qs('#video');
  if (video) {
    video.addEventListener('timeupdate', () => {
      if (video.currentTime > (state.video.watched || 0)) state.video.watched = video.currentTime;
    });
    video.addEventListener('ended', () => {
      state.video.ended = true;
      state.timings.videoFinishedAt = state.timings.videoFinishedAt || nowISO();
      save();
      nextBtn.disabled = false;
      const alertEl = qs('[data-el="alert"]');
      if (alertEl) {
        alertEl.hidden = false;
        alertEl.classList.add('alert-ok');
        alertEl.textContent = '视频已观看完毕。';
      }
    });
    video.addEventListener('error', handleVideoError);
  }
}

function handleVideoError() {
  const alertEl = qs('[data-el="alert"]');
  if (CONFIG.flow.videoFallback === 'allow') {
    state.video.skipped = true;
    state.timings.videoFinishedAt = state.timings.videoFinishedAt || nowISO();
    save();
    const nextBtn = qs('[data-act="afterVideo"]');
    if (nextBtn) nextBtn.disabled = false;
    if (alertEl) {
      alertEl.hidden = false;
      alertEl.textContent = '视频加载失败，已允许继续。请稍后联系主试补看。';
    }
  } else if (alertEl) {
    alertEl.hidden = false;
    alertEl.textContent = '视频加载失败，请检查网络后刷新页面；如果仍然无法播放，请联系主试。';
  }
}

/* ---------------- 步骤 3：视频后四份问卷（题库B） ---------------- */

function renderSurveyB() {
  const bBank = bankBFor(state.group);
  app.innerHTML = `
  <section class="card">
    <div id="quiz"></div>
  </section>`;

  new Quiz({
    bank: bBank,
    container: qs('#quiz'),
    answers: state.answersB,
    answerSeconds: state.answerSecondsB,
    page: state.pageB,
    pageSize: bBank.pageSize || 8,
    onChange: (answers) => { state.answersB = answers; save(); },
    onTiming: (seconds) => { state.answerSecondsB = seconds; save(); },
    onPage: (page) => { state.pageB = page; save(); },
    onComplete: (answers) => {
      state.answersB = answers;
      state.scores.manip = scoreManipulation(answers, { a1CorrectColor: A1_CORRECT_COLOR });
      state.scores.stai6T2 = scoreSTAI6(answers);
      state.scores.crt2 = scoreCRTParallel(answers);
      state.scores.csstnfqT2 = scoreCSSTNFQ(answers);
      state.attentionB = scoreAttention(bBank, answers);
      state.timings.bankBFinishedAt = nowISO();
      save();
      finishTest();
    },
  });
}

/* ---------------- 提交 ---------------- */

function buildRecord() {
  const bBank = bankBFor(state.group);
  return {
    submissionId: state.submissionId,
    code: state.code,
    createdAt: state.startedAt || nowISO(),
    finishedAt: state.finishedAt || nowISO(),
    group: state.group,
    arm: state.arm || null,
    eligible: state.eligible === null || state.eligible === undefined ? null : state.eligible,
    profile: state.profile || null,
    big5: state.big5 || null,
    groupDims: state.groupDims || null,
    groupAssignedAt: state.groupAssignedAt || null,
    answers: state.answers,
    answerText: answerLabels(bankA, state.answers),
    answerSeconds: state.answerSeconds,
    answersB: state.answersB,
    answerTextB: answerLabels(bBank, state.answersB),
    answerSecondsB: state.answerSecondsB,
    scores: state.scores,
    attention: state.attention,
    attentionB: state.attentionB || null,
    ageInput: state.answers?.D2 ?? null,
    age: parseAnswerNumber(state.answers?.D2),
    video: state.video,
    bankVersion: { A: bankA.version, B: bBank.version },
    timings: state.timings,
    meta: {
      ua: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      lang: navigator.language,
      storage: driver,
    },
  };
}

function reasonText(reason) {
  if (reason === 'invalid_code') return '编号格式不正确';
  if (reason === 'code_exists') return '编号冲突，请刷新后重试';
  return '服务器暂时不可用，请稍后重试';
}

async function finishTest() {
  state.step = 'code';
  state.finishedAt = state.finishedAt || nowISO();
  state.submissionId = state.submissionId || makeId();
  save();

  if (state.saved) {
    render();
    return;
  }

  for (let attempt = 0; attempt < 5 && !state.saved; attempt += 1) {
    try {
      if (!state.code) {
        state.code = await generateUniqueCode({
          isTaken: (candidate) => store.codeExists(candidate),
        });
        save();
      }

      const result = await store.submitTest1(buildRecord());

      if (result.ok) {
        state.saved = true;
        state.saveError = '';
        break;
      }

      if (result.reason === 'code_exists') {
        state.code = null;
        save();
        continue;
      }

      state.saveError = `编号保存失败：${reasonText(result.reason)}`;
      break;
    } catch (err) {
      console.error(err);
      state.saveError = `数据保存失败：${err.message || err}`;
      break;
    }
  }

  if (!state.saved && !state.saveError) {
    state.saveError = '编号保存失败：多次生成都发生冲突，请刷新后重试';
  }

  save();
  render();
}

/* ---------------- 步骤 4：编号 ---------------- */

function renderCode() {
  const sameDevice = driver === 'local';

  if (!state.saved) {
    app.innerHTML = `
    <section class="card">
      <p class="eyebrow">已完成</p>
      <h2>正在保存编号</h2>
      <p class="muted">你的作答已经完成，正在把编号和作答写入服务器，请不要关闭页面。</p>
      ${state.saveError ? `<div class="alert alert-danger">${esc(state.saveError)}</div>` : '<div class="alert">正在保存，请稍候…</div>'}
      <button class="btn btn-primary btn-block" data-act="retry">重试保存</button>
      <p class="hint">如果多次失败，请截图本页并联系主试。</p>
    </section>`;

    qs('[data-act="retry"]').addEventListener('click', () => {
      state.saveError = '';
      save();
      finishTest();
    });
    return;
  }

  if (state.eligible === false) {
    app.innerHTML = `
  <section class="card center">
    <div class="done-mark">✓</div>
    <h2>本次参与结束，感谢你</h2>
    <p class="muted">你的作答已匿名保存（编号 <b class="mono">${esc(state.code)}</b>），仅用于学术分析。<br>
      本次不需要再参加后续环节，可以关闭本页面了。</p>
    <p class="hint">如有疑问，请联系主试。</p>
    <button class="btn btn-ghost" data-act="leave">完成</button>
  </section>`;

    qs('[data-act="leave"]').addEventListener('click', () => {
      progress.clear(KEY);
      location.href = './index.html';
    });
    return;
  }

  app.innerHTML = `
  <section class="card">
    <p class="eyebrow">已完成</p>
    <h2>请保存你的专属编号</h2>
    <p class="muted">这个 16 位编号是参加下一次问卷的唯一凭证，请立即截图或复制保存。本次作答已一并保存。</p>
    <div class="code-box"><span id="my-code">${esc(state.code)}</span></div>
    <div class="row">
      <button class="btn btn-ghost" data-act="copy">复制编号</button>
      <a class="btn btn-primary" href="./test2.html?code=${encodeURIComponent(state.code)}">前往第二次问卷</a>
    </div>
    <p class="hint">
      ${sameDevice ? '当前是本机存储模式，第二次问卷需要在同一台设备的同一个浏览器里完成。' : ''}
      ${delayDays > 0
        ? `第二次问卷需要在此次完成 ${delayDays} 天后才能进入，到时候凭这个编号参加。`
        : '第二次问卷随时可以凭这个编号参加。'}
    </p>
    <p class="hint center"><button type="button" class="linkish" data-act="restart">我是下一位被试，重新开始</button></p>
  </section>`;

  qs('[data-act="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      toast('编号已复制');
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(qs('#my-code'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('请长按选中后手动复制');
    }
  });

  qs('[data-act="restart"]').addEventListener('click', () => {
    if (!confirm('重新开始会清空本次未提交的作答（已经保存的记录不受影响），确定吗？')) return;
    progress.clear(KEY);
    state = makeState();
    render();
  });
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// 刷新恰好发生在“编号还没写入”的瞬间时，自动继续保存
if (state.step === 'code' && !state.saved) {
  finishTest();
} else {
  render();
}
