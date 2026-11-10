# 两次制问卷调查站点

纯静态问卷网站，网页托管在 GitHub Pages；作答数据通过 Supabase 收集，
再由 GitHub Actions 定时导出成 `编号.json` 存进一个**私有仓库**。
不需要自己买服务器。

---

## 一、整体流程

**一测（test1.html）**

1. 说明页，点「开始作答」
2. 题库 A：人格测验
3. 后台自动算出维度分、判定人格类型（**不展示给被试**）
4. 按人格类型推送对应视频（必须看完才能继续）
5. 题库 B：第二阶段问卷
6. 生成 **16 位随机编号**（不重复），提交成功后展示并提示保存

**二测（test2.html）**

1. 输入一测编号
2. 校验：格式正确 + 编号存在 + 距一测完成已满 7 天 + 没做过二测
3. 题库 C：第三阶段问卷
4. 完成页

一测、二测、管理页的入口都在首页 `index.html`。

等待天数**绑定到编号**：编号什么时候生成，就从什么时候开始算（当前设为 0，不等待）。
Supabase 模式下用的是数据库服务器时间，被试改自己电脑的时间没有用。

---

## 二、目录结构

```
personality-survey/
├─ index.html              首页（选择一测 / 二测）
├─ test1.html              一测页面
├─ test2.html              二测页面
├─ admin.html              数据管理页（本地模式导出用，别发给被试）
├─ start-local.bat         本地预览用（双击）
├─ assets/
│  ├─ css/style.css        全部样式
│  ├─ js/
│  │  ├─ config.js         ★ 全站设置（文案、页长、等待天数、存储方式）
│  │  ├─ surveyA.js        ★ 研究一题库（五段问卷 + 三道注意力题）
│  │  ├─ surveyB.js        ★ 研究二题库（视频后四段问卷）
│  │  ├─ surveyC.js        ★ 研究二 T3（一份 CSSTNFQ + 事后解说）
│  │  ├─ engine.js         答题引擎（翻页、必答校验、进度条）
│  │  ├─ scoring.js        计分
│  │  ├─ code.js           编号生成与格式校验
│  │  ├─ storage.js        存储（本地 / Supabase）
│  │  ├─ test1.js          一测流程
│  │  ├─ test2.js          二测流程
│  │  ├─ admin.js          管理页逻辑
│  │  └─ file-check.js     双击 html 时的提示
│  └─ videos/              三个视频放这里
├─ supabase/schema.sql     数据库初始化脚本（正式收数据时必须执行）
├─ data-repo/              数据备份仓库模板（复制到私有仓库）
└─ tests/logic.test.mjs    自动测试（可选）
```

带 ★ 的三个文件是以后最常改的。

---

## 三、本地预览

**双击 `start-local.bat`**，浏览器会自动打开 `http://localhost:8000`。
关掉黑色窗口就停止。

> 不要直接双击 `index.html` 或 `test1.html`。浏览器不允许本地文件加载网页脚本，
> 会只显示页头、没有题目。必须通过上面的小服务器或部署后的网址打开。

### 本地怎么快速测二测

**等待 7 天是正式规则。** 本地模式测试时可以把 `test2DelayDays` 临时改 `0` 跳过；
Supabase 模式的等待由数据库判定，改配置无效，要跳过就在 SQL Editor 里把测试编号的
`created_at` 往前改（见本节下方）。

```js
const k = 'qs.participants.v2';
const p = JSON.parse(localStorage.getItem(k));
Object.values(p).forEach(x => x.createdAt = new Date(Date.now() - 8 * 864e5).toISOString());
localStorage.setItem(k, JSON.stringify(p));
```

刷新二测页面，再输入编号就能进了。这个办法只对本地模式有效，
Supabase 模式的等待由服务器判断，改不了。

---

## 四、部署到 GitHub Pages

### 1. 建仓库

登录 GitHub → 右上角 `+` → **New repository**。
名字随意，比如 `survey`，选 **Public**，点 **Create repository**。

### 2. 上传文件

仓库页面点 **Add file → Upload files**，把 `personality-survey` 文件夹里的
**所有内容**（不是文件夹本身）拖进去：

- `index.html`、`test1.html`、`test2.html`、`admin.html`
- `assets` 文件夹
- `.nojekyll`（很重要，别漏）
- 其他文件可传可不传

点 **Commit changes**。

### 3. 打开 Pages

仓库 → **Settings** → 左侧 **Pages**：

- Source 选 **Deploy from a branch**
- Branch 选 **main**，目录选 **/ (root)**
- 点 **Save**

等 1～2 分钟，得到网址：

