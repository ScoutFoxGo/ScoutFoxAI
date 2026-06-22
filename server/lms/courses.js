// courses.js — the curriculum layer of the LMS Core.
//
// A Course groups corpus lessons into an ordered learning path. Courses can be
// authored explicitly, but the Core also AUTO-BUILDS a curriculum from whatever
// topics exist in the corpus, so the LMS works out of the box and grows as the
// self-learning loop adds lessons. Closed and in-house — no external content.

import { load, save } from "./jsondb.js";
import { listLessons, listTopics } from "./corpus.js";

const FILE = "lms_courses";
const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Author a course explicitly. body: { title, description?, topic?, lessonIds?[],
// passing_mastery? }. Either `topic` (all lessons in that topic) or `lessonIds`.
export function createCourse({ title, description = "", topic = null, lessonIds = null, passing_mastery = 0.7 } = {}) {
  if (!title) throw new Error("title required");
  const db = load(FILE, {});
  const id = slug(title);
  const course = { id, title, description, topic, lessonIds, passing_mastery, authored: true, created_at: new Date().toISOString() };
  db[id] = course;
  save(FILE, db);
  return course;
}

// The lessons of a course, in order (newest-first from the corpus → reversed to
// oldest-first so a path reads naturally).
function lessonsForCourse(course) {
  const all = listLessons();
  let picked;
  if (course.lessonIds && course.lessonIds.length) {
    const byId = Object.fromEntries(all.map((l) => [l.id, l]));
    picked = course.lessonIds.map((id) => byId[id]).filter(Boolean);
  } else if (course.topic) {
    picked = all.filter((l) => l.topic === course.topic).reverse();
  } else {
    picked = all.slice().reverse();
  }
  return picked;
}

// All courses: authored ones + an auto-curriculum (one course per corpus topic).
export function listCourses() {
  const authored = Object.values(load(FILE, {}));
  const authoredTopics = new Set(authored.map((c) => c.topic).filter(Boolean));
  const auto = Object.keys(listTopics())
    .filter((t) => !authoredTopics.has(t))
    .map((t) => ({
      id: slug(t),
      title: t,
      description: `Auto-curriculum from the "${t}" lessons in Scout's knowledge base.`,
      topic: t,
      lessonIds: null,
      passing_mastery: 0.7,
      authored: false,
    }));
  return [...authored, ...auto];
}

export function getCourse(id) {
  return listCourses().find((c) => c.id === id) || null;
}

// Full outline: course meta + ordered lessons (id/title/topic only).
export function courseOutline(id) {
  const course = getCourse(id);
  if (!course) return null;
  const lessons = lessonsForCourse(course).map((l) => ({ id: l.id, title: l.title, topic: l.topic }));
  return { ...course, lesson_count: lessons.length, lessons };
}

export { lessonsForCourse };
