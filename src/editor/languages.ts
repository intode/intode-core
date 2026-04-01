import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { xml } from '@codemirror/lang-xml';
import { languages } from '@codemirror/language-data';
import type { Extension } from '@codemirror/state';
import { getExtension } from '../lib/file-utils';

const BUNDLED: Record<string, () => Extension> = {
  js: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  mjs: () => javascript(),
  cjs: () => javascript(),
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  mts: () => javascript({ typescript: true }),
  cts: () => javascript({ typescript: true }),
  py: () => python(),
  pyw: () => python(),
  java: () => java(),
  kt: () => java(),
  kts: () => java(),
  c: () => cpp(),
  h: () => cpp(),
  cpp: () => cpp(),
  hpp: () => cpp(),
  cc: () => cpp(),
  go: () => go(),
  rs: () => rust(),
  html: () => html(),
  htm: () => html(),
  css: () => css(),
  scss: () => css(),
  less: () => css(),
  json: () => json(),
  jsonc: () => json(),
  yaml: () => yaml(),
  yml: () => yaml(),
  sql: () => sql(),
  md: () => markdown(),
  mdx: () => markdown(),
  markdown: () => markdown(),
  php: () => php(),
  xml: () => xml(),
  svg: () => xml(),
};

export async function getLanguageExtension(filename: string): Promise<Extension | null> {
  const ext = getExtension(filename);
  const bundled = BUNDLED[ext];
  if (bundled) return bundled();

  const langDesc = languages.find(l =>
    l.extensions.includes(ext) || l.filename?.test(filename)
  );
  if (langDesc) return await langDesc.load();

  return null;
}