```
https://你的用户名.github.io/survey/
```

发给被试时分别给：

- 一测：`https://你的用户名.github.io/survey/test1.html`
- 二测：`https://你的用户名.github.io/survey/test2.html`

`admin.html` **不要发给被试**。

---

## 五、换成你的题库

### 题库 A（人格测验）

**当前是 12 道四选一的示例题**（言语、数理、逻辑各 4 题），只为跑通流程用。
换成正式题库时，整个 `questions` 数组替换掉即可。

选择题写法（当前使用的）：

```js
{
  id: 'A01',
  text: '题干文字',
  options: [
    { text: '选项一', score: { V: 1 } },   // 选这个给 V 维度加 1 分
    { text: '选项二', score: { V: 0 } },   // 选这个加 0 分
  ],
},
```

- `id`：题号，**不能重复**，导出 CSV 时就是这一列的名字
- `score`：选了这个选项，给哪些维度加多少分
- 选项按数组顺序显示，值就是下标（0、1、2…）

量表题（1～5 分）写法更简单：

```js
{ id: 'A01', text: '题干文字', dim: 'E' },               // 正向计分
{ id: 'A05', text: '题干文字', dim: 'E', reverse: true }, // 反向计分
```

`dim` 要和 `dimensions` 里的 `key` 对上；`reverse: true` 表示反向题，选 1 分按 5 分算。

**人格判定**在 `classify` 里。当前占位规则是“哪个维度平均分最高就算哪一型”：

```js
classify(dims) {
  const ranked = [
    ['verbal', dims.V ?? 0],
    ['numeric', dims.N ?? 0],
    ['logical', dims.L ?? 0],
  ].sort((a, b) => b[1] - a[1]);
  return ranked[0][0];
}
```

`dims` 是各维度平均分，返回值必须是 `types` 里的某个 key。
换成四维二分（类似 MBTI）可以这样写：

```js
classify(dims) {
  const E = dims.E >= 3 ? 'E' : 'I';
  const N = dims.N >= 3 ? 'N' : 'S';
  const T = dims.T >= 3 ? 'T' : 'F';
  const J = dims.J >= 3 ? 'J' : 'P';
  return `${E}${N}${T}${J}`;
}
```

然后 `types` 里加 16 个类型、`videos` 里把 16 个类型映射到 3 个视频即可
（多个类型可以指向同一个视频）。

**人格结果默认不展示**（`config.js` 里 `showResultToParticipant: false`）。
只有在你自己检查流程时，才临时改成 `true`。

### 研究一题库（surveyA.js）

`assets/js/surveyA.js` 由《题库A.docx》生成，包含五段问卷：
人口学、BFI-44、CRT-7、STAI-6、CSSTNFQ，外加三道注意力检测题。
每题形如：

```js
{ id: 'BFI01', text: '题干', reverse: true, options: OPTS5, note: '指导语…' }
{ id: 'CRT1', text: '题干', type: 'text', placeholder: '填写你的答案' }
```

- `note` 只写在该段第一题上，渲染成指导语块；页面不显示量表名称
- `reverse: true` 只影响计分，不会出现在被试看到的题干里
- `attention: 4` 表示该题正确选项的分值，用于注意力检测
- 改题库后把 `version` 往后推（`A-v2` → `A-v3`），旧数据靠 `bankVersion` 和 `answerText` 仍可读

**每页几道题**：改 `config.js` 里的 `pageSize`（现在 6 题一页）。

---

### 研究二题库（surveyB.js）

视频干预之后填的四份问卷，来源《题库B.docx》：

| 段 | 内容 | 题量 | 计分 |
|---|---|---|---|
| manip | 操纵检验：匹配度 M1–M3、损失 F1–F2、规则 F3–F4、反思 H1–H2、A1、回忆 C1/C2、可信度 T1、AI 感 T2 | 14 | 四维取均值；A1 与回忆待视频定稿后判分 |
| stai6 | STAI 简版（反向 1、4、5），第 3 题后插注意力题 AC5 | 7 | 6–24 |
| crt2 | 平行版 CRT-7 | 7 | 答案 1/3/19/3/23/20 与 C |
| css2 | CSSTNFQ 第二次施测（23–25 反向），末尾插 AC6 | 26 | 25–125 |

- 内容回忆按组切换：V-N 组用中性版 C1′/C2′，其余用反诈版
- `A1_CORRECT_COLOR` 在 `surveyB.js` 顶部，视频定稿后填颜色（如 `'绿色'`）即自动判分
- 回忆题的正确答案尚未定，未填时只存原始作答，`recall.total` 记 `null`

