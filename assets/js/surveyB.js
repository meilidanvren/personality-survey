/**
 * 研究二题库（B 卷，v1）：视频干预后施测。
 * 四份问卷各自成段，另起一页、题号从 1 开始、只显示指导语不显示量表名。
 * 来源：《题库B.docx》。视频内容与匹配方式待定，A1 判分颜色暂留空。
 */
import { bankA } from './surveyA.js';

const L7 = ['完全不同意', '比较不同意', '有点不同意', '不确定', '有点同意', '比较同意', '完全同意'];
const L5 = ['完全不符合', '比较不符合', '不确定', '比较符合', '完全符合'];
const L4 = ['完全没有', '有些', '中等', '非常明显'];
const OPTS7 = L7.map((text) => ({ text }));
const OPTS5 = L5.map((text) => ({ text }));
const OPTS4 = L4.map((text) => ({ text }));

/** A1 的正确颜色：四组统一，按《题库C》汇总表定为「蓝色」。 */
export const A1_CORRECT_COLOR = '蓝色';

const MANIP_INTRO = '指导语：下面几条是关于刚才那段视频的问题，请根据你的真实感受选择。';
const STAI6_INTRO = '指导语：请根据你此刻的真实感觉作答。';
const CRT2_INTRO = '指导语：下面还有 7 道题，与前一部分不同，请同样仔细思考后作答。';
const CSS2_INTRO = '指导语：请判断下列描述与你自己的符合程度。';

const MANIP_HEAD = [
  { id: 'M1', text: '这条视频像是专门讲给我这类人听的。', options: OPTS7, dim: 'match' },
  { id: 'M2', text: '视频里提到的问题，和我平时的情况有相似之处。', options: OPTS7, dim: 'match' },
  { id: 'M3', text: '视频给出的建议适合我这样的人。', options: OPTS7, dim: 'match' },
  { id: 'F1', text: '视频重点讲了“不改会有什么损失”。', options: OPTS7, dim: 'loss' },
  { id: 'F2', text: '看完之后，我更担心的是可能失去什么。', options: OPTS7, dim: 'loss' },
  { id: 'F3', text: '视频把“该怎么做”拆成了清楚的步骤。', options: OPTS7, dim: 'rule' },
  { id: 'F4', text: '视频给了我一套可以照着做的清单。', options: OPTS7, dim: 'rule' },
  { id: 'H1', text: '视频中间有让我停下来想一想的提示。', options: OPTS7, dim: 'reflect' },
  { id: 'H2', text: '看视频时，我确实停下来问过自己“为什么”。', options: OPTS7, dim: 'reflect' },
  {
    id: 'A1',
    text: '片尾卡片右下角的方形图标是什么颜色？',
    options: [{ text: '蓝色' }, { text: '红色' }, { text: '绿色' }, { text: '黄色' }],
    attention: 'color',
  },
];

const RECALL_TARGET = [
  { id: 'C1', text: '视频讲的是哪一类骗局？', options: [{ text: '刷单返利' }, { text: '冒充公检法' }, { text: '网络贷款' }, { text: '校园贷' }] },
  { id: 'C2', text: '视频建议遇到可疑情况拨打哪个号码？', options: [{ text: '96110' }, { text: '12315' }, { text: '10086' }, { text: '12345' }] },
];

const RECALL_NEUTRAL = [
  { id: 'C1', text: '视频主要讲的是什么？', options: [{ text: '校园生活小贴士' }, { text: '刷单返利' }, { text: '网络贷款' }, { text: '冒充公检法' }] },
  { id: 'C2', text: '视频提到的是哪一类建议？', options: [{ text: '作息与运动' }, { text: '饮食' }, { text: '学习' }, { text: '出行安全' }] },
];

const MANIP_TAIL = [
  { id: 'T1', text: '视频里的提醒是可信的。', options: OPTS7 },
  { id: 'T2', text: '这条视频看上去是 AI 生成的。', options: OPTS7 },
];

const STAI6 = [
  { id: 'S601', text: '我感到平静。', reverse: true, options: OPTS4 },
  { id: 'S602', text: '我感到紧张。', options: OPTS4 },
  { id: 'S603', text: '我感到心烦意乱。', options: OPTS4 },
  { id: 'AC5', text: '本题为注意力检测题，请选择「非常明显」。', options: OPTS4, attention: 4 },
  { id: 'S604', text: '我感到放松。', reverse: true, options: OPTS4 },
  { id: 'S605', text: '我感到心满意足。', reverse: true, options: OPTS4 },
  { id: 'S606', text: '我感到担忧。', options: OPTS4 },
];

const CRT2 = [
  { id: 'CRT21', text: '一支笔和一个笔记本一共 12 元。笔比笔记本贵 10 元。笔记本多少钱？', type: 'text', placeholder: '填写你的答案' },
  { id: 'CRT22', text: '3 台打印机打印 3 份文件需要 3 分钟，9 台打印机打印 9 份文件需要多少分钟？', type: 'text', placeholder: '填写你的答案' },
  { id: 'CRT23', text: '一张纸对折后厚度翻倍。对折 20 次达到某一高度，达到该高度一半需要对折几次？', type: 'text', placeholder: '填写你的答案' },
  { id: 'CRT24', text: '甲 4 天能喝完一桶水，乙 12 天能喝完一桶水。两人一起喝，几天喝完？', type: 'text', placeholder: '填写你的答案' },
  { id: 'CRT25', text: '小刘在班里从高到低排第 12 名，从低到高也排第 12 名。班里共多少名学生？', type: 'text', placeholder: '填写你的答案' },
  { id: 'CRT26', text: '一个人花 50 元买一只羊，60 元卖掉；又花 70 元买回来，80 元卖掉。一共赚了多少？', type: 'text', placeholder: '填写你的答案' },
  {
    id: 'CRT27',
    text: '小张 2008 年初投资 6000 元买股票。7 月 17 日下跌 50%，到 10 月 17 日又上涨 75%。此时他：',
    options: [{ text: 'A. 刚好回本' }, { text: 'B. 比最初更多' }, { text: 'C. 亏了钱' }],
  },
];

const CSS = bankA.sections.find((s) => s.key === 'css').questions.filter((q) => q.id.startsWith('CS'));
const CSS2 = [
  ...CSS,
  { id: 'AC6', text: '本题为注意力检测题，请选择「比较符合」。', options: OPTS5, attention: 4 },
];

const withFlat = (bank) => {
  bank.questions = bank.sections.flatMap((s) => s.questions);
  return bank;
};

/** 操纵检验里只有内容回忆两题按组分流：V-N 用中性版，其余用反诈版。 */
export function bankBFor(group) {
  const recall = group === 'V-N' ? RECALL_NEUTRAL : RECALL_TARGET;
  return withFlat({
    id: 'B',
    version: 'B-v1',
    sections: [
      {
        key: 'manip',
        intro: MANIP_INTRO,
        pageSize: 8,
        questions: [...MANIP_HEAD, ...recall, ...MANIP_TAIL],
      },
      { key: 'stai6', intro: STAI6_INTRO, pageSize: 8, questions: STAI6 },
      { key: 'crt2', intro: CRT2_INTRO, pageSize: 8, questions: CRT2 },
      { key: 'css2', intro: CSS2_INTRO, pageSize: 10, questions: CSS2 },
    ],
  });
}
