const path = require('path');
const { randomUUID } = require('crypto');

function id() {
  return randomUUID();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringify(value, space = 2) {
  if (typeof value === 'string') return value;
  const seen = new WeakSet();

  try {
    return JSON.stringify(
      value,
      (key, item) => {
        if (typeof item === 'bigint') return item.toString();
        if (Buffer.isBuffer(item)) return `[buffer:${item.length}]`;
        if (item && typeof item === 'object') {
          if (seen.has(item)) return '[circular]';
          seen.add(item);
        }
        return item;
      },
      space
    );
  } catch {
    return String(value);
  }
}

function clip(value, limit = 1900) {
  const text = stringify(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function clipBytes(value, limit = 8192) {
  const text = stringify(value);
  if (Buffer.byteLength(text, 'utf8') <= limit) return text;

  let size = 0;
  let output = '';
  for (const char of text) {
    const next = Buffer.byteLength(char, 'utf8');
    if (size + next > Math.max(0, limit - 3)) break;
    size += next;
    output += char;
  }
  return `${output}...`;
}

function redactSecrets(value) {
  return stringify(value)
    .replace(/\b(Bot|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    .replace(/\b(discord[_-]?token|serpapi[_-]?key|api[_-]?key|authorization|cookie|token|secret|password)\b\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[redacted]')
    .replace(/[MN][A-Za-z\d_-]{20,30}\.[A-Za-z\d_-]{6,10}\.[A-Za-z\d_-]{20,40}/g, '[discord-token]')
    .replace(/[A-Za-z]:\\[^\s"'`<>]+/g, '[local-path]')
    .replace(/\/(?:home|root|var|tmp|app)\/[^\s"'`<>]+/g, '[local-path]');
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractJsonPayload(text) {
  const match = text.match(/\bdata:\s*([\s\S]+)/i);
  if (!match) return null;
  const source = match[1].trim();
  const start = source.search(/[\[{]/);
  if (start === -1) return null;

  const open = source[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return parseJson(source.slice(start, i + 1));
  }

  return parseJson(source.slice(start));
}

function normalizeUrl(value) {
  if (!value) return null;
  const clean = String(value).trim().replace(/[)>.,]+$/g, '');
  if (!clean) return null;
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function isPathInside(base, target) {
  const root = path.resolve(base);
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeFilename(value, fallback = 'artifact') {
  const clean = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function codeFence(text) {
  const match = String(text).match(/```([a-z0-9_-]+)?\s*([\s\S]*?)```/i);
  if (!match) return null;
  return {
    language: match[1] ? match[1].toLowerCase() : '',
    code: match[2].trim()
  };
}

function readFields(text, key) {
  const values = [];
  const pattern = new RegExp(`${key}:("([^"]*)"|'([^']*)'|\\S+)`, 'gi');
  let match;

  while ((match = pattern.exec(text))) {
    values.push((match[2] || match[3] || match[1] || '').replace(/^['"]|['"]$/g, ''));
  }

  return values;
}

function readField(text, key) {
  return readFields(text, key)[0] || '';
}

function splitSegments(command) {
  const source = String(command || '').trim();
  const segments = [];
  let buffer = '';
  let fenced = false;

  for (let i = 0; i < source.length; i += 1) {
    if (source.slice(i, i + 3) === '```') {
      fenced = !fenced;
      buffer += '```';
      i += 2;
      continue;
    }

    if (!fenced && source[i] === ';') {
      if (buffer.trim()) segments.push(buffer.trim());
      buffer = '';
      continue;
    }

    if (!fenced) {
      const slice = source.slice(i);
      const match = slice.match(/^\s+(and then|then|puis|ensuite)\s+/i);
      if (match) {
        if (buffer.trim()) segments.push(buffer.trim());
        buffer = '';
        i += match[0].length - 1;
        continue;
      }
    }

    buffer += source[i];
  }

  if (buffer.trim()) segments.push(buffer.trim());
  return segments.length ? segments : [source];
}

function createLock() {
  let tail = Promise.resolve();
  return async (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

function take(items, limit = 10) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

module.exports = {
  id,
  sleep,
  stringify,
  clip,
  clipBytes,
  redactSecrets,
  parseJson,
  extractJsonPayload,
  normalizeUrl,
  isPathInside,
  stripHtml,
  escapeXml,
  safeFilename,
  codeFence,
  readFields,
  readField,
  splitSegments,
  createLock,
  formatMs,
  take
};