### 研究二 T3（surveyC.js）

7 天后凭凭证编码进入，一份 CSSTNFQ（25 题）+ 末尾一道注意力题（动物会飞，麻雀），
答完在完成页显示**事后解说**（`DEBRIEF` 常量）。计分与 T1/T2 同一套，`scores.csstnfqT3`。

### 数据交付格式（固定）

每份记录导出**两张数值表**，都带题干：

| 表 | 内容 |
|---|---|
| 表1 原始分值 | 被试选的数值：李克特 1–5（STAI 1–4）、单选按选项序号、CRT 文本转成解析出的数字 |
| 表2 计分分值 | 按规则转换后的每题分值：BFI 反向 6−x、STAI-6 反向 5−x、CSSTNFQ 反向 6−x、CRT 对 1 / 错 0、注意力题 1/0，其余原样 |

生成方式：`node E:\survey-exportsuild_tables.mjs <编号>` 出两张 CSV，
再 `python E:\survey-exports\make_xlsx.py <编号>` 合成 `数值表_<编号>.xlsx`（两个工作表）。

## 六、放视频

把三个视频放进 `assets/videos/`，命名：

```
video-1.mp4     对应 V-A（高神经质组）
video-2.mp4     对应 V-B（低尽责组）
video-3.mp4     对应 V-C（通用视频组）
```

文件名故意用中性编号，避免被试从地址栏或开发者工具里猜到自己分到哪一组。
无干预对照组不放视频，提交后直接进入视频后的那份问卷。
如果要改名，改 `test1.js` 顶部的 `VIDEO_BY_GROUP` 即可。

- 格式建议 MP4（H.264 + AAC），手机都能播
- 单个文件控制在 20MB 以内，GitHub 单文件上限 100MB
- 视频没放进去时页面会提示“视频文件还没有配置”，并允许跳过
  （`config.js` 里 `videoFallback: 'allow'`）
- 正式收数据前建议改成 `'block'`，强制看完

---

## 七、编号与二测等待规则

- 16 位，字符集是 `A-Z` 去掉 `I`、`O`，数字 `2-9` 去掉 `0`、`1`，避免看错
- 用浏览器加密级随机数生成，生成前查重，重复就重新生成
- 编号只在答题结束时生成一次，中途刷新不会变
- 一测提交成功后记录这一时刻；二测需要等满 `test2DelayDays` 天
- 同一个编号只能做一次二测，做完就锁定

**测试开关**：`config.js` 里的 `test2DelayDays`（正式值 `7`）。只有本地模式会被它影响；
Supabase 模式由数据库函数里的 `interval '7 days'` 决定。

**改等待天数**：`config.js` 里的 `test2DelayDays` 和
`supabase/schema.sql` 里两处 `interval '7 days'` 要一起改。
不改 SQL 的话，网页上看着改了，服务器仍然按 7 天算。

如果现在就接 Supabase 做测试，先把 `schema.sql` 里两处 `interval '7 days'`
改成 `interval '0 days'`，测完再改回 7。

---

## 八、数据保存方案

### 为什么不能直接写进 GitHub

GitHub Pages 只能托管网页，不能接收数据。浏览器也没有权限把作答写回仓库。
唯一能“直接写 GitHub”的办法是把带写权限的密钥放进网页源码，
那等于把你的仓库钥匙公开，任何人都能读、改、删数据，不能用于正式问卷。

所以正式方案是：

```
被试浏览器 ──提交──> Supabase（数据库，实时）
                        │
                        └─ GitHub Actions 每 6 小时导出 ──> 私有仓库 records/<编号>.json
```

- **Supabase**：负责实时接收，7 天判断用它的服务器时间
- **私有仓库**：负责长期留存，每个编号一个 JSON 文件，数据仍然在 GitHub 上
- **网页仓库**：公开，只放代码，不放任何作答数据

### 每个编号会保存什么

