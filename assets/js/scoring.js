/**
 * 计分：两种题型都支持
 * 1) Likert 量表题：题目上写 dim（维度）和 reverse（是否反向计分）
 * 2) 选择题：选项上写 score: { 维度: 分值 }
 * 返回每个维度的平均分（1~5 分制下，3 分是中间值）。
 */
export function scoreBank(bank, answers) {
  const sums = {};
  const counts = {};

  (bank.dimensions || []).forEach((d) => {
    sums[d.key] = 0;
    counts[d.key] = 0;
  });

  const scaleValues = (bank.scale || []).map((s) => Number(s.value)).filter((v) => !Number.isNaN(v));
  const min = scaleValues.length ? Math.min(...scaleValues) : 1;
  const max = scaleValues.length ? Math.max(...scaleValues) : 5;

  for (const q of bank.questions || []) {
    const raw = answers?.[q.id];
    if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
      continue;
    }

    if (q.options) {
      const picked = Array.isArray(raw) ? raw : [raw];
      for (const idx of picked) {
        const score = q.options[Number(idx)]?.score || {};
        for (const [key, value] of Object.entries(score)) {
          sums[key] = (sums[key] || 0) + Number(value);
          counts[key] = (counts[key] || 0) + 1;
        }
      }
      continue;
    }

    if (!q.dim) continue;
    let value = Number(raw);
    if (Number.isNaN(value)) continue;
    if (q.reverse) value = min + max - value;
    sums[q.dim] = (sums[q.dim] || 0) + value;
    counts[q.dim] = (counts[q.dim] || 0) + 1;
  }

  const dims = {};
  for (const key of Object.keys(sums)) {
    dims[key] = counts[key] ? sums[key] / counts[key] : 0;
  }
  return dims;
}

/** 人格判定：由题库自带的 classify(dims, answers) 决定，返回类型 key。 */
export function classify(bank, dims, answers) {
  if (typeof bank.classify !== 'function') return null;
  return bank.classify(dims, answers) ?? null;
}

/**
 * 把作答值翻译成被试当时看到的文字。
 * 数据库里只存选项序号/分值，题库一改序号含义就变了，所以提交时一并存文字。
 */
export function answerLabels(bank, answers) {
  const out = {};
  for (const q of bank.questions || []) {
    const raw = answers?.[q.id];
    if (raw === undefined || raw === null || raw === '') continue;

    if (q.options) {
      const picked = Array.isArray(raw) ? raw : [raw];
      out[q.id] = picked
        .map((v) => {
          const opt = (q.options || []).find((o, i) => Number(o.value ?? i + 1) === Number(v));
          return opt?.text ?? opt?.label ?? String(v);
        })
        .join(' / ');
    } else {
      const v = Number(raw);
      out[q.id] = (bank.scale || []).find((s) => Number(s.value) === v)?.label ?? String(v);
    }
  }
  return out;
}

/* ============================================================
 * 研究一计分：规则逐条对应《题库A.docx》各段「计分」
 * ============================================================ */

const CN_DIGIT = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 把「四十七」「29 名」「0.05 元」这类作答解析成数字；解析不出返回 null。 */
export function parseAnswerNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (m) return Number(m[0]);

  let run = '';
  for (const c of s) {
    if (c in CN_DIGIT || c === '十' || c === '百') run += c;
    else if (run) break;
  }
  if (!run) return null;

  const hundreds = run.split('百');
  if (hundreds.length === 2) {
    const h = hundreds[0] ? CN_DIGIT[hundreds[0]] ?? 0 : 1;
    return h * 100 + (parseAnswerNumber(hundreds[1]) ?? 0);
  }

  const tens = run.split('十');
  if (tens.length === 2) {
    const t = tens[0] ? CN_DIGIT[tens[0]] ?? 0 : 1;
    const o = tens[1] ? CN_DIGIT[tens[1]] ?? 0 : 0;
    return t * 10 + o;
  }
  return CN_DIGIT[run] ?? null;
}

/** BFI-44：16 题反向（6−x），五个维度取条目均值。 */
export function scoreBFI(answers) {
  const DIMS = {
    E: [1, 6, 11, 16, 21, 26, 31, 36],
    A: [2, 7, 12, 17, 22, 27, 32, 37, 42],
    C: [3, 8, 13, 18, 23, 28, 33, 38, 43],
    N: [4, 9, 14, 19, 24, 29, 34, 39],
    O: [5, 10, 15, 20, 25, 30, 35, 40, 41, 44],
  };
  const REVERSE = new Set([2, 6, 8, 9, 12, 18, 21, 23, 24, 27, 31, 34, 35, 37, 41, 43]);

  const dims = {};
  const used = {};
  for (const [key, items] of Object.entries(DIMS)) {
    let sum = 0;
    let n = 0;
    const ids = [];
    for (const no of items) {
      const raw = Number(answers?.[`BFI${String(no).padStart(2, '0')}`]);
      if (Number.isNaN(raw) || raw === 0) continue;
      sum += REVERSE.has(no) ? 6 - raw : raw;
      n += 1;
      ids.push(no);
    }
    dims[key] = n ? Math.round((sum / n) * 1000) / 1000 : null;
    used[key] = { items: ids, n };
  }
  return { dims, used };
}

