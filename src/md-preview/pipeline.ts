import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { getRemarkExtensions, getRehypeExtensions } from './pipeline-extensions';

export async function renderMarkdown(source: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEmoji)
    .use(remarkFrontmatter) as any;

  // Pro-injected remark plugins (e.g. remark-math)
  for (const [plugin, options] of getRemarkExtensions()) {
    processor.use(plugin, options);
  }

  processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight)
    .use(rehypeSlug);

  // Pro-injected rehype plugins (e.g. rehype-katex)
  for (const [plugin, options] of getRehypeExtensions()) {
    processor.use(plugin, options);
  }

  processor.use(rehypeStringify);

  const result = await processor.process(source);
  return String(result);
}
