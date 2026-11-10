import test from 'node:test';
import assert from 'node:assert/strict';

import { bankA } from '../assets/js/surveyA.js';
import { bankC, DEBRIEF } from '../assets/js/surveyC.js';
import { bankBFor, A1_CORRECT_COLOR } from '../assets/js/surveyB.js';
import { CONFIG } from '../assets/js/config.js';
import {
  answerLabels, scoreBFI, scoreCRT, scoreCSSTNFQ,
  scoreSTAI6, scoreCRTParallel, scoreManipulation,
  codeDemo, scoreAttention, assignVideo, personalityProfile, GROUP_CUTS, parseAnswerNumber, classifyBigFive,
} from '../assets/js/scoring.js';
import { Quiz } from '../assets/js/engine.js';
import {
  randomCode, isValidFormat, normalizeCode, generateUniqueCode, LENGTH, CHARSET,
} from '../assets/js/code.js';

const pad = (n) => String(n).padStart(2, '0');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function allAnswers(prefix, range, value) {
  const out = {};
  for (const n of range) out[`${prefix}${pad(n)}`] = value;
  return out;
}

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/* ---------------- 题库结构 ---------------- */

test('题库：五段问卷题量与两道量表分值正确', () => {
  const ids = bankA.questions.map((q) => q.id);
  assert.equal(ids.filter((x) => x.startsWith('BFI')).length, 44);
  assert.equal(ids.filter((x) => x.startsWith('S6')).length, 6);
  assert.equal(ids.filter((x) => x.startsWith('CS')).length, 25);
  assert.equal(ids.filter((x) => x.startsWith('CRT')).length, 7);
  assert.equal(ids.filter((x) => x.startsWith('D')).length, 6);
  assert.deepEqual(ids.filter((x) => x.startsWith('AC')), ['AC1', 'AC2', 'AC3']);
  assert.equal(bankC.questions.length, 26, 'T3 是 25 题 + 1 道注意力题');
});

test('题库：页面不出现量表名称，反向标记不展示给被试', () => {
  const text = JSON.stringify(bankA.questions);
  for (const name of ['BFI', 'STAI', 'CSSTNFQ', 'CRT-7', '大五']) {
    assert.ok(!text.includes(`"text":"${name}`), `题干里不应出现 ${name}`);
  }
  for (const q of bankA.questions) {
    assert.ok(!/（反向）/.test(q.text || ''), `${q.id} 题干不应带反向标记`);
  }
  assert.ok(bankA.sections.every((s) => s.intro.startsWith('指导语')));
  assert.ok(bankA.questions.every((q) => q.note === undefined), '指导语不应挂在题目上');
});

