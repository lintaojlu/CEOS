const SAFE_ID = /^[A-Za-z0-9-]{1,80}$/;
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const IMAGE_REF = /!\[[^\]]*\]\(<?idea-image:([A-Za-z0-9-]{1,80})>?\)/g;
const MAX_IMAGE_CHARS = 12 * 1024 * 1024;

/** @param {string} id */
export function isSafeIdeaId(id) {
  return typeof id === 'string' && SAFE_ID.test(id);
}

export function createIdeaId() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  const rand = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `i${Date.now().toString(36)}${rand}`.slice(0, 80);
}

/** @param {string} value */
function stripDataPrefix(value) {
  const text = String(value || '').trim();
  const match = text.match(/^data:[^;]+;base64,(.+)$/s);
  return (match ? match[1] : text).replace(/\s/g, '');
}

/** @param {unknown} raw */
export function normalizeImages(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  /** @type {Record<string, { mime: string, base64: string }>} */
  const images = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isSafeIdeaId(id) || !value || typeof value !== 'object') continue;
    const mime = String(/** @type {{ mime?: string }} */ (value).mime || '');
    if (!IMAGE_MIMES.has(mime)) continue;
    const base64 = stripDataPrefix(/** @type {{ base64?: string }} */ (value).base64 || '');
    if (!base64 || base64.length > MAX_IMAGE_CHARS) continue;
    images[id] = { mime, base64 };
  }
  return images;
}

/** @param {string} body */
export function referencedImageIds(body) {
  const ids = new Set();
  const text = String(body || '').replace(/idea-image%3A/gi, 'idea-image:');
  for (const match of text.matchAll(IMAGE_REF)) ids.add(match[1]);
  return ids;
}

/**
 * @param {string} body
 * @param {unknown} images
 */
export function pruneImages(body, images) {
  const normalized = normalizeImages(images);
  const used = referencedImageIds(body);
  /** @type {Record<string, { mime: string, base64: string }>} */
  const next = {};
  for (const id of used) {
    if (normalized[id]) next[id] = normalized[id];
  }
  return next;
}

/** 给模型看的正文：去掉 data URL，不带图片字节。 */
export function markdownForModel(body) {
  return String(body || '')
    .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, '')
    .replace(/idea-image%3A/gi, 'idea-image:');
}

/** @param {string} body */
export function canonicalImageMarkdown(body) {
  return String(body || '').replace(
    /!\[([^\]]*)\]\(<?idea-image:([A-Za-z0-9-]{1,80})>?\)/g,
    '![](idea-image:$2)'
  );
}

/** 第一条有字的行，去掉 Markdown 记号。空行和纯图片行跳过。 */
export function firstLineTitle(body) {
  const lines = String(body || '').split(/\r?\n/);
  for (const line of lines) {
    const plain = ideaExcerpt(line);
    if (plain) return plain;
  }
  return '';
}

/**
 * 旧文件里单独存的标题并进正文。第一行已经是这句话时不重复。
 * @param {string} title
 * @param {string} body
 */
export function foldStoredTitle(title, body) {
  const stored = String(title || '').trim();
  const text = String(body || '');
  if (!stored || firstLineTitle(text) === stored) return text;
  return text.trim() ? `${stored}\n\n${text}` : stored;
}

/** @param {any} idea */
export function ideaTitle(idea) {
  return firstLineTitle(ideaBody(idea));
}

/** @param {any} idea */
export function ideaBody(idea) {
  return String(idea?.body ?? idea?.note ?? '');
}

/** 列表用的一行纯文本。去掉 Markdown 记号和图片引用。 */
export function ideaExcerpt(body) {
  let text = String(body || '');
  text = text.replace(/\\/g, '');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/idea-image%3A[A-Za-z0-9-]{1,80}/gi, ' ');
  text = text.replace(/idea-image:[A-Za-z0-9-]{1,80}/gi, ' ');
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, inner) => ` ${inner} `);
  text = text.replace(/`([^`]*)`/g, '$1');
  text = text.replace(/`+/g, '');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*([-*_])\1{2,}\s*$/gm, ' ');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '');
  text = text.replace(/[*_~]+/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/** 第一行之后的正文，给「标题 + 其余」重新拼回去。 */
export function bodyAfterTitle(body) {
  const lines = String(body || '').split(/\r?\n/);
  const index = lines.findIndex((line) => ideaExcerpt(line));
  if (index === -1) return '';
  return lines.slice(index + 1).join('\n').replace(/^\n/, '');
}

/** 第一行之后的纯文本，给列表摘要用。 */
export function ideaPreview(body) {
  const lines = String(body || '').split(/\r?\n/);
  let seen = false;
  const rest = [];
  for (const line of lines) {
    if (!seen) {
      if (ideaExcerpt(line)) seen = true;
      continue;
    }
    rest.push(line);
  }
  return ideaExcerpt(rest.join('\n'));
}

/**
 * @param {any} [input]
 */
export function createIdeaDocument(input = {}) {
  const id = isSafeIdeaId(input.id) ? input.id : createIdeaId();
  const body = canonicalImageMarkdown(foldStoredTitle(
    String(input.title ?? input.text ?? ''),
    String(input.body ?? input.note ?? '')
  ));
  const title = firstLineTitle(body);
  return {
    id,
    title,
    body,
    images: pruneImages(body, input.images),
    completed: !!input.completed,
    pinned: !!input.pinned,
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now()
  };
}

/** @param {any} raw */
export function hydrateIdea(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? raw.text ?? '');
  const body = String(raw.body ?? raw.note ?? '');
  if (!raw.id && !title && !body) return null;
  const doc = createIdeaDocument({ ...raw, title, body });
  return { ...doc, text: doc.title, note: doc.body };
}

/** 写进文件的字段。标题就是正文第一行，不另存。不含截止日期。 */
export function toIdeaFile(doc) {
  const idea = hydrateIdea(doc) || createIdeaDocument(doc);
  return {
    id: idea.id,
    body: idea.body,
    images: idea.images,
    completed: !!idea.completed,
    pinned: !!idea.pinned,
    createdAt: idea.createdAt
  };
}

/**
 * 把 workspace 里的旧灵感变成文件文档。不安全的 id 会换成新 id。
 * @param {any[]} ideas
 */
export function migrateWorkspaceIdeas(ideas) {
  const used = new Set();
  /** @type {ReturnType<typeof hydrateIdea>[]} */
  const documents = [];
  for (const raw of ideas || []) {
    if (!raw || typeof raw !== 'object') continue;
    const title = String(raw.title ?? raw.text ?? '');
    const body = String(raw.body ?? raw.note ?? '');
    if (!raw.id && !title && !body) continue;
    let id = isSafeIdeaId(raw.id) ? raw.id : createIdeaId();
    while (used.has(id)) id = createIdeaId();
    used.add(id);
    const doc = hydrateIdea({
      id,
      title,
      body,
      images: raw.images,
      completed: raw.completed,
      pinned: raw.pinned,
      createdAt: raw.createdAt
    });
    if (doc) documents.push(doc);
  }
  return documents;
}
