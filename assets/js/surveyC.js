/**
 * 研究二 T3（题库C）：7 天后凭凭证编码进入。
 * 一份 CSSTNFQ + 一道注意力题，答完显示事后解说。
 * 来源：《题库C.docx》。
 */
import { bankA } from './surveyA.js';

const L5 = ['完全不符合', '比较不符合', '不确定', '比较符合', '完全符合'];
const OPTS5 = L5.map((text) => ({ text }));

const CSS = bankA.sections.find((s) => s.key === 'css').questions.filter((q) => q.id.startsWith('CS'));

export const DEBRIEF = '感谢参与。本研究考察人格特质、认知反思与网络受骗易感性之间的关系，'
  + '以及不同形式的反诈短视频能否降低受骗易感性。研究过程中没有隐瞒任何会对您造成风险的信息。'
  + '您的作答已匿名保存，仅用于学术分析。如有疑问可联系主试。';

const withFlat = (bank) => {
  bank.questions = bank.sections.flatMap((s) => s.questions);
  return bank;
};

export const bankC = withFlat({
  id: 'C',
  version: 'C-v1',
  sections: [{
    key: 'css3',
    intro: '指导语：请根据你这一周以来的真实情况作答。',
    pageSize: 10,
    questions: [
      ...CSS,
      {
        id: 'AC7',
        text: '以下哪种动物会飞？',
        options: [{ text: '狗' }, { text: '猫' }, { text: '麻雀' }, { text: '金鱼' }],
        attention: 3,
      },
    ],
  }],
});
