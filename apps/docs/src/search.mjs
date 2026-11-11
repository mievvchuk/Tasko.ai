// Пошук по довідці: кожне слово запиту має бути в заголовку, описі або тексті статті.
// Регістр і різні апострофи (' ’ ʼ) не враховуються; статті зі збігом у заголовку — вище.
const normalize = (text) => text.toLocaleLowerCase().replace(/[’ʼ`]/g, "'");

export function searchDocs(docs, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return docs
    .map((doc) => {
      const title = normalize(doc.title);
      const text = normalize(doc.text);
      const all = `${title} ${normalize(doc.description)} ${text}`;
      if (!words.every((word) => all.includes(word))) return null;
      const score = words.filter((word) => title.includes(word)).length;
      return { ...doc, score, snippet: snippet(doc, text.indexOf(words[0])) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

// Уривок тексту довкола першого збігу; без збігу в тексті — опис статті
function snippet(doc, at) {
  if (at < 0) return doc.description;
  const start = Math.max(0, doc.text.lastIndexOf(" ", Math.max(0, at - 40)));
  const end = doc.text.indexOf(" ", at + 100);
  return `${start > 0 ? "…" : ""}${doc.text.slice(start, end < 0 ? undefined : end).trim()}${end < 0 ? "" : "…"}`;
}
