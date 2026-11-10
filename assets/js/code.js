import { CONFIG } from './config.js';

export const CHARSET = CONFIG.code.charset;
export const LENGTH = CONFIG.code.length;

/** 去掉空格、连字符，统一大写。 */
export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 只校验格式（长度 + 字符集），不查是否真的发过。 */
export function isValidFormat(input) {
  const code = normalizeCode(input);
  if (code.length !== LENGTH) return false;
  for (const ch of code) {
    if (!CHARSET.includes(ch)) return false;
  }
  return true;
}

/** 生成一串随机编码（不做去重）。 */
export function randomCode(length = LENGTH, charset = CHARSET) {
  const out = [];
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.getRandomValues) {
    // 用拒绝采样避免取模偏差
    const limit = Math.floor(256 / charset.length) * charset.length;
    const buf = new Uint8Array(length * 2);
    while (out.length < length) {
      cryptoObj.getRandomValues(buf);
      for (const byte of buf) {
        if (byte >= limit) continue;
        out.push(charset[byte % charset.length]);
        if (out.length === length) break;
      }
    }
  } else {
    for (let i = 0; i < length; i += 1) {
      out.push(charset[Math.floor(Math.random() * charset.length)]);
    }
  }

  return out.join('');
}

/**
 * 生成不重复的编码。
 * @param {{isTaken?:(code:string)=>boolean|Promise<boolean>, length?:number, charset?:string, attempts?:number}} opts
 */
export async function generateUniqueCode(opts = {}) {
  const {
    isTaken = async () => false,
    length = LENGTH,
    charset = CHARSET,
    attempts = 24,
  } = opts;

  for (let i = 0; i < attempts; i += 1) {
    const code = randomCode(length, charset);
    if (!(await isTaken(code))) return code;
  }
  throw new Error('编号生成失败，请重试');
}
