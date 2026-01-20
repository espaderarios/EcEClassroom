window.currentStudent =
  JSON.parse(localStorage.getItem("currentStudent") || "null");

window.currentTheme = localStorage.getItem("flashcard-theme") || null;
if (window.currentTheme) applyThemePreset(window.currentTheme);

(function cleanupNullQuizScores() {
  let scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  scores = scores.filter(s => s.quizId != null);
  localStorage.setItem("studentQuizScores", JSON.stringify(scores));
})();

const TEACHER_DRAFT_KEY = "teacher_quiz_draft";
const STUDENT_PROFILE_KEY = "student_profile";
const STUDENT_CLASSES_KEY = "student_enrolled_classes";
const TEACHER_CLASSES_KEY = "teacher_classes";
const CLASS_QUIZZES_KEY = "class_quizzes";

function shuffleArray(array) {
  // ...existing code...
}
