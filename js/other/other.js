function toast(message, duration = 3000) {
  const el = document.createElement('div');
  el.textContent = message;
  el.className = 'toast';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, duration);
}

function saveTeacherDraft(title, questions, timeLimit = 0) {
  localStorage.setItem(
    TEACHER_DRAFT_KEY,
    JSON.stringify({ title, questions, timeLimit })
  );
}
// Other utility functions

function someOtherFunction() {
  // ...existing code...
}

// Additional functions can be added here
