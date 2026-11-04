export function textMatches(text, query, matchCase = false) {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
  return Array.from(text.matchAll(pattern), match => ({ from: match.index, to: match.index + match[0].length }));
}

// Join adjacent text nodes across emphasis, but never search across block/atom boundaries.
export function documentMatches(doc, query, matchCase = false) {
  const matches = [];
  let text = '', start = 0;
  const flush = () => { matches.push(...textMatches(text, query, matchCase).map(match => ({ from: start + match.from, to: start + match.to }))); text = ''; };
  doc.descendants((node, position) => {
    if (!node.isText) return;
    if (text && position !== start + text.length) flush();
    if (!text) start = position;
    text += node.text;
  });
  flush();
  return matches;
}
