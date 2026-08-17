import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const drafts = join(root, 'docs', 'legal', 'drafts');
const publicSources = join(root, 'docs', 'legal', 'public');
const output = join(root, 'deploy', 'legal-site');
const auditOutput = join(root, 'deploy', 'legal-audit');
const values = JSON.parse(readFileSync(join(root, 'docs', 'legal', 'publish-values.json'), 'utf8'));

const documents = [
  {
    slug: 'privacy',
    title: 'Политика обработки персональных данных',
    summary: 'Какие данные обрабатывает ВИГАЖ, зачем, кому передаёт и как их удалить.',
    source: join(drafts, 'privacy-policy.md'),
    env: null,
  },
  {
    slug: 'terms',
    title: 'Пользовательское соглашение',
    summary: 'Правила использования сервиса, объявлений, заявок, чата и отзывов.',
    source: join(drafts, 'user-agreement.md'),
    env: 'LEGAL_USER_AGREEMENT_SHA256',
  },
  {
    slug: 'personal-data-consent',
    title: 'Согласие на обработку персональных данных',
    summary: 'Отдельное согласие для регистрации, профиля и пользовательских функций.',
    source: join(drafts, 'personal-data-consent.md'),
    env: 'LEGAL_PERSONAL_DATA_SHA256',
  },
  {
    slug: 'personal-data-dissemination-consent',
    title: 'Согласие на распространение персональных данных',
    summary: 'Условия публичного профиля и публикации объявлений.',
    source: join(drafts, 'personal-data-dissemination-consent.md'),
    env: 'LEGAL_DATA_DISSEMINATION_SHA256',
  },
  {
    slug: 'community-standards',
    title: 'Правила публикации и общения',
    summary: 'Критерии неприемлемого контента, жалобы, блокировка и модерация.',
    source: join(publicSources, 'community-standards.md'),
    env: null,
  },
  {
    slug: 'recommendations',
    title: 'Правила рекомендательных технологий',
    summary: 'Как формируются выдача и похожие варианты.',
    source: join(publicSources, 'recommendations.md'),
    env: null,
  },
  {
    slug: 'requisites',
    title: 'Реквизиты владельца сервиса',
    summary: 'ООО «ПРОФИТЕКС», адрес и контакты.',
    source: join(publicSources, 'requisites.md'),
    env: null,
  },
  {
    slug: 'account-deletion',
    title: 'Удаление учетной записи',
    summary: 'Как удалить аккаунт и отозвать согласие на распространение.',
    source: join(publicSources, 'account-deletion.md'),
    env: null,
  },
];

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(value) {
  const code = [];
  let html = escapeHtml(value).replace(/`([^`]+)`/g, (_match, body) => {
    const index = code.push(`<code>${body}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  html = html
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/  $/, '<br>');

  return html.replace(/\u0000CODE(\d+)\u0000/g, (_match, index) => code[Number(index)]);
}

