/**
 * Match the visual editor's empty paragraphs without changing Markdown source.
 * Two newlines separate blocks; each additional pair is a blank paragraph.
 * Work on block tokens so whitespace inside code, lists, and HTML stays intact.
 * @param {import('marked').TokensList} tokens
 * @returns {import('marked').TokensList}
 */
export function preserveArticleSpacing(tokens) {
  // Marked sometimes absorbs the separator into a heading, fence, or HTML token.
  const blocks = tokens.flatMap((token, index) => {
    if (token.type === 'space' || tokens[index + 1]?.type === 'space') return [token];
    const blank = token.raw.match(/\n[^\S\n]*(?:\n[^\S\n]*)+$/)?.[0];
    return blank ? [{ ...token, raw: token.raw.slice(0, -blank.length) }, { type: 'space', raw: blank }] : [token];
  });
  const last = blocks.findLastIndex(token => token.type !== 'space');
  const first = blocks.findIndex(token => token.type !== 'space');
  const result = blocks.map((token, index) => {
    if (token.type !== 'space') return token;
    const separators = (token.raw.replace(/\r\n/g, '\n').match(/\n\n/g) || []).length;
    const count = Math.max(0, separators - (index > first && index < last ? 1 : 0));
    if (!count) return token;
    const html = '<p><br></p>\n'.repeat(count);
    return { type: 'html', block: true, raw: html, text: html };
  });
  return Object.assign(result, { links: tokens.links });
}
