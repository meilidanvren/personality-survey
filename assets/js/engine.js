/** 通用答题引擎：题库A / B / C 共用同一套翻页、校验和进度条逻辑。 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export class Quiz {
  /**
   * @param {object} opts
   * @param {object} opts.bank       题库对象
   * @param {HTMLElement} opts.container 挂载容器
   * @param {object} [opts.answers]  已有作答（用于恢复进度）
   * @param {number} [opts.page]     起始页码
   * @param {number} [opts.pageSize] 每页题数
   * @param {(answers:object)=>void} [opts.onChange]
   * @param {(page:number)=>void} [opts.onPage]
   * @param {(answers:object)=>void} [opts.onComplete]
   */
  constructor(opts) {
    const { bank, container } = opts;
    if (!bank || !container) throw new Error('Quiz: 缺少 bank 或 container');

    this.bank = bank;
    this.container = container;
    this.answers = { ...(opts.answers || {}) };
    // 逐题首次作答耗时（秒）：从该题所在页面显示起算，只记第一次选择
    this.answerSeconds = { ...(opts.answerSeconds || {}) };
    this.shownAt = {};
    this.pageSize = opts.pageSize || bank.pageSize || 8;
    this.sections = bank.sections?.length
      ? bank.sections
      : [{ key: bank.id || 'all', intro: '', questions: bank.questions || [] }];

    // 每套问卷独立分页：另起一页，题号在本套内从 1 开始
    this.pages = [];
    this.sections.forEach((section, sectionIndex) => {
      const size = section.pageSize || this.pageSize;
      const questions = section.questions || [];
      for (let i = 0; i < questions.length; i += size) {
        this.pages.push({
          section,
          sectionIndex,
          questions: questions.slice(i, i + size),
          offset: i,
          isSectionStart: i === 0,
        });
      }
    });
    if (!this.pages.length) {
      this.pages.push({
        section: this.sections[0], sectionIndex: 0, questions: [], offset: 0, isSectionStart: true,
      });
    }
    this.allQuestions = this.pages.flatMap((page) => page.questions);

    this.page = Math.min(Math.max(0, opts.page || 0), this.pages.length - 1);
    this.onChange = opts.onChange || (() => {});
    this.onPage = opts.onPage || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.onTiming = opts.onTiming || (() => {});
    this.done = false;

    this.container.addEventListener('change', (e) => this.handleChange(e));
    this.container.addEventListener('click', (e) => this.handleClick(e));

    this.render(true);
  }

  isAnswered(q) {
    const a = this.answers[q.id];
    if (q.multiple) return Array.isArray(a) && a.length > 0;
    if (typeof a === 'string') return a.trim() !== '';
    return a !== undefined && a !== null;
  }

  answeredCount() {
    return this.allQuestions.filter((q) => this.isAnswered(q)).length;
  }

  handleChange(e) {
    const input = e.target.closest('input[data-qid]');
    if (!input || !this.container.contains(input)) return;

    const qid = input.dataset.qid;
    const q = this.allQuestions.find((x) => x.id === qid);
    if (!q) return;

    if (q.multiple) {
      const vals = [...this.container.querySelectorAll(`input[data-qid="${qid}"]:checked`)]
        .map((el) => Number(el.value));
      this.answers[qid] = vals;
    } else if (q.type === 'text') {
      this.answers[qid] = input.value.trim();
    } else {
      this.answers[qid] = Number(input.value);
    }

    this.clearMissing(qid);

    if (this.answerSeconds[qid] === undefined) {
      const startedAt = this.shownAt[qid] ?? Date.now();
      this.answerSeconds[qid] = Math.round((Date.now() - startedAt) / 100) / 10;
      this.onTiming(this.answerSeconds);
    }

    this.updateMeta();
    this.onChange(this.answers);
  }

  handleClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !this.container.contains(btn)) return;
    if (btn.dataset.act === 'next') this.next();
    if (btn.dataset.act === 'prev') this.prev();
  }

  next() {
    const missing = this.pages[this.page].questions.filter((q) => !this.isAnswered(q));
    if (missing.length) {
      missing.forEach((q) => this.markMissing(q.id));
      this.showAlert(`还有 ${missing.length} 题没有作答，请补充后再继续。`);
      const first = this.container.querySelector(`.q[data-qid="${missing[0].id}"]`);
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.hideAlert();

    if (this.page < this.pages.length - 1) {
      this.page += 1;
      this.render();
      this.onPage(this.page);
    } else if (!this.done) {
      this.done = true;
      this.onComplete(this.answers);
    }
  }

  prev() {
    if (this.page === 0) return;
    this.page -= 1;
    this.render();
    this.onPage(this.page);
  }

  markMissing(qid) {
    const el = this.container.querySelector(`.q[data-qid="${qid}"]`);
    if (el) el.classList.add('missing');
  }

  clearMissing(qid) {
    const el = this.container.querySelector(`.q[data-qid="${qid}"]`);
    if (el) el.classList.remove('missing');
  }

  showAlert(text) {
    const el = this.container.querySelector('[data-el="alert"]');
    if (!el) return;
    el.textContent = text;
    el.classList.add('alert-danger');
    el.hidden = false;
  }

  hideAlert() {
    const el = this.container.querySelector('[data-el="alert"]');
    if (el) el.hidden = true;
  }

  updateMeta() {
    const total = this.allQuestions.length;
    const answered = this.answeredCount();
    const count = this.container.querySelector('[data-el="count"]');
    const bar = this.container.querySelector('[data-el="bar"]');
    if (count) count.textContent = `已答 ${answered} / ${total}`;
    if (bar) bar.style.width = `${total ? (answered / total) * 100 : 0}%`;
  }

  renderQuestion(q, indexOnPage, offset = 0) {
    const num = offset + indexOnPage + 1;
    const cur = this.answers[q.id];
    const legend = `<legend><span class="q-num">${num}.</span>${esc(q.text)}</legend>`;

    if (q.type === 'text') {
      const val = typeof cur === 'string' ? cur : '';
      return `<fieldset class="q" data-qid="${esc(q.id)}">
        ${legend}
        <input class="text-answer" type="text" data-qid="${esc(q.id)}" value="${esc(val)}"
          placeholder="${esc(q.placeholder || '在此填写答案')}" autocomplete="off">
      </fieldset>`;
    }

    const opts = q.options
      ? q.options.map((o, i) => ({ value: o.value ?? i + 1, label: o.text ?? o.label ?? String(o) }))
      : (this.bank.scale || []).map((o) => ({ value: o.value, label: o.label }));

    const isMulti = !!q.multiple;
    const name = `q_${q.id}`;

    const items = opts.map((o) => {
      const checked = isMulti
        ? Array.isArray(cur) && cur.map(Number).includes(Number(o.value))
        : Number(cur) === Number(o.value);
      return `<label class="opt">
        <input type="${isMulti ? 'checkbox' : 'radio'}" name="${esc(name)}" value="${o.value}"
          data-qid="${esc(q.id)}" ${checked ? 'checked' : ''}>
        <span>${esc(o.label)}</span>
      </label>`;
    }).join('');

    return `<fieldset class="q" data-qid="${esc(q.id)}">
      <legend><span class="q-num">${num}.</span>${esc(q.text)}${isMulti ? '<span class="q-tag">多选</span>' : ''}</legend>
      <div class="opts ${opts.length > 5 ? 'opts-long' : ''}">${items}</div>
    </fieldset>`;
  }

  render(isMount = false) {
    const page = this.pages[this.page];
    const pageQs = page.questions;
    const last = this.page === this.pages.length - 1;
    const intro = page.isSectionStart && page.section?.intro
      ? `<div class="sec-head"><p class="sec-intro">${esc(page.section.intro)}</p></div>`
      : '';

    this.container.innerHTML = `<div class="quiz">
      <div class="quiz-meta">
        <span>第 ${this.page + 1} / ${this.pages.length} 页</span>
        <span data-el="count"></span>
      </div>
      <div class="progress"><span data-el="bar"></span></div>
      <form class="quiz-form" novalidate>
        ${intro}
        ${pageQs.map((q, i) => this.renderQuestion(q, i, page.offset)).join('')}
      </form>
      <div class="alert" data-el="alert" hidden></div>
      <div class="nav">
        <button type="button" class="btn btn-ghost" data-act="prev" ${this.page === 0 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="btn btn-primary" data-act="next">${last ? '提交' : '下一页'}</button>
      </div>
    </div>`;

    const seen = Date.now();
    pageQs.forEach((q) => {
      if (this.shownAt[q.id] === undefined) this.shownAt[q.id] = seen;
    });

    this.updateMeta();
    if (!isMount) this.container.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}