/** CRT-7：1–6 数值等价判定，第 7 题选 C（值 3）。 */
const CRT_RULES = [
  ['CRT1', (s, v) => Math.abs(v - 0.05) < 1e-9 || (/毛|分/.test(s) && v === 5)],
  ['CRT2', (s, v) => v === 5],
  ['CRT3', (s, v) => v === 47],
  ['CRT4', (s, v) => v === 4],
  ['CRT5', (s, v) => v === 29],
  ['CRT6', (s, v) => v === 20],
];

export function scoreCRT(answers) {
  const correct = {};
  const normalized = {};
  let total = 0;

  for (const [id, rule] of CRT_RULES) {
    const raw = answers?.[id];
    const s = String(raw ?? '').trim();
    const v = parseAnswerNumber(s);
    normalized[id] = v;
    const ok = v !== null && rule(s, v);
    correct[id] = ok;
    if (ok) total += 1;
  }

  const last = Number(answers?.CRT7);
  correct.CRT7 = last === 3;
  normalized.CRT7 = Number.isNaN(last) ? null : last;
  if (correct.CRT7) total += 1;

  return { total, correct, normalized };
}

/** CSSTNFQ：23–25 反向（6−x），25 题求和，25–125 分。 */
export function scoreCSSTNFQ(answers) {
  const REVERSE = new Set([23, 24, 25]);
  let total = 0;
  let n = 0;
  const items = {};
  for (let no = 1; no <= 25; no += 1) {
    const raw = Number(answers?.[`CS${String(no).padStart(2, '0')}`]);
    if (Number.isNaN(raw) || raw === 0) continue;
    const v = REVERSE.has(no) ? 6 - raw : raw;
    items[no] = v;
    total += v;
    n += 1;
  }
  return { total, answered: n, items };
}

/** 人口学：选项本身已按 1 起编码，年龄取数字，另存原始值。 */
export function codeDemo(answers) {
  const age = parseAnswerNumber(answers?.D2);
  return {
    sex: Number(answers?.D1) || null,
    age,
    grade: Number(answers?.D3) || null,
    major: Number(answers?.D4) || null,
    living: Number(answers?.D5) || null,
    online: Number(answers?.D6) || null,
    raw: {
      sex: answers?.D1 ?? null,
      age: answers?.D2 ?? null,
      grade: answers?.D3 ?? null,
      major: answers?.D4 ?? null,
      living: answers?.D5 ?? null,
      online: answers?.D6 ?? null,
    },
  };
}

/** 三道注意力检测题：直接与题库标注的正确值比对。 */
export function scoreAttention(bank, answers) {
  const out = {};
  let passed = 0;
  let total = 0;
  for (const q of bank.questions || []) {
    // 只统计能自动判分的注意力题；A1 那种要对照视频内容的，单独记在 manip 里
    if (typeof q.attention !== 'number') continue;
    total += 1;
    const ok = Number(answers?.[q.id]) === Number(q.attention);
    out[q.id] = ok;
    if (ok) passed += 1;
  }
  out.passed = passed;
  out.total = total;
  out.allPassed = passed === total;
  return out;
}

/**
 * 大五人格判定：五维各按理论中点 3.0 划高/低，并给出得分最高的主导维度。
 * 只用于描述与后台查看，不影响分流（分流另用 3.5 / 3.0 的操作性临界值）。
 */
export const BIG5_NAMES = { E: '外向性', A: '宜人性', C: '尽责性', N: '神经质', O: '开放性' };

export function classifyBigFive(dims, cutoff = 3.0) {
  const keys = ['E', 'A', 'C', 'N', 'O'];
  const valid = keys.filter((k) => typeof dims?.[k] === 'number');
  if (!valid.length) return null;

  const levels = {};
  for (const k of valid) levels[k] = dims[k] >= cutoff ? '高' : '低';

  const ordered = [...valid].sort((a, b) => dims[b] - dims[a]);

  return {
    cutoff,
    levels,
    dominant: ordered[0],
    dominantName: BIG5_NAMES[ordered[0]],
    profile: ordered.join('-'),
    profileName: ordered.map((k) => BIG5_NAMES[k]).join('>'),
  };
}

/**
 * 研究二入组与视频分派，规则来源《研究二_网页版人格分组实现规则》：
 *   阈值 N≥3.250（N 的第 73 百分位）、C≤3.111（C 的第 27 百分位），
 *   由研究一 v3 模拟数据（327 人）实测算出，正式施测换成本研究定标样本的分位。
 *   顺序：先随机等分三组，再在实验组内按画像分派 V-A / V-B。
 */
export const GROUP_CUTS = { nHigh: 3.25, cLow: 3.111, tieGap: 0.06 };

