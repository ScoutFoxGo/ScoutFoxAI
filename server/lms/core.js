// core.js — the LMS Core orchestrator.
//
// One coherent learning flow over the closed corpus: enroll in a course, get the
// adaptive next step (a lesson + a generated quiz, or a review, or completion),
// submit answers to update mastery, and track progress to a certificate. Adaptive
// (teaches the weakest material first) and spaced-repetition aware. Closed and
// in-house; assessment + tutoring run on Scout's own dual-provider brain.

import { getCourse, lessonsForCourse } from "./courses.js";
import { quizFor } from "./assess.js";
import { getLearner, recordAttempt, enroll as enrollLearner, scheduleReview } from "./learner.js";

const lessonCard = (l) => ({ id: l.id, title: l.title, topic: l.topic, summary: l.summary, key_points: l.key_points || [] });
const masteryOfTopic = (learner, topic) => learner.topics[topic]?.mastery ?? 0;

export function enroll(userId, courseId) {
  const course = getCourse(courseId);
  if (!course) throw new Error("course not found");
  enrollLearner(userId, courseId);
  return courseProgress(userId, courseId);
}

// The adaptive next step in a course.
export async function nextStep(userId, courseId) {
  const course = getCourse(courseId);
  if (!course) throw new Error("course not found");
  const lessons = lessonsForCourse(course);
  if (!lessons.length) return { type: "empty", reason: "no lessons in this course yet — the self-learning loop will add them" };

  const learner = getLearner(userId);
  const seen = new Set(learner.seen_lessons || []);

  // 1) next unseen lesson in order
  const fresh = lessons.find((l) => !seen.has(l.id));
  if (fresh) {
    return { type: "lesson", course: course.id, lesson: lessonCard(fresh), quiz: await quizFor(fresh), reason: "next lesson in the path" };
  }

  // 2) all seen — done if passed, else review the weakest
  const prog = courseProgress(userId, courseId);
  if (prog.passed) return { type: "done", course: course.id, reason: `course complete — mastery ${prog.mastery}`, certificate: prog.certificate };

  const weakest = [...lessons].sort((a, b) => masteryOfTopic(learner, a.topic) - masteryOfTopic(learner, b.topic))[0];
  return { type: "review", course: course.id, lesson: lessonCard(weakest), quiz: await quizFor(weakest), reason: `review to reach ${Math.round(course.passing_mastery * 100)}% mastery` };
}

// Submit quiz answers → update mastery + schedule the next spaced review.
export function submit(userId, lessonId, answers) {
  const result = recordAttempt(userId, lessonId, answers || []);
  const review = scheduleReview(userId, lessonId, result.mastery);
  return { ...result, next_review_in_days: review.interval_days };
}

// Progress + a certificate once every lesson is seen and mastery clears the bar.
export function courseProgress(userId, courseId) {
  const course = getCourse(courseId);
  if (!course) throw new Error("course not found");
  const lessons = lessonsForCourse(course);
  const learner = getLearner(userId);
  const seen = new Set(learner.seen_lessons || []);

  const completed = lessons.filter((l) => seen.has(l.id)).length;
  const topics = [...new Set(lessons.map((l) => l.topic))];
  const mastery = topics.length ? topics.reduce((s, t) => s + masteryOfTopic(learner, t), 0) / topics.length : 0;
  const percent = lessons.length ? Math.round((100 * completed) / lessons.length) : 0;
  const passed = lessons.length > 0 && completed === lessons.length && mastery >= course.passing_mastery;

  return {
    course: course.id,
    title: course.title,
    enrolled: Boolean(learner.courses[courseId]),
    lessons: lessons.length,
    completed,
    percent_complete: percent,
    mastery: Number(mastery.toFixed(2)),
    passing_mastery: course.passing_mastery,
    passed,
    certificate: passed
      ? { id: `cert_${course.id}_${userId}`, learner: userId, course: course.title, mastery: Number(mastery.toFixed(2)), issued_at: new Date().toISOString() }
      : null,
  };
}
