/**
 * 研究一题库（A 卷，v2）。
 * 每套问卷是一个 section：有自己的指导语、从 1 开始的题号、另起一页。
 * 指导语只在 section 第一页顶部渲染，不进入题目卡片；反向题标记只存在于数据里。
 * 计分见 assets/js/scoring.js，规则来源：《题库A.docx》各段「计分」。
 */

const L5 = ['非常不同意', '比较不同意', '不确定', '比较同意', '非常同意'];
const L4 = ['完全没有', '有些', '中等', '非常明显'];
const OPTS5 = L5.map((text) => ({ text }));
const OPTS4 = L4.map((text) => ({ text }));

const SEC_BFI = {
  key: 'bfi',
  intro: '指导语：请判断下列描述与你自己的符合程度。',
  pageSize: 10,
  questions: [
      { id: 'BFI01', text: '我是一个健谈的、喜欢与人交流的人', options: OPTS5 },
      { id: 'BFI02', text: '我经常挑别人的毛病', reverse: true, options: OPTS5 },
      { id: 'BFI03', text: '我做事情认真严谨、一丝不苟', options: OPTS5 },
      { id: 'BFI04', text: '我经常感到忧郁或沮丧', options: OPTS5 },
      { id: 'BFI05', text: '我对很多不同的事物都感兴趣', options: OPTS5 },
      { id: 'BFI06', text: '我比较内敛、话不多', reverse: true, options: OPTS5 },
      { id: 'BFI07', text: '我乐于助人、不自私', options: OPTS5 },
      { id: 'BFI08', text: '我有时比较粗心大意', reverse: true, options: OPTS5 },
      { id: 'BFI09', text: '我心态放松、能很好地应对压力', reverse: true, options: OPTS5 },
      { id: 'BFI10', text: '我对艺术、音乐或文学有浓厚兴趣', options: OPTS5 },
      { id: 'BFI11', text: '我精力充沛、活力充足', options: OPTS5 },
      { id: 'BFI12', text: '我有时会和别人产生矛盾或争执', reverse: true, options: OPTS5 },
      { id: 'BFI13', text: '我是一个值得信赖的、可靠的人', options: OPTS5 },
      { id: 'BFI14', text: '我容易紧张', options: OPTS5 },
      { id: 'BFI15', text: '我思维敏捷、能快速理解抽象概念', options: OPTS5 },
      { id: 'BFI16', text: '我充满热情、有感染力', options: OPTS5 },
      { id: 'BFI17', text: '我宽容大度、能谅解别人', options: OPTS5 },
      { id: 'BFI18', text: '我做事情缺乏条理', reverse: true, options: OPTS5 },
      { id: 'BFI19', text: '我常常担心太多事情', options: OPTS5 },
      { id: 'BFI20', text: '我有丰富的想象力', options: OPTS5 },
      { id: 'BFI21', text: '我通常比较安静、不太爱说话', reverse: true, options: OPTS5 },
      { id: 'BFI22', text: '我通常信任别人、相信人性本善', options: OPTS5 },
      { id: 'BFI23', text: '我做事比较懒散，需要别人推动', reverse: true, options: OPTS5 },
      { id: 'BFI24', text: '我情绪稳定、不容易心烦意乱', reverse: true, options: OPTS5 },
      { id: 'BFI25', text: '我善于创造、常有新点子', options: OPTS5 },
      { id: 'BFI26', text: '我性格坚定、有主见', options: OPTS5 },
      { id: 'BFI27', text: '我有时对别人态度冷淡、爱理不理', reverse: true, options: OPTS5 },
      { id: 'BFI28', text: '我做事能坚持到底，直到任务完成', options: OPTS5 },
      { id: 'BFI29', text: '我情绪起伏大、喜怒无常', options: OPTS5 },
      { id: 'BFI30', text: '我重视艺术和审美的体验', options: OPTS5 },
      { id: 'BFI31', text: '我有时很害羞、拘谨', reverse: true, options: OPTS5 },
      { id: 'BFI32', text: '我细心周到、几乎对每个人都很好', options: OPTS5 },
      { id: 'BFI33', text: '我做事效率高、能迅速完成任务', options: OPTS5 },
      { id: 'BFI34', text: '我在紧张情境中也能保持冷静', reverse: true, options: OPTS5 },
      { id: 'BFI35', text: '我喜欢做一些常规的、重复性的工作', reverse: true, options: OPTS5 },
      { id: 'BFI36', text: '我性格外向、善于社交', options: OPTS5 },
      { id: 'BFI37', text: '我有时对人态度粗鲁', reverse: true, options: OPTS5 },
      { id: 'BFI38', text: '我做事有计划并会按计划执行', options: OPTS5 },
      { id: 'BFI39', text: '我很容易感到焦虑', options: OPTS5 },
      { id: 'BFI40', text: '我喜欢探索新的想法和事物', options: OPTS5 },
      { id: 'BFI41', text: '我对艺术或音乐不太感兴趣', reverse: true, options: OPTS5 },
      { id: 'BFI42', text: '我倾向于与人合作而非竞争', options: OPTS5 },
      { id: 'BFI43', text: '我容易分心、注意力不集中', reverse: true, options: OPTS5 },
      { id: 'BFI44', text: '我对艺术、音乐或文学有较好的鉴赏力', options: OPTS5 },
      { id: 'AC1', text: '本题为注意力检测题，请选择「比较同意」。', options: OPTS5, attention: 4 },
  ],
};