function isTableDivider(line) {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|');
  return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      result.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      result.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? '';

    if (line.startsWith('```')) {
      flushParagraph();
      closeList();
      if (inCode) {
        result.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      closeList();
      const [, hashes, body] = line.match(/^(#{1,6})\s+(.+)$/);
      result.push(`<h${hashes.length}>${inlineMarkdown(body)}</h${hashes.length}>`);
      continue;
    }

    if (line.includes('|') && isTableDivider(next)) {
      flushParagraph();
      closeList();
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      result.push(
        `<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const wanted = ordered ? 'ol' : 'ul';
      if (listType !== wanted) {
        closeList();
        listType = wanted;
        result.push(`<${wanted}>`);
      }
      result.push(`<li>${inlineMarkdown((ordered ?? unordered)[1])}</li>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      closeList();
      result.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (/^\s*(---+|___+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      result.push('<hr>');
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      closeList();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return result.join('\n');
}

function resolveDocument(source) {
  const original = readFileSync(source, 'utf8').replaceAll('\r\n', '\n');
  const missing = new Set();
  const resolved = original.replace(/\{\{([A-Z0-9_]+)}}/g, (_match, key) => {
    const value = String(values[key] ?? '').trim();
    if (!value) missing.add(key);
    return value;
  });
  if (missing.size > 0) {
    throw new Error(`${source}: missing values for ${[...missing].sort().join(', ')}`);
  }
  if (/\{\{[A-Z0-9_]+}}/.test(resolved)) {
    throw new Error(`${source}: unresolved legal placeholders remain`);
  }
  return resolved.endsWith('\n') ? resolved : `${resolved}\n`;
}

function pageTemplate({ title, content, hash }) {
  const canonical = `${values.SERVICE_URL}/legal/${title.slug}/`;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(title.summary)}">
  <meta name="document-version" content="${escapeHtml(values.DOCUMENT_VERSION)}">
  <meta name="document-sha256" content="${hash}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/assets/legal/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/legal/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/legal/legal.css">
  <title>${escapeHtml(title.title)} — ВИГАЖ</title>
</head>
<body>
  ${header()}
  <main class="page">
    <article class="document">
      ${content}
      <div class="document-meta" aria-label="Сведения о редакции документа">
        <span>Версия: <strong>${escapeHtml(values.DOCUMENT_VERSION)}</strong></span>
        <span>SHA-256: <code>${hash}</code></span>
      </div>
    </article>
  </main>
  ${footer()}
</body>
</html>\n`;
}

function header() {
  return `<header class="site-header"><div class="site-header__inner">
    <a class="brand" href="/legal/" aria-label="ВИГАЖ — к правовой информации"><picture>
      <source media="(prefers-color-scheme: dark)" srcset="/assets/legal/logo-full-dark.svg">
      <img src="/assets/legal/logo-full.svg" alt="ВИГАЖ">
    </picture></a>
    <span class="site-header__label">Правовая информация</span>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="site-footer__inner">
    <span>© 2026 ООО «ПРОФИТЕКС»</span>
    <span><a href="mailto:${values.LEGAL_EMAIL}">${values.LEGAL_EMAIL}</a> · <a href="mailto:${values.SUPPORT_EMAIL}">${values.SUPPORT_EMAIL}</a></span>
  </div></footer>`;
}

rmSync(output, { recursive: true, force: true });
rmSync(auditOutput, { recursive: true, force: true });
ensureDirectory(output);
ensureDirectory(auditOutput);
ensureDirectory(join(output, 'legal'));
ensureDirectory(join(output, 'assets', 'legal'));
ensureDirectory(join(auditOutput, 'documents'));

const legacyPublicEnv = join(output, 'legal', 'hashes.env');
if (existsSync(legacyPublicEnv)) unlinkSync(legacyPublicEnv);
const legacyRootEnv = join(root, 'deploy', 'legal-hashes.env');
if (existsSync(legacyRootEnv)) unlinkSync(legacyRootEnv);

copyFileSync(join(root, 'docs', 'legal', 'site', 'legal.css'), join(output, 'assets', 'legal', 'legal.css'));
const logoSource = readFileSync(join(root, 'public_html', 'assets', 'images', 'logo-full.svg'), 'utf8');
writeFileSync(join(output, 'assets', 'legal', 'logo-full.svg'), logoSource, 'utf8');
writeFileSync(
  join(output, 'assets', 'legal', 'logo-full-dark.svg'),
  logoSource.replaceAll('fill="#181A1E"', 'fill="#F4F5F7"'),
  'utf8',
);
copyFileSync(join(root, 'public_html', 'assets', 'images', 'favicon.svg'), join(output, 'assets', 'legal', 'favicon.svg'));
copyFileSync(join(root, 'public_html', 'assets', 'images', 'favicon', 'favicon.ico'), join(output, 'assets', 'legal', 'favicon.ico'));

const manifest = { version: values.DOCUMENT_VERSION, effectiveDate: values.EFFECTIVE_DATE, documents: {} };
const envLines = [`LEGAL_DOCUMENT_VERSION=${values.DOCUMENT_VERSION}`];

for (const document of documents) {
  const resolved = resolveDocument(document.source);
  const hash = createHash('sha256').update(resolved, 'utf8').digest('hex');
  const directory = join(output, 'legal', document.slug);
  ensureDirectory(directory);
  writeFileSync(join(directory, 'index.html'), pageTemplate({ title: document, content: markdownToHtml(resolved), hash }), 'utf8');
  writeFileSync(join(auditOutput, 'documents', `${document.slug}.md`), resolved, 'utf8');
  manifest.documents[document.slug] = {
    title: document.title,
    url: `${values.SERVICE_URL}/legal/${document.slug}/`,
    sha256: hash,
  };
  if (document.env) envLines.push(`${document.env}=${hash}`);
}

const cards = documents
  .map(
    (document) => `<a class="legal-link" href="/legal/${document.slug}/"><strong>${escapeHtml(document.title)}</strong><span>${escapeHtml(document.summary)}</span></a>`,
  )
  .join('\n');

const indexHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Правовые документы и реквизиты сервиса ВИГАЖ.">
  <link rel="canonical" href="${values.SERVICE_URL}/legal/">
  <link rel="icon" href="/assets/legal/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/legal/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/legal/legal.css">
  <title>Правовые документы — ВИГАЖ</title>
</head>
<body>
  ${header()}
  <main class="page">
    <section class="legal-index__intro">
      <h1>Правовые документы</h1>
      <p>Действующие правила сервиса «ВИГАЖ», сведения об обработке персональных данных, модерации пользовательского контента и владельце платформы.</p>
    </section>
    <nav class="legal-list" aria-label="Правовые документы">${cards}</nav>
  </main>
  ${footer()}
</body>
</html>\n`;

writeFileSync(join(output, 'legal', 'index.html'), indexHtml, 'utf8');
writeFileSync(join(output, 'legal', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
writeFileSync(join(auditOutput, 'hashes.env'), `${envLines.join('\n')}\n`, 'utf8');
writeFileSync(join(auditOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
writeFileSync(
  join(output, '.htaccess'),
  `Options -Indexes\nDirectoryIndex index.html\nAddDefaultCharset UTF-8\n<IfModule mod_headers.c>\n  Header always set X-Content-Type-Options "nosniff"\n  Header always set Referrer-Policy "strict-origin-when-cross-origin"\n  Header always set X-Frame-Options "DENY"\n  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"\n</IfModule>\n`,
  'utf8',
);
writeFileSync(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /profile/\nAllow: /legal/\n', 'utf8');

console.log(`Legal site built in ${output}`);
for (const line of envLines) console.log(line);