```
records/ABCDEFGHJKLMNPQR.json
{
  "code": "ABCDEFGHJKLMNPQR",
  "created_at": "2026-10-20T08:12:33Z",   // 一测完成（服务器时间）
  "test2_at": "2026-10-27T09:01:12Z",     // 二测完成
  "test1": {
    "group": "V-B",                         // 分流结果：V-A / V-B / V-C / control
    "answers": { "BFI01": 4, "CRT1": "0.05 元", "D2": "20", ... },  // 105 题原始作答
    "answerText": { "BFI01": "比较同意", ... },   // 选择题/量表的选项文字
    "answerSeconds": { "BFI01": 3.4, ... },       // 逐题首次作答耗时（秒）
    "answersT2": { "CS01": 4, ... },              // 视频后那份问卷（25 题）
    "answerTextT2": { "CS01": "比较符合", ... },
    "answerSecondsT2": { "CS01": 2.1, ... },
    "scores": {
      "bfi": { "E": 2.5, "A": 2.78, "C": 2.78, "N": 2.5, "O": 1.8 },  // 五维均值
      "demo": { "sex": 1, "age": 20, "grade": 1, "major": 1, "living": 1, "online": 1 },
      "crt": { "total": 6, "correct": { "CRT1": true, ... }, "normalized": { ... } },
      "stai": { "total": 50, "answered": 20, "items": { ... } },
      "csstnfqT1": { "total": 37, ... },
      "csstnfqT2": { "total": 37, ... }
    },
    "attention": { "AC1": true, "AC2": true, "AC3": false, "passed": 2, "total": 3 },
    "video": { "group": "V-B", "watched": 96, "ended": true, ... },
    "bankVersion": "A-v2",                // 题库版本
    "timings": { ... },                   // 阶段级时间戳
    "meta": { "ua": "...", "screen": "..." }
  },
  "test2": {
    "answers": { "CS01": 5, ... },        // 7 天后那份问卷（25 题）
    "answerText": { "CS01": "完全符合", ... },
    "answerSeconds": { "CS01": 2.7, ... },
    "scores": { "csstnfqT3": { "total": 41, ... } },   // T3，可与 T1 相减看持续性
    "bankVersion": "A-v2",
    "startedAt": "...",
    "finishedAt": "..."
  }
}
```

原始作答与计分结果同时保存：`answers` 是每题原样，`scores` 是按各段计分规则算出的分数。
两者都留着，既能改算法重算，也能直接拿分数进分析。



**`answerText` 为什么要存**：数据库里只有选项分值，`BFI01: 4` 之所以对应“比较同意”，
靠的是题库里第 4 个选项恰好是“比较同意”。题库一改，同一批数字的含义就变了。
所以提交时把被试当时看到的文字和题库版本一起存下来，旧数据永远能读回来。

**`answerSeconds` 怎么算**：从该题所在页面显示开始，到被试第一次选中为止（秒，一位小数）。
同一题改选不会重置；刷新页面会从页面重新显示起算。用来筛“某题 1 秒内答完”这类无效作答，
不要当精确反应时用。

### 保存时机与失败处理

- **一测**：答完题库 B 点提交后，先写入服务器，**保存成功才显示编号**。
  保存失败会自动重试，页面显示“正在保存”，不需要被试做任何选择。
- **二测**：答完题库 C 点提交后自动保存；失败会自动重试 3 次（间隔 1.2 秒、2.4 秒），
  仍失败才停在提示页，作答仍留在本机，可点“重新尝试”。
- 进入二测前会先核对编号。如果本机没有对应的一测记录，会在输入编号阶段
  直接说明原因，不会让被试答完 C 才报错。
- 一测、二测都以编号为主键存放，**一测数据在一测结束时就已经落库**，
  不是等到二测才写。

### 本地模式（`driver: 'local'`）

数据只存在被试自己的浏览器里，用来测试流程或当面施测。
换设备就查不到，你也收不回来。**正式线上发放不要用这个模式。**

同一台电脑上，`http://localhost:8000` 和 `http://127.0.0.1:8000`
是两个不同的存储空间，测试时请始终用 `start-local.bat` 打开的那个地址，
否则二测会找不到一测记录。

---

## 九、Supabase + 数据仓库 设置（正式发放前必做）

### 1. 建 Supabase 项目