const SEC_DEMO = {
  key: 'demo',
  intro: '指导语：下面是关于你个人基本情况的问题，只用于整体统计描述，不会单独公开任何人的信息。',
  pageSize: 8,
  questions: [
      { id: 'D1', text: '性别', options: [{ text: '男' }, { text: '女' }] },
      { id: 'D2', text: '年龄（岁）', type: 'text', placeholder: '填写数字' },
      { id: 'D3', text: '年级', options: [{ text: '大一' }, { text: '大二' }, { text: '大三' }, { text: '大四' }, { text: '研究生及以上' }] },
      { id: 'D4', text: '专业类别', options: [{ text: '理工' }, { text: '文史哲法经管' }, { text: '教育' }, { text: '医学' }, { text: '艺术' }, { text: '农学' }, { text: '其他' }] },
      { id: 'D5', text: '月均生活费', options: [{ text: '1000 元及以下' }, { text: '1001–1500 元' }, { text: '1501–2000 元' }, { text: '2001–3000 元' }, { text: '3000 元以上' }] },
      { id: 'D6', text: '日均上网时长', options: [{ text: '2 小时以下' }, { text: '2–4 小时' }, { text: '4–6 小时' }, { text: '6–8 小时' }, { text: '8 小时以上' }] },
  ],
};

const SEC_CRT = {
  key: 'crt',
  intro: '指导语：下面有 7 道题目，请仔细思考后写下答案。这些题目看起来简单，但请不要急着下结论——你的直觉可能会误导你。第 7 题请直接选择 A、B 或 C。',
  pageSize: 8,
  questions: [
      { id: 'CRT1', text: '一个球拍和一个球一共花了 1.1 元。球拍比球贵 1 元。球是多少钱？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT2', text: '5 台机器生产 5 个零件需要 5 分钟，100 台机器生产 100 个零件需要多少分钟？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT3', text: '湖里有一片睡莲叶子，每天面积增大一倍。如果第 48 天覆盖全湖，覆盖半个湖面需要多少天？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT4', text: '约翰 6 天能喝完一桶水，玛丽 12 天能喝完一桶水。两人一起喝，几天喝完？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT5', text: '杰瑞在班里从高到低排第 15 名，从低到高也排第 15 名。班里共多少名学生？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT6', text: '一个人花 60 元买一只猪，70 元卖掉；又花 80 元买回来，90 元卖掉。一共赚了多少？', type: 'text', placeholder: '填写你的答案' },
      { id: 'CRT7', text: '西蒙 2008 年初投资 8000 元买股票。7 月 17 日下跌 50%，到 10 月 17 日又上涨 75%。此时他：A. 刚好回本；B. 比最初更多；C. 亏了钱。', options: [{ text: 'A. 刚好回本' }, { text: 'B. 比最初更多' }, { text: 'C. 亏了钱' }] },
  ],
};