test('分页：五套问卷各自另起一页，题号每套从 1 开始', () => {
  const stub = {
    innerHTML: '', addEventListener() {}, contains: () => true,
    querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {},
  };
  const quiz = new Quiz({ bank: bankA, container: stub });

  const starts = quiz.pages.filter((p) => p.isSectionStart);
  assert.equal(starts.length, 5, '五套问卷各有一个起始页');
  for (const p of starts) assert.equal(p.offset, 0, '起始页必须从该套第 1 题开始');

  const keys = [...new Set(quiz.pages.map((p) => p.section.key))];
  assert.deepEqual(keys, ['demo', 'bfi', 'crt', 'stai', 'css']);

  // 每套的第一题编号都是 1
  for (const p of starts) {
    const html = quiz.renderQuestion(p.questions[0], 0, p.offset);
    assert.match(html, /q-num">1\.<\/span>/, `${p.section.key} 应从 1 开始`);
  }

  // 指导语渲染在题目之前，且不在题目卡片里
  const html = stub.innerHTML;
  assert.match(html, /class="sec-intro"/);
  assert.ok(html.indexOf('sec-intro') < html.indexOf('fieldset'), '指导语要排在题目上方');
});

test('题库：反向题清单与文档一致（BFI 16 / STAI 10 / CSSTNFQ 3）', () => {
  const rev = bankA.questions.filter((q) => q.reverse).map((q) => q.id);
  assert.equal(rev.filter((x) => x.startsWith('BFI')).length, 16);
  assert.equal(rev.filter((x) => x.startsWith('S6')).length, 3);
  assert.equal(rev.filter((x) => x.startsWith('CS')).length, 3);
  for (const id of ['BFI02', 'BFI43', 'S601', 'S604', 'S605', 'CS23', 'CS25']) {
    assert.ok(rev.includes(id), `${id} 应为反向题`);
  }
  assert.ok(!rev.includes('BFI01'));
});

/* ---------------- 计分 ---------------- */

test('BFI：全选 3 分时五个维度都是 3', () => {
  const { dims } = scoreBFI(allAnswers('BFI', range(1, 44), 3));
  for (const key of ['E', 'A', 'C', 'N', 'O']) assert.equal(dims[key], 3);
});

test('BFI：反向题按 6−x 转换后计入维度均值', () => {
  const answers = allAnswers('BFI', range(1, 44), 3);
  answers.BFI02 = 1; // 反向题，转成 5；A 维共 9 题
  const { dims } = scoreBFI(answers);
  assert.equal(dims.A, Math.round(((5 + 8 * 3) / 9) * 1000) / 1000);
  assert.equal(dims.E, 3, '其他维度不受影响');
});

test('CRT：数值与中文数字都能判定，第 7 题只有 C 算对', () => {
  const right = {
    CRT1: '0.05 元', CRT2: '五分钟', CRT3: '47 天', CRT4: '四天', CRT5: '29 名', CRT6: '二十元', CRT7: 3,
  };
  assert.equal(scoreCRT(right).total, 7);

  assert.equal(scoreCRT({ ...right, CRT1: '5 分' }).total, 7, '5 分等于 0.05 元');
  assert.equal(scoreCRT({ ...right, CRT1: '5 元' }).total, 6);
  assert.equal(scoreCRT({ ...right, CRT2: '100' }).total, 6);
  assert.equal(scoreCRT({ ...right, CRT7: 2 }).total, 6, '第 7 题选 B 是直觉错答');
  assert.equal(scoreCRT({}).total, 0);
});

test('CSSTNFQ：23–25 反向，总分范围 25–125', () => {
  const all1 = allAnswers('CS', range(1, 25), 1);
  assert.equal(scoreCSSTNFQ(all1).total, 22 + 3 * 5);
  const all5 = allAnswers('CS', range(1, 25), 5);
  assert.equal(scoreCSSTNFQ(all5).total, 22 * 5 + 3 * 1);
});

test('注意力检测：三题位置与正确值', () => {
  const answers = allAnswers('BFI', range(1, 44), 3);
  answers.AC1 = 4;
  answers.AC2 = 1;
  answers.AC3 = 3;
  const ok = scoreAttention(bankA, answers);
  assert.equal(ok.passed, 3);
  assert.equal(ok.allPassed, true);

  answers.AC2 = 2;
  const bad = scoreAttention(bankA, answers);
  assert.equal(bad.passed, 2);
  assert.equal(bad.allPassed, false);
  assert.equal(bad.AC2, false);
});

test('人口学：选项编码 1 起，年龄按数字解析', () => {
  const coded = codeDemo({ D1: 2, D2: '二十岁', D3: 1, D4: 3, D5: 4, D6: 5 });
  assert.deepEqual(
    { sex: coded.sex, age: coded.age, grade: coded.grade, major: coded.major, living: coded.living, online: coded.online },
    { sex: 2, age: 20, grade: 1, major: 3, living: 4, online: 5 },
  );
});

test('画像判定：按 3.250 / 3.111 划四类', () => {
  assert.equal(GROUP_CUTS.nHigh, 3.25);
  assert.equal(GROUP_CUTS.cLow, 3.111);

  assert.equal(personalityProfile({ N: 3.5, C: 4 }).code, 'N_only');
  assert.equal(personalityProfile({ N: 3.0, C: 3.0 }).code, 'C_only');
  assert.equal(personalityProfile({ N: 3.5, C: 3.0 }).code, 'both');
  assert.equal(personalityProfile({ N: 3.0, C: 4.0 }).code, 'none');
  assert.equal(personalityProfile({ N: 3.25, C: 3.111 }).code, 'both', '等于阈值算达标');
  assert.equal(personalityProfile({}), null);
});

test('分派：先 1:1:1 随机三组，实验组内按画像定 V-A / V-B', () => {
  const nOnly = { N: 4.0, C: 4.0 };
  assert.equal(assignVideo(nOnly, () => 0.1).group, 'V-A');
  assert.equal(assignVideo(nOnly, () => 0.5).group, 'V-C');
  assert.equal(assignVideo(nOnly, () => 0.9).group, 'V-N');

  const cOnly = { N: 3.0, C: 2.8 };
  assert.equal(assignVideo(cOnly, () => 0.1).group, 'V-B');
  assert.equal(assignVideo(cOnly, () => 0.1).arm, 'exp');
});

test('兼具者：超出阈值多的那一边优先，相差 ≤0.06 给 V-A', () => {
  // N 超 0.35，C 超 0.111 → 差 0.239，给 V-A
  assert.equal(assignVideo({ N: 3.6, C: 3.0 }, () => 0.1).group, 'V-A');
  // C 明显超得多 → V-B
  assert.equal(assignVideo({ N: 3.4, C: 2.6 }, () => 0.1).group, 'V-B');
  // N 明显超得多 → V-A
  assert.equal(assignVideo({ N: 4.6, C: 3.1 }, () => 0.1).group, 'V-A');
});

test('都不满足：不入组，不给视频', () => {
  const r = assignVideo({ N: 3.0, C: 4.0 }, () => 0.1);
  assert.equal(r.eligible, false);
  assert.equal(r.group, null);
  assert.equal(r.arm, null);
});

test('作答值翻译：选项按 1 起取值', () => {
  assert.deepEqual(answerLabels(bankA, { BFI01: 5, D1: 2 }), {
    BFI01: '非常同意',
    D1: '女',
  });
  assert.deepEqual(answerLabels(bankA, {}), {});
});

test('解析数字：阿拉伯、中文与小数', () => {
  assert.equal(parseAnswerNumber('29 名'), 29);
  assert.equal(parseAnswerNumber('四十七天'), 47);
  assert.equal(parseAnswerNumber('二十'), 20);
  assert.equal(parseAnswerNumber('0.05'), 0.05);
  assert.equal(parseAnswerNumber('不知道'), null);
});

/* ---------------- 引擎 ---------------- */

test('引擎：记录每题首次作答耗时，已有记录不再覆盖', () => {
  const stub = {
    innerHTML: '',
    addEventListener() {},
    contains: () => true,
    querySelector: () => null,
    querySelectorAll: () => [],
    scrollIntoView() {},
  };
  const bank = { questions: [{ id: 'Q1', text: '题干', options: [{ text: 'a' }, { text: 'b' }] }] };

  let pushed = null;
  const quiz = new Quiz({ bank, container: stub, onTiming: (s) => { pushed = { ...s }; } });

  quiz.shownAt.Q1 = Date.now() - 3200;
  const input = { dataset: { qid: 'Q1' }, value: '2' };
  input.closest = () => input;
  quiz.handleChange({ target: input });

  assert.deepEqual(quiz.answers, { Q1: 2 }, '选项应按 1 起存储');
  assert.ok(quiz.answerSeconds.Q1 >= 3 && quiz.answerSeconds.Q1 <= 3.4, `实际 ${quiz.answerSeconds.Q1}`);
  assert.deepEqual(pushed, quiz.answerSeconds, 'onTiming 应回传完整耗时表');

  quiz.shownAt.Q1 = Date.now() - 9000;
  input.value = '1';
  quiz.handleChange({ target: input });
  assert.ok(quiz.answerSeconds.Q1 <= 3.4, '改选答案不应重置首次作答耗时');

  const resumed = new Quiz({
    bank, container: stub, answers: { Q1: 1 }, answerSeconds: { Q1: 3.2 },
  });
  assert.equal(resumed.answerSeconds.Q1, 3.2, '恢复进度时应沿用已存耗时');
});

test('引擎：文本题存原文，空字符串视为未作答', () => {
  const stub = {
    innerHTML: '',
    addEventListener() {},
    contains: () => true,
    querySelector: () => null,
    querySelectorAll: () => [],
    scrollIntoView() {},
  };
  const bank = { questions: [{ id: 'T1', text: '题', type: 'text' }] };
  const quiz = new Quiz({ bank, container: stub });

  const input = { dataset: { qid: 'T1' }, value: '  四天 ' };
  input.closest = () => input;
  quiz.handleChange({ target: input });
  assert.equal(quiz.answers.T1, '四天');
  assert.equal(quiz.isAnswered(bank.questions[0]), true);
  assert.equal(quiz.isAnswered({ id: 'T1', type: 'text' }), true);
  assert.equal(new Quiz({ bank, container: stub, answers: { T1: '  ' } }).isAnswered(bank.questions[0]), false);
});

/* ---------------- 编码 ---------------- */

test('编码：长度、字符集与格式校验', () => {
  for (let i = 0; i < 50; i += 1) {
    const code = randomCode();
    assert.equal(code.length, LENGTH);
    assert.ok([...code].every((ch) => CHARSET.includes(ch)));
    assert.ok(isValidFormat(code));
  }
});

test('编码：忽略空格、连字符和大小写', () => {
  const code = randomCode();
  const messy = code.toLowerCase().replace(/(.{4})/g, '$1-');
  assert.equal(normalizeCode(messy), code);
  assert.ok(isValidFormat(messy));
  assert.ok(!isValidFormat('ABC'));
  assert.ok(!isValidFormat('I'.repeat(LENGTH)));
});

test('编码：遇到已占用编号会自动重试', async () => {
  let calls = 0;
  const code = await generateUniqueCode({
    isTaken: async () => { calls += 1; return calls <= 3; },
  });
  assert.equal(calls, 4);
  assert.equal(code.length, LENGTH);
});

/* ---------------- 存储 ---------------- */

const CODE_A = 'ABCDEFGHJKLMNPQR';
const CODE_B = 'QRSTUVWXYZ234567';

test('存储：一测提交幂等，编号重复会被识别', async () => {
  globalThis.localStorage = memoryStorage();
  CONFIG.storage.driver = 'local'; // 单元测试不碰真实 Supabase
  const { store } = await import('../assets/js/storage.js');

  const record = {
    submissionId: 's-1',
    code: CODE_A,
    answers: { BFI01: 5 },
    answersT2: { CS01: 4 },
  };

  let res = await store.submitTest1(record);
  assert.equal(res.ok, true);

  res = await store.submitTest1(record);
  assert.equal(res.ok, true, '同一 submissionId 重试应视为成功');
  assert.equal(res.duplicate, true);

  res = await store.submitTest1({ ...record, submissionId: 's-2' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'code_exists');

  assert.equal(await store.codeExists(CODE_A), true);
  assert.equal(await store.codeExists(CODE_B), false);

  const list = await store.listRecords();
  assert.equal(list.length, 1);
  assert.equal(list[0].test1.answers.BFI01, 5);
});

test('存储：不满 7 天不能进二测，满 7 天后只能提交一次', async () => {
  globalThis.localStorage = memoryStorage();
  CONFIG.flow.test2DelayDays = 7; // 测试里强制开启门槛（框架测试阶段配置为 0）

  const { store, formatWait } = await import('../assets/js/storage.js');

  await store.submitTest1({
    submissionId: 'b-1',
    code: CODE_B,
    answers: {},
    answersT2: {},
  });

  let status = await store.checkTest2(CODE_B);
  assert.equal(status.ok, false);
  assert.equal(status.reason, 'too_early');
  assert.ok(status.waitSeconds > 6 * 86400, `剩余等待应接近 7 天，实际 ${status.waitSeconds}`);

  const participants = JSON.parse(localStorage.getItem('qs.participants.v2'));
  participants[CODE_B].createdAt = new Date(Date.now() - 8 * 86400000).toISOString();
  localStorage.setItem('qs.participants.v2', JSON.stringify(participants));

  status = await store.checkTest2(CODE_B);
  assert.equal(status.ok, true);

  let res = await store.submitTest2(CODE_B, { submissionId: 't2-1', answers: { CS01: 5 } });
  assert.equal(res.ok, true);

  status = await store.checkTest2(CODE_B);
  assert.equal(status.reason, 'already_done');

  res = await store.submitTest2(CODE_B, { submissionId: 't2-1', answers: {} });
  assert.equal(res.ok, true, '同一 submissionId 重试应视为成功');
  assert.equal(res.duplicate, true);

  const rec = (await store.listRecords()).find((x) => x.code === CODE_B);
  assert.equal(rec.test2.answers.CS01, 5);

  assert.match(formatWait(7 * 86400), /天/);
  assert.match(formatWait(3600), /小时/);
  assert.match(formatWait(60), /分钟/);
  assert.match(formatWait(undefined), /分钟/, '字段缺失时不能出现 NaN');
});

/* ---------------- 题库B（视频后） ---------------- */

test('题库B：四份问卷、每人 54 题、每套另起一页', () => {
  const b = bankBFor('V-A');
  assert.deepEqual(b.sections.map((x) => x.key), ['manip', 'stai6', 'crt2', 'css2']);
  assert.equal(b.sections[0].questions.length, 14, '操纵检验 16 题，回忆两题按组二选一');
  assert.equal(b.sections[1].questions.length, 7);
  assert.equal(b.sections[2].questions.length, 7);
  assert.equal(b.sections[3].questions.length, 26);
  assert.equal(b.questions.length, 54);

  const quiz = new Quiz({ bank: b, container: {
    innerHTML: '', addEventListener() {}, contains: () => true,
    querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {},
  } });
  assert.equal(quiz.pages.filter((p) => p.isSectionStart).length, 4);
});

test('题库B：中性组换用 C1′/C2′，其余组用反诈版', () => {
  const target = bankBFor('V-A').sections[0].questions;
  const neutral = bankBFor('V-N').sections[0].questions;
  assert.match(target.find((q) => q.id === 'C1').text, /哪一类骗局/);
  assert.match(neutral.find((q) => q.id === 'C1').text, /主要讲的是什么/);
  assert.equal(neutral.find((q) => q.id === 'C2').options[0].text, '作息与运动');
  assert.match(target.find((q) => q.id === 'C2').text, /拨打哪个号码/);
});

test('题库B：注意力题位置与分值', () => {
  const b = bankBFor('V-A');
  const stai = b.sections[1].questions;
  assert.equal(stai[3].id, 'AC5', '注意力题插在 STAI-6 第 3 题后');
  assert.equal(stai[3].attention, 4);
  const css = b.sections[3].questions;
  assert.equal(css[css.length - 1].id, 'AC6');
  assert.equal(css[css.length - 1].attention, 4);
  assert.equal(b.sections[0].questions.find((q) => q.id === 'A1').attention, 'color');
  assert.equal(A1_CORRECT_COLOR, '蓝色', 'A1 正确项按题库C汇总表定为蓝色');

  const att = scoreAttention(b, { AC5: 4, AC6: 4, A1: 4 });
  assert.equal(att.total, 2, 'A1 不参与自动注意力判分');
  assert.equal(att.passed, 2);
});

test('STAI-6：反向题 1、4、5，总分 6–24', () => {
  const all1 = { S601: 1, S602: 1, S603: 1, S604: 1, S605: 1, S606: 1 };
  assert.equal(scoreSTAI6(all1).total, 3 * 4 + 3 * 1);
  const all4 = { S601: 4, S602: 4, S603: 4, S604: 4, S605: 4, S606: 4 };
  assert.equal(scoreSTAI6(all4).total, 3 * 1 + 3 * 4);
});

test('平行版 CRT：答案 1/3/19/3/23/20 与第 7 题 C', () => {
  const right = {
    CRT21: '1 元', CRT22: '三分钟', CRT23: '19 次', CRT24: '3 天', CRT25: '23 名', CRT26: '20 元', CRT27: 3,
  };
  assert.equal(scoreCRTParallel(right).total, 7);
  assert.equal(scoreCRTParallel({ ...right, CRT23: '20' }).total, 6);
  assert.equal(scoreCRTParallel({ ...right, CRT27: 1 }).total, 6);
});

test('操纵检验：四维取均值，A1 与回忆未定稿时只存原始值', () => {
  const answers = {
    M1: 6, M2: 5, M3: 4, F1: 7, F2: 6, F3: 2, F4: 3, H1: 5, H2: 4,
    A1: 2, C1: 1, C2: 2, T1: 6, T2: 3,
  };
  const m = scoreManipulation(answers);
  assert.equal(m.match, 5);
  assert.equal(m.loss, 6.5);
  assert.equal(m.rule, 2.5);
  assert.equal(m.reflect, 4.5);
  assert.equal(m.credibility, 6);
  assert.equal(m.aiSense, 3);
  assert.equal(m.a1.text, '红色');
  assert.equal(m.a1.correct, null);
  assert.equal(m.recall.total, null);

  const judged = scoreManipulation(answers, { a1CorrectColor: '红色', recallCorrect: { C1: 1, C2: 1 } });
  assert.equal(judged.a1.correct, true);
  assert.equal(judged.recall.total, 1);
});

test('题库B：题号在每套内从 1 开始', () => {
  const b = bankBFor('V-A');
  const html = new Quiz({ bank: b, container: {
    innerHTML: '', addEventListener() {}, contains: () => true,
    querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {},
  } }).renderQuestion(b.sections[1].questions[0], 0, 0);
  assert.match(html, /q-num">1\.<\/span>/);
});

/* ---------------- 题库C（T3） ---------------- */

test('题库C：一份 CSSTNFQ + 末尾注意力题 + 事后解说', () => {
  assert.equal(bankC.sections.length, 1);
  assert.equal(bankC.questions.length, 26);
  const last = bankC.questions[bankC.questions.length - 1];
  assert.equal(last.id, 'AC7');
  assert.equal(last.attention, 3);
  assert.equal(last.text, '以下哪种动物会飞？');

  const att = scoreAttention(bankC, { AC7: 3 });
  assert.equal(att.passed, 1);
  assert.equal(att.allPassed, true);

  assert.match(DEBRIEF, /事后|本研究考察/);
  assert.ok(DEBRIEF.includes('匿名'), '事后解说要说明匿名');
});

test('A1 判分：选蓝色记对，其余颜色记错', () => {
  const base = { M1: 5, M2: 5, M3: 5, A1: 1, T1: 5, T2: 5 };
  assert.equal(scoreManipulation(base, { a1CorrectColor: '蓝色' }).a1.correct, true);
  assert.equal(scoreManipulation({ ...base, A1: 2 }, { a1CorrectColor: '蓝色' }).a1.correct, false);
});

test('大五判定：按 3.0 划高低，并给出主导维度', () => {
  const r = classifyBigFive({ E: 4.2, A: 3.1, C: 2.4, N: 3.6, O: 2.9 });
  assert.deepEqual(r.levels, { E: '高', A: '高', C: '低', N: '高', O: '低' });
  assert.equal(r.dominant, 'E');
  assert.equal(r.dominantName, '外向性');
  assert.equal(r.profile, 'E-N-A-O-C');
  assert.equal(r.cutoff, 3);

  const edge = classifyBigFive({ E: 3, A: 3, C: 3, N: 3, O: 3 });
  assert.deepEqual(edge.levels, { E: '高', A: '高', C: '高', N: '高', O: '高' }, '等于 3 记为高');
  assert.equal(classifyBigFive({}), null);
});

test('存储：未入组者不能进二测', async () => {
  globalThis.localStorage = memoryStorage();
  CONFIG.storage.driver = 'local';
  const { store } = await import('../assets/js/storage.js');

  await store.submitTest1({
    submissionId: 'c-1', code: 'ABCDEFGHJKLMNPQR', eligible: false, answers: {}, answersB: {},
  });
  const st = await store.checkTest2('ABCDEFGHJKLMNPQR');
  assert.equal(st.ok, false);
  assert.equal(st.reason, 'not_eligible');
});
