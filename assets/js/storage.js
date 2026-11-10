/**
 * 存储层。上层只调 store.*，换存储方式时页面逻辑不用动。
 *
 * local    ：存在被试浏览器（localStorage），只适合本地测试或当面施测
 * supabase ：正式收数据用。网页端只有“提交/查询状态”的权限，
 *            读不到别人的作答；7 天等待由数据库服务器时间判定。
 */
import { CONFIG } from './config.js';

const KEYS = {
  participants: 'qs.participants.v2',
  records: 'qs.records.v2',
};
const PROGRESS_PREFIX = 'qs.progress.';
const DAY_MS = 24 * 60 * 60 * 1000;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 距离可参加二测还剩多久（毫秒）。0 天表示不限制。 */
function waitMs(createdAt, now = Date.now()) {
  const days = Number(CONFIG.flow.test2DelayDays) || 0;
  if (days <= 0) return -1;
  const start = new Date(createdAt).getTime();
  const target = start + days * DAY_MS;
  return target - now;
}

function gateResult(createdAt) {
  const remain = waitMs(createdAt);
  if (remain > 0) {
    return {
      ok: false,
      reason: 'too_early',
      waitSeconds: Math.ceil(remain / 1000),
      createdAt,
    };
  }
  return { ok: true, createdAt };
}

/* ---------------- 本地驱动 ---------------- */

const local = {
  async codeExists(code) {
    return Boolean(read(KEYS.participants, {})[code]);
  },

  async submitTest1(record) {
    const participants = read(KEYS.participants, {});
    const records = read(KEYS.records, {});

    if (participants[record.code]) {
      const prevId = records[record.code]?.test1?.submissionId;
      if (prevId && prevId === record.submissionId) {
        return { ok: true, duplicate: true, createdAt: participants[record.code].createdAt };
      }
      return { ok: false, reason: 'code_exists' };
    }

    const createdAt = new Date().toISOString();
    participants[record.code] = { createdAt, test2At: null };
    records[record.code] = { ...(records[record.code] || {}), test1: record };
    write(KEYS.participants, participants);
    write(KEYS.records, records);
    return { ok: true, createdAt };
  },

  async checkTest2(code) {
    const participant = read(KEYS.participants, {})[code];
    if (!participant) return { ok: false, reason: 'not_found' };

    const record = read(KEYS.records, {})[code];
    if (record?.test1?.eligible === false) return { ok: false, reason: 'not_eligible' };
    if (participant.test2At || record?.test2) return { ok: false, reason: 'already_done' };

    return gateResult(participant.createdAt);
  },

  async submitTest2(code, payload) {
    const participants = read(KEYS.participants, {});
    const participant = participants[code];
    if (!participant) return { ok: false, reason: 'not_found' };

    const records = read(KEYS.records, {});
    if (participant.test2At || records[code]?.test2) {
      if (records[code]?.test2?.submissionId === payload.submissionId) {
        return { ok: true, duplicate: true };
      }
      return { ok: false, reason: 'already_done' };
    }

    const gate = gateResult(participant.createdAt);
    if (!gate.ok) return gate;

    records[code] = { ...(records[code] || {}), test2: payload };
    participant.test2At = new Date().toISOString();
    participants[code] = participant;
    write(KEYS.participants, participants);
    write(KEYS.records, records);
    return { ok: true };
  },

  async listRecords() {
    const participants = read(KEYS.participants, {});
    const records = read(KEYS.records, {});
    const codes = Array.from(new Set([
      ...Object.keys(participants),
      ...Object.keys(records),
    ])).sort();

    return codes.map((code) => ({
      code,
      createdAt: participants[code]?.createdAt || records[code]?.test1?.createdAt || '',
      test2At: participants[code]?.test2At || null,
      test1: records[code]?.test1 || null,
      test2: records[code]?.test2 || null,
      orphan: !participants[code],
    }));
  },

  async clearAll() {
    localStorage.removeItem(KEYS.participants);
    localStorage.removeItem(KEYS.records);
  },
};

/* ---------------- Supabase 驱动 ---------------- */

const supabaseCfg = CONFIG.storage.supabase || {};
const supabaseReady = () => Boolean(supabaseCfg.url && supabaseCfg.anonKey);

async function rpc(name, body) {
  const res = await fetch(`${supabaseCfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseCfg.anonKey,
      Authorization: `Bearer ${supabaseCfg.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`服务器返回 ${res.status}${detail ? `：${detail.slice(0, 120)}` : ''}`);
  }
  return normalizeRpc(await res.json());
}

/** Postgres 返回的是 wait_seconds / created_at，统一成前端使用的驼峰。 */
function normalizeRpc(out) {
  if (!out || typeof out !== 'object') return out;
  return {
    ...out,
    waitSeconds: out.wait_seconds ?? out.waitSeconds,
    createdAt: out.created_at ?? out.createdAt,
  };
}

const supabase = {
  async codeExists(code) {
    const out = await rpc('check_test2', { p_code: code });
    return out?.reason !== 'not_found';
  },

  async submitTest1(record) {
    return rpc('submit_test1', { p_code: record.code, p_payload: record });
  },

  async checkTest2(code) {
    return rpc('check_test2', { p_code: code });
  },

  async submitTest2(code, payload) {
    return rpc('submit_test2', { p_code: code, p_payload: payload });
  },

  async listRecords() {
    throw new Error('云端模式不在这里读数据，请到 Supabase 后台或数据备份仓库查看');
  },

  async clearAll() {
    throw new Error('云端数据请到 Supabase 后台清理');
  },
};

/* ---------------- 对外接口 ---------------- */

const driverName = CONFIG.storage.driver === 'supabase' && supabaseReady() ? 'supabase' : 'local';
if (CONFIG.storage.driver === 'supabase' && !supabaseReady()) {
  console.warn('[storage] 未填写 Supabase 配置，已回退到本地存储');
}

export const store = driverName === 'supabase' ? supabase : local;
export const driver = driverName;

/** 答题进度（中途刷新/关页面后恢复用）。 */
export const progress = {
  load(key) {
    try {
      const raw = localStorage.getItem(PROGRESS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PROGRESS_PREFIX + key, JSON.stringify(value));
    } catch (_) { /* 隐私模式/配额满时忽略，不影响作答 */ }
  },
  clear(key) {
    try {
      localStorage.removeItem(PROGRESS_PREFIX + key);
    } catch (_) { /* ignore */ }
  },
};

/** 把剩余秒数说成“X 天 Y 小时”。 */
export function formatWait(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.ceil((total % 3600) / 60);

  if (days > 0) return `${days} 天${hours ? ` ${hours} 小时` : ''}`;
  if (hours > 0) return `${hours} 小时${minutes ? ` ${minutes} 分钟` : ''}`;
  return `${minutes || 1} 分钟`;
}