打开 [supabase.com](https://supabase.com) 注册 → New project
（Region 选新加坡/东京，免费额度够几百份问卷）。

### 2. 建表

左侧 **SQL Editor → New query**，把 `supabase/schema.sql` 整段粘进去 → Run。

这个脚本会建两张表并锁死网页端权限：

- `participants`：编号、一测完成时间、二测完成时间
- `survey_responses`：每个编号的 test1 / test2 两份完整作答

网页端只能调用三个函数（提交一测、查二测状态、提交二测），
**读不到任何人的作答内容**，也不能绕过 7 天限制。

### 3. 填配置

左侧 **Project Settings → API**，复制：

- `Project URL`（形如 `https://xxxx.supabase.co`）
- `anon public` key

打开 `assets/js/config.js`：

```js
storage: {
  driver: 'supabase',
  supabase: {
    url: 'https://xxxx.supabase.co',
    anonKey: '粘贴 anon public key',
  },
},
```

重新上传 `config.js` 到网页仓库。

### 4. 建数据备份仓库

新建一个 **Private** 仓库（如 `survey-data`），把 `data-repo/` 里的
`sync.py` 和 `.github/workflows/sync.yml` 上传进去（保持目录结构）。

在私有仓库 **Settings → Secrets and variables → Actions** 添加两个 secret：

| Name | Value |
|---|---|
| `SUPABASE_URL` | 你的 Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase 的 **service_role** key |

然后在 **Actions** 里手动跑一次 `sync-survey-data`，`records/` 就会出现。
之后每 6 小时自动同步。

> `service_role` key 权限很高，只能放在 GitHub Secrets 里，绝不能写进网页。
> 定时任务在仓库连续 60 天无提交时会自动暂停，长期挂着的话记得偶尔手动跑一次。

### 5. 验证一遍

用一个测试编号走完一测，然后在 Supabase **SQL Editor** 里查：

```sql
select code, created_at, test2_at from participants;
select code, stage, created_at from survey_responses order by code, stage;
```

应该看到：`participants` 多了一行、`survey_responses` 多了一条 `test1`。

再验证 7 天门槛（测试阶段如果 SQL 里是 0 天，可先跳过）：

```sql
update participants set created_at = now() - interval '8 days'
where code = '你的测试编号';
```

然后走二测，正常应通过；查库应多一条 `test2`，且 `participants.test2_at` 有值。
最后去私有仓库的 Actions 手动跑一次同步，`records/` 里应出现 `<编号>.json`。

> 安全自检：在 SQL Editor 里执行
> `set role anon; select count(*) from participants;`
> 应该报 `permission denied`。如果能查出来，说明权限没锁住，先别发放。

---

## 十、后续数据筛选

原始数据一律不动，筛选在导出层做。等你的筛选规则给我之后，可以：

- 在私有仓库加一个 `filter.py`，读 `records/`，按规则输出 `filtered.csv` 和排除名单
- 或者给 `admin.html` 加一个筛选界面（本地模式）
- 或者在论文分析时直接用 CSV 里的用时、视频状态、答案模式做排除

现在保存的字段已经够支持常见规则：总用时、各阶段时间、视频是否看完/跳过、
观看时长、逐题答案、设备信息。缺什么字段告诉我再加。

---

## 十一、常见问题

**Q：二测提示“找不到这个编号对应的一测记录”？**
本机存储模式下，一测和二测必须在同一台设备、同一个浏览器、同一个网址下完成。
常见原因：换了浏览器；用了 `localhost` 和 `127.0.0.1` 两个不同地址；
清理过浏览器数据；沿用了改版前的旧进度。重新做一次一测即可。
Supabase 模式不会有这个问题。

**Q：二测提示“还没满 7 天”？**
这是正式规则。页面会显示还需等待多久、几号几点之后可以参加。
测试时想跳过：本地模式把 `test2DelayDays` 改成 `0`；Supabase 模式在 SQL Editor 里执行
`update participants set created_at = now() - interval '8 days' where code = '测试编号';`

**Q：二测提示“未找到该编号”？**
本地模式只能在同一台设备同一浏览器里查；Supabase 模式下任何设备都能查，
如果仍提示找不到，检查编号是否输错。

**Q：打开 test1.html 只看到页头、没有题目？**
直接双击了 html 文件。用 `start-local.bat` 或部署后的网址访问。

**Q：人格结果会不会被试看到？**
页面不展示。视频文件名也是中性的 `video-1/2/3.mp4`。
只有导出数据和 `admin.html` 里能看到类型。

**Q：管理页在 Supabase 模式下为什么没有数据？**
为了不让网页里的公开密钥读到全部作答，云端模式下 `admin.html` 不直接读库。
请到 Supabase 后台（Table Editor → 导出 CSV）或数据备份仓库查看。

**Q：视频不播放？**
检查文件名、路径是否和 `test1.js` 里的 `VIDEO_BY_GROUP` 一致；mp4 是否为 H.264 编码。

**Q：想改首页文案 / 标题？**
改 `config.js` 里的 `studyTitle`、`studyIntro`、`contact`。

**Q：想加题、删题？**
直接改 `surveyA.js` 的 `questions`，注意 `id` 不要重复。
CSV 和备份 JSON 会自动跟着题库变。

**Q：管理页口令安全吗？**
不重要——它只控制本机页面的显示，真正的数据访问控制在数据库里。
但仍然不要把 `admin.html` 的链接发给被试。

---

## 十二、自动测试（可选）

```bash
npm test
```

会检查计分、反向题、编号格式与去重、一测提交幂等、7 天门槛、二测只能提交一次。
改完题库或存储逻辑可以跑一下。
