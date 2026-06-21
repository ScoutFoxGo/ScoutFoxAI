// ingest.js — RAG Knowledge Base admin ingestion (Addendum 2.7) on top of the
// LMS corpus. Admin uploads a document; it's chunked into lessons carrying
// category, tags, and a version, then becomes retrievable by the closed tutor /
// Scout Guide. No external service — chunking and storage are in-house.

import { addLesson, listLessons } from "./corpus.js";

// Split into reasonably-sized chunks on blank lines / headings, so each chunk
// becomes one retrievable lesson.
function chunk(text, maxChars = 600) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chunks = [];
  let buf = "";
  for (const b of blocks) {
    if ((buf + "\n\n" + b).length > maxChars && buf) {
      chunks.push(buf);
      buf = b;
    } else {
      buf = buf ? `${buf}\n\n${b}` : b;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function ingestDocument({ title, category = "Scout Guide", tags = [], text, version = "1" }) {
  if (!title || !text) throw new Error("title and text are required");
  const parts = chunk(text);
  const lessons = parts.map((part, i) =>
    addLesson({
      title: parts.length > 1 ? `${title} (${i + 1}/${parts.length})` : title,
      topic: category,
      summary: part,
      key_points: [],
      category,
      tags,
      version,
      source: { type: "document", ref: title },
    })
  );
  return { created: lessons.length, version, category, lessons: lessons.map((l) => ({ id: l.id, title: l.title })) };
}

// Admin view: lessons grouped by source document, with version + tags.
export function knowledgeBase() {
  const docs = {};
  for (const l of listLessons()) {
    const ref = l.source?.ref || "(uncategorized)";
    (docs[ref] ||= { document: ref, category: l.category, version: l.version, tags: l.tags || [], chunks: 0 }).chunks++;
  }
  return Object.values(docs);
}