/** 画像判定：只高 N / 只低 C / 两者兼具 / 都不满足（不入组）。 */
export function personalityProfile(dims) {
  const n = Number(dims?.N);
  const c = Number(dims?.C);
  if (Number.isNaN(n) || Number.isNaN(c)) return null;

  const nHigh = n >= GROUP_CUTS.nHigh;
  const cLow = c <= GROUP_CUTS.cLow;

  let code = 'none';
  if (nHigh && cLow) code = 'both';
  else if (nHigh) code = 'N_only';
  else if (cLow) code = 'C_only';

  return {
    code,
    label: {
      both: '两者兼具', N_only: '只高 N', C_only: '只低 C', none: '都不满足',
    }[code],
    nHigh,
    cLow,
    exN: Math.round((n - GROUP_CUTS.nHigh) * 1000) / 1000,
    exC: Math.round((GROUP_CUTS.cLow - c) * 1000) / 1000,
  };
}

/**
 * 当场分派：先 1:1:1 随机到实验组 / 通用组 / 对照组；
 * 实验组内按画像定 V-A 或 V-B（兼具者比超出阈值的幅度，相差 ≤0.06 给 V-A）。
 * 画像为「都不满足」时不入组，group 返回 null。
 */
export function assignVideo(dims, rand = Math.random) {
  const profile = personalityProfile(dims);
  if (!profile) return null;
  if (profile.code === 'none') {
    return { profile, arm: null, group: null, eligible: false };
  }

  const r = rand();
  const arm = r < 1 / 3 ? 'exp' : r < 2 / 3 ? 'general' : 'control';

  let group;
  if (arm === 'general') group = 'V-C';
  else if (arm === 'control') group = 'V-N';
  else if (profile.code === 'N_only') group = 'V-A';
  else if (profile.code === 'C_only') group = 'V-B';
  else group = profile.exC - profile.exN > GROUP_CUTS.tieGap ? 'V-B' : 'V-A';

  return { profile, arm, group, eligible: true };
}

/* ---------------- 研究二（视频后） ---------------- */

/** STAI-6：反向题 1、4、5（5−x），6 题求和，6–24 分。 */
export function scoreSTAI6(answers) {
  const REVERSE = new Set([1, 4, 5]);
  let total = 0;
  let n = 0;
  const items = {};
  for (let no = 1; no <= 6; no += 1) {
    const raw = Number(answers?.[`S6${String(no).padStart(2, '0')}`]);
    if (Number.isNaN(raw) || raw === 0) continue;
    const v = REVERSE.has(no) ? 5 - raw : raw;
    items[no] = v;
    total += v;
    n += 1;
  }
  return { total, answered: n, items };
}

/** 平行版 CRT-7：答案 1 元 / 3 分钟 / 19 次 / 3 天 / 23 名 / 20 元 / C。 */
const CRT2_RULES = [
  ['CRT21', (s, v) => v === 1],
  ['CRT22', (s, v) => v === 3],
  ['CRT23', (s, v) => v === 19],
  ['CRT24', (s, v) => v === 3],
  ['CRT25', (s, v) => v === 23],
  ['CRT26', (s, v) => v === 20],
];

export function scoreCRTParallel(answers) {
  const correct = {};
  const normalized = {};
  let total = 0;

  for (const [id, rule] of CRT2_RULES) {
    const raw = String(answers?.[id] ?? '').trim();
    const v = parseAnswerNumber(raw);
    normalized[id] = v;
    const ok = v !== null && rule(raw, v);
    correct[id] = ok;
    if (ok) total += 1;
  }

  const last = Number(answers?.CRT27);
  correct.CRT27 = last === 3;
  normalized.CRT27 = Number.isNaN(last) ? null : last;
  if (correct.CRT27) total += 1;

  return { total, correct, normalized };
}

/**
 * 操纵检验：四个维度取均值；A1 与内容回忆的正确答案随视频内容定，
 * 未定之前只存原始作答，判分字段记 null。
 */
export function scoreManipulation(answers, opts = {}) {
  const { a1CorrectColor = null, recallCorrect = {} } = opts;

  const mean = (ids) => {
    const vals = ids
      .map((id) => Number(answers?.[id]))
      .filter((v) => !Number.isNaN(v) && v !== 0);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000 : null;
  };

  const a1 = answers?.A1;
  const a1Text = a1 === undefined ? null : ['蓝色', '红色', '绿色', '黄色'][Number(a1) - 1];
  const recall = {};
  let recallKnown = true;
  let recallTotal = 0;
  for (const id of ['C1', 'C2']) {
    const raw = Number(answers?.[id]);
    const want = recallCorrect[id];
    if (want === undefined || want === null) {
      recall[id] = null;
      recallKnown = false;
    } else {
      const ok = raw === Number(want);
      recall[id] = ok;
      if (ok) recallTotal += 1;
    }
  }

  return {
    match: mean(['M1', 'M2', 'M3']),
    loss: mean(['F1', 'F2']),
    rule: mean(['F3', 'F4']),
    reflect: mean(['H1', 'H2']),
    credibility: Number(answers?.T1) || null,
    aiSense: Number(answers?.T2) || null,
    a1: { raw: a1 ?? null, text: a1Text, correct: a1CorrectColor ? a1Text === a1CorrectColor : null },
    recall: { items: recall, total: recallKnown ? recallTotal : null, judged: recallKnown },
  };
}