const SEC_STAI = {
  key: 'stai',
  intro: '指导语：请根据你此刻的真实感觉作答。',
  pageSize: 8,
  questions: [
      { id: 'S601', text: '我感到平静。', reverse: true, options: OPTS4 },
      { id: 'S602', text: '我感到紧张。', options: OPTS4 },
      { id: 'S603', text: '我感到心烦意乱。', options: OPTS4 },
      { id: 'S604', text: '我感到放松。', reverse: true, options: OPTS4 },
      { id: 'S605', text: '我感到心满意足。', reverse: true, options: OPTS4 },
      { id: 'S606', text: '我感到担忧。', options: OPTS4 },
      { id: 'AC2', text: '本题为注意力检测题，请选择「完全没有」。', options: OPTS4, attention: 1 },
  ],
};

const SEC_CSS = {
  key: 'css',
  intro: '指导语：请判断下列描述与你自己的符合程度。',
  pageSize: 10,
  questions: [
      { id: 'CS01', text: '信息传递者的身份会影响我对信息的理解。', options: OPTS5 },
      { id: 'CS02', text: '情绪状态会影响我对信息的理解。', options: OPTS5 },
      { id: 'CS03', text: '当我和其他人面对相同的信息时，其他人的观点态度会影响我对信息的理解。', options: OPTS5 },
      { id: 'CS04', text: '当信息内容输入过多时，我容易抓不到重点。', options: OPTS5 },
      { id: 'CS05', text: '我会做一些能给自己带来快乐但却有风险的事情。', options: OPTS5 },
      { id: 'CS06', text: '虽然我知道做某件事情是错误的，但我也很难阻止自己继续去做这件事。', options: OPTS5 },
      { id: 'CS07', text: '我常常考虑不周就付诸行动。', options: OPTS5 },
      { id: 'CS08', text: '我渴望快速变得有钱。', options: OPTS5 },
      { id: 'CS09', text: '我更愿意处理一些几乎不需要经过思考的事情，而不愿意尝试对思维能力有挑战的事情。', options: OPTS5 },
      { id: 'CS10', text: '我只需要知道什么东西能做什么事情就够了，不在乎怎么做以及为什么能做到。', options: OPTS5 },
      { id: 'CS11', text: '我会尽量避免那些有可能使我不得不对某事做深入思考的情形。', options: OPTS5 },
      { id: 'CS12', text: '我认为网上的大多数人都是诚实可靠的。', options: OPTS5 },
      { id: 'CS13', text: '在网络人际交往中，我认为人们基本上都是讲信用的。', options: OPTS5 },
      { id: 'CS14', text: '我相信网络上他人提供的身份信息都是真实的。', options: OPTS5 },
      { id: 'CS15', text: '我愿意向网络上的陌生人分享心中的秘密。', options: OPTS5 },
      { id: 'CS16', text: '我会点开陌生人发送的链接。', options: OPTS5 },
      { id: 'CS17', text: '我会查看主题不明或来源未知的邮件。', options: OPTS5 },
      { id: 'CS18', text: '我会在非个人设备上登陆自己的网络账号（如微信、QQ、邮箱等）。', options: OPTS5 },
      { id: 'CS19', text: '我会在网页或软件的登录界面上选择保存信息或自动登录。', options: OPTS5 },
      { id: 'CS20', text: '我会通过非官方渠道下载软件并安装。', options: OPTS5 },
      { id: 'CS21', text: '我会在社交软件上通过陌生人的好友申请。', options: OPTS5 },
      { id: 'CS22', text: '我会在社交软件上发布与个人信息相关的内容动态（如照片、身份信息、工作信息等）。', options: OPTS5 },
      { id: 'CS23', text: '我能够准确地说明什么是电信诈骗。', reverse: true, options: OPTS5 },
      { id: 'CS24', text: '我能够详细地列举出常见的骗局类型。', reverse: true, options: OPTS5 },
      { id: 'CS25', text: '我对骗子的诈骗话术非常了解。', reverse: true, options: OPTS5 },
      { id: 'AC3', text: '以下哪种动物会飞？', options: [{ text: '狗' }, { text: '猫' }, { text: '麻雀' }, { text: '金鱼' }], attention: 3 },
  ],
};

const CSSTNFQ = SEC_CSS.questions.filter((x) => x.id.startsWith('CS'));

const withFlat = (bank) => {
  bank.questions = bank.sections.flatMap((s) => s.questions);
  return bank;
};

export const bankA = withFlat({
  id: 'A',
  version: 'A-v2',
  sections: [SEC_DEMO, SEC_BFI, SEC_CRT, SEC_STAI, SEC_CSS],
});
