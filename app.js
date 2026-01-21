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
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function toast(message, duration = 3000) {
  const el = document.createElement('div');
  el.textContent = message;
  el.className = 'toast';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }, duration);
}

// ============= MODERN DESIGN HELPERS =============

/**
 * Wrapper for modern card layout
 */
function createCard(content, { header = null, footer = null, elevated = false, className = '' } = {}) {
  let headerHtml = '';
  let footerHtml = '';
  
  if (header) {
    headerHtml = `<div class="card-header">${header}</div>`;
  }
  
  if (footer) {
    footerHtml = `<div class="card-footer">${footer}</div>`;
  }
  
  return `<div class="card ${elevated ? 'elevated' : ''} ${className} animate-slideInUp">${headerHtml}<div class="card-body">${content}</div>${footerHtml}</div>`;
}

/**
 * Create a modern button with consistent styling
 */
function createButton(text, { onclick = '', variant = 'primary', icon = '', className = '' } = {}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    danger: 'btn-danger',
    text: 'btn-text'
  };
  
  return `<button class="${variants[variant] || 'btn-primary'} ${className}" onclick="${onclick}">${icon ? `${icon} ` : ''}${text}</button>`;
}

/**
 * Modern grid container
 */
function createGrid(items, { columns = 'grid-cols-2', gap = 'gap-lg' } = {}) {
  return `<div class="grid ${columns} ${gap}">${items.join('')}</div>`;
}

/**
 * Modern section with consistent spacing
 */
function createSection(title, content, { subtitle = '' } = {}) {
  return `
    <section class="p-xl">
      <h2 class="text-2xl font-bold mb-md">${title}</h2>
      ${subtitle ? `<p class="text-muted mb-lg">${subtitle}</p>` : ''}
      ${content}
    </section>
  `;
}

function saveTeacherDraft(title, questions, timeLimit = 0) {
  localStorage.setItem(
    TEACHER_DRAFT_KEY,
    JSON.stringify({ title, questions, timeLimit })
  );
}

function loadTeacherDraft() {
  const raw = localStorage.getItem(TEACHER_DRAFT_KEY);
  return raw ? JSON.parse(raw) : { title: "", questions: [], timeLimit: 0 };
}


function clearTeacherDraft() {
  localStorage.removeItem(TEACHER_DRAFT_KEY);
}

// ============= PROFILE & CLASS STORAGE FUNCTIONS =============

function saveStudentProfile(profileData) {
  localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profileData));
  // Sync to backend asynchronously
  syncStudentProfileToBackend(profileData);
}

function getStudentProfile() {
  const user = getUser();
  const profile = JSON.parse(localStorage.getItem(STUDENT_PROFILE_KEY) || "{}");
  
  // If user is logged in with Google, use Google data as primary source
  if (user && user.provider === 'google') {
    return {
      ...profile,
      name: user.name || profile.name || "",
      email: user.email || profile.email || "",
      googleId: user.googleId || profile.googleId,
      googleEmail: user.googleEmail || user.email || profile.googleEmail,
      profilePictureUrl: user.picture || profile.profilePictureUrl,
      id: profile.id || user.id,
      school: profile.school || "",
      yearLevel: profile.yearLevel || ""
    };
  }
  
  return profile || {
    name: window.currentStudent?.name || "",
    id: window.currentStudent?.id || "",
    email: "",
    school: "",
    yearLevel: "",
    profilePictureUrl: null,
    googleId: null,
    googleEmail: null
  };
}

function saveClass(classData) {
  const classes = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  const exists = classes.find(c => c.id === classData.id);
  
  if (exists) {
    Object.assign(exists, classData);
  } else {
    classes.push(classData);
  }
  
  localStorage.setItem(TEACHER_CLASSES_KEY, JSON.stringify(classes));
  // Sync to backend asynchronously
  syncClassToBackend(classData);
}

function getTeacherClasses(teacherId) {
  const classes = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  return classes.filter(c => c.teacherId === teacherId);
}

function getClassById(classId) {
  const classes = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  return classes.find(c => c.id === classId);
}

function deleteClass(classId) {
  const classes = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  const filtered = classes.filter(c => c.id !== classId);
  localStorage.setItem(TEACHER_CLASSES_KEY, JSON.stringify(filtered));
}

function enrollStudentInClass(classCode) {
  const classes = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  const targetClass = classes.find(c => c.classCode === classCode);
  
  if (!targetClass) {
    return { success: false, error: "Invalid class code" };
  }
  
  const studentId = window.currentStudent?.id;
  if (!studentId) {
    return { success: false, error: "Student ID not found" };
  }
  
  const enrolledClasses = JSON.parse(localStorage.getItem(STUDENT_CLASSES_KEY) || "[]");
  const alreadyEnrolled = enrolledClasses.some(e => e.classId === targetClass.id && e.studentId === studentId);
  
  if (alreadyEnrolled) {
    return { success: false, error: "Already enrolled in this class" };
  }
  
  const enrollment = {
    classId: targetClass.id,
    className: targetClass.name,
    teacherId: targetClass.teacherId,
    studentId: studentId,
    enrolledAt: new Date().toISOString()
  };
  
  enrolledClasses.push(enrollment);
  localStorage.setItem(STUDENT_CLASSES_KEY, JSON.stringify(enrolledClasses));
  // Sync to backend asynchronously
  syncEnrollmentToBackend(enrollment);
  
  return { success: true };
}

function getStudentEnrolledClasses(studentId = null) {
  if (!studentId) {
    studentId = window.currentStudent?.id;
  }
  
  const enrolledClasses = JSON.parse(localStorage.getItem(STUDENT_CLASSES_KEY) || "[]");
  return enrolledClasses.filter(e => e.studentId === studentId);
}

function getClassQuizzes(classId) {
  const classQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  return classQuizzes.filter(q => q.classId === classId);
}

function saveClassQuiz(quizData) {
  const classQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  const exists = classQuizzes.find(q => q.id === quizData.id && q.classId === quizData.classId);
  
  if (exists) {
    Object.assign(exists, quizData);
  } else {
    classQuizzes.push(quizData);
  }
  
  localStorage.setItem(CLASS_QUIZZES_KEY, JSON.stringify(classQuizzes));
}

function getLetterGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function getGradeColor(grade) {
  switch(grade) {
    case 'A': return '#22c55e'; // green
    case 'B': return '#3b82f6'; // blue
    case 'C': return '#f59e0b'; // orange
    case 'D': return '#ef4444'; // red
    case 'F': return '#7f1d1d'; // dark red
    default: return 'var(--primary)';
  }
}

function getStudentQuizAttempts(studentId, quizId) {
  const scores = JSON.parse(localStorage.getItem('studentQuizScores') || '[]');
  if (!Array.isArray(scores)) return [];
  return scores.filter(s => s && s.studentId === studentId && s.quizId === quizId);
}

function getQuizAttemptLimit(classId, quizId) {
  const limits = JSON.parse(localStorage.getItem('quizAttemptLimits') || '{}');
  const key = `${classId}_${quizId}`;
  return limits[key] || 3; // Default 3 attempts
}

function setQuizAttemptLimit(classId, quizId, limit) {
  const limits = JSON.parse(localStorage.getItem('quizAttemptLimits') || '{}');
  const key = `${classId}_${quizId}`;
  limits[key] = limit;
  localStorage.setItem('quizAttemptLimits', JSON.stringify(limits));
}

function initTeacherView() {
  // 1️⃣ Restore draft
  const draft = loadTeacherDraft();
  if (draft) {
    teacherQuestions = draft.questions || teacherQuestions;
    window._teacherTitleDraft = draft.title || "";
  } else {
    window._teacherTitleDraft = "";
  }

  // 2️⃣ Setup back button AFTER render
  requestAnimationFrame(() => {
    const backBtn = document.getElementById("backBtnTeacherQuiz");
    if (!backBtn) return;

    backBtn.style.display = "block";

    backBtn.onclick = () => {
      currentView = "home";
      renderApp();
    };
  });
}

const AI_API_URL =
  "https://flashcards-ai-backend.onrender.com/api/generate-cards";

// Get backend URL - use from localStorage or default
function getBackendUrl() {
  const stored = localStorage.getItem('backendUrl');
  // Skip localhost URLs from old dev sessions
  if (stored && !stored.includes('localhost') && !stored.includes('127.0.0.1')) {
    return stored;
  }
  return 'https://ec-eclassroom-backend.espaderarios.workers.dev';
}

// Set backend URL (can be called to configure)
function setBackendUrl(url) {
  localStorage.setItem('backendUrl', url.replace(/\/$/, '')); // Remove trailing slash
  toast(`✅ Backend URL set to: ${url}`);
}

// ============= BACKEND SYNC FUNCTIONS =============

async function syncQuizToBackend(quiz) {
  const user = getUser();
  if (!user || !user.authenticated) return null;
  
  try {
    const quizData = {
      ...quiz,
      userId: user.id,
      userEmail: user.email,
      lastSyncedAt: new Date().toISOString()
    };
    
    const response = await fetch(`${getBackendUrl()}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quizData)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Quiz synced to backend:', data);
      return data;
    } else {
      console.log('Failed to sync quiz:', response.status);
    }
  } catch (error) {
    console.log('Quiz sync error:', error);
  }
  return null;
}

async function loadQuizzesFromBackend() {
  const user = getUser();
  if (!user || !user.authenticated) return [];
  
  try {
    const response = await fetch(`${getBackendUrl()}/api/quizzes`);
    if (!response.ok) return [];
    
    const quizzes = await response.json();
    
    if (Array.isArray(quizzes)) {
      // Filter quizzes for current user
      const userQuizzes = quizzes.filter(q => q.userId === user.id);
      console.log(`Loaded ${userQuizzes.length} quizzes from backend`);
      return userQuizzes;
    }
  } catch (error) {
    console.log('Failed to load quizzes from backend:', error);
  }
  return [];
}

async function loadStudentAttemptsFromBackend() {
  const user = getUser();
  if (!user || !user.authenticated) return [];
  
  try {
    const response = await fetch(`${getBackendUrl()}/api/attempts`);
    if (!response.ok) return [];
    
    const attempts = await response.json();
    
    if (Array.isArray(attempts)) {
      // Filter attempts for current user
      const userAttempts = attempts.filter(a => a.studentId === user.id);
      console.log(`Loaded ${userAttempts.length} quiz attempts from backend`);
      return userAttempts;
    }
  } catch (error) {
    console.log('Failed to load attempts from backend:', error);
  }
  return [];
}

async function saveQuizAttemptToBackend(attempt) {
  const user = getUser();
  if (!user || !user.authenticated) return null;
  
  try {
    const attemptData = {
      ...attempt,
      studentId: user.id,
      studentEmail: user.email,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(`${getBackendUrl()}/api/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attemptData)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Quiz attempt saved to backend');
      return data;
    }
  } catch (error) {
    console.log('Failed to save quiz attempt:', error);
  }
  return null;
}

async function linkGoogleAccountToLocalUser(localUserId, googleUserId) {
  try {
    const response = await fetch(`${getBackendUrl()}/auth/link-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localUserId, googleUserId })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('Failed to link accounts on backend:', error);
  }
  return null;
}

async function syncClassToBackend(classData) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('Backend sync failed, using local storage only:', error);
  }
  return null;
}

async function syncStudentProfileToBackend(profile) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('Backend sync failed, using local storage only:', error);
  }
  return null;
}

async function syncTeacherProfileToBackend(profile) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('Backend sync failed, using local storage only:', error);
  }
  return null;
}

async function syncEnrollmentToBackend(enrollment) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrollment)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.log('Backend sync failed, using local storage only:', error);
  }
  return null;
}

// ============= LOAD FROM BACKEND ON STARTUP =============

async function loadClassesFromBackend() {
  try {
    const response = await fetch(`${getBackendUrl()}/api/classes`);
    if (response.ok) {
      const classes = await response.json();
      if (Array.isArray(classes) && classes.length > 0) {
        // Merge with local data (backend is source of truth)
        const localClasses = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
        const merged = [...classes];
        
        // Add any local-only classes
        localClasses.forEach(local => {
          if (!merged.find(c => c.id === local.id)) {
            merged.push(local);
            // Sync local-only class to backend
            syncClassToBackend(local);
          }
        });
        
        localStorage.setItem(TEACHER_CLASSES_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (error) {
    console.log('Could not load classes from backend:', error);
  }
  return JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
}

async function loadStudentProfileFromBackend(studentId) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/students/${studentId}`);
    if (response.ok) {
      const profile = await response.json();
      localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
      return profile;
    }
  } catch (error) {
    console.log('Could not load student profile from backend:', error);
  }
  return getStudentProfile();
}

async function loadTeacherProfileFromBackend(teacherId) {
  try {
    const response = await fetch(`${getBackendUrl()}/api/teachers/${teacherId}`);
    if (response.ok) {
      const profile = await response.json();
      localStorage.setItem("teacherProfile", JSON.stringify(profile));
      return profile;
    }
  } catch (error) {
    console.log('Could not load teacher profile from backend:', error);
  }
  return getTeacherProfile();
}

async function loadEnrollmentsFromBackend() {
  try {
    const response = await fetch(`${getBackendUrl()}/api/enrollments`);
    if (response.ok) {
      const enrollments = await response.json();
      if (Array.isArray(enrollments) && enrollments.length > 0) {
        const localEnrollments = JSON.parse(localStorage.getItem(STUDENT_CLASSES_KEY) || "[]");
        const merged = [...enrollments];
        
        // Add any local-only enrollments
        localEnrollments.forEach(local => {
          if (!merged.find(e => e.classId === local.classId && e.studentId === local.studentId)) {
            merged.push(local);
            syncEnrollmentToBackend(local);
          }
        });
        
        localStorage.setItem(STUDENT_CLASSES_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (error) {
    console.log('Could not load enrollments from backend:', error);
  }
  return JSON.parse(localStorage.getItem(STUDENT_CLASSES_KEY) || "[]");
}

// Initialize backend sync on app load
async function initBackendSync() {
  console.log('🔄 Syncing with backend...');
  
  const user = getUser();
  
  // Load all data from backend
  await Promise.all([
    loadClassesFromBackend(),
    loadEnrollmentsFromBackend()
  ]);
  
  // Load quizzes if authenticated with Google
  if (user && user.authenticated && user.provider === 'google') {
    console.log('📚 Loading quizzes from backend...');
    await getTeacherQuizzes();
    
    console.log('📋 Loading quiz attempts from backend...');
    const attempts = await loadStudentAttemptsFromBackend();
    if (attempts.length > 0) {
      const key = 'studentQuizScores';
      const localAttempts = JSON.parse(localStorage.getItem(key) || '[]');
      
      // Merge backend attempts with local ones
      const attemptMap = new Map();
      attempts.forEach(a => attemptMap.set(a.id, a));
      localAttempts.forEach(a => {
        if (a.id && !attemptMap.has(a.id)) {
          attemptMap.set(a.id, a);
        }
      });
      
      localStorage.setItem(key, JSON.stringify(Array.from(attemptMap.values())));
      console.log(`✅ Synced ${attempts.length} quiz attempts`);
    }
  }
  
  // Load user-specific profiles if logged in
  if (window.currentStudent?.id) {
    await loadStudentProfileFromBackend(window.currentStudent.id);
  }
  
  const teacherId = window.currentTeacher?.id || localStorage.getItem('currentTeacherId');
  if (teacherId) {
    await loadTeacherProfileFromBackend(teacherId);
  }
  
  console.log('✅ Backend sync complete');
}

// Helper: call the backend GROQ proxy
async function fetchGroq({ projectId, dataset = 'production', query, params = {} }) {
  if (!projectId || !query) throw new Error('projectId and query are required');
  const base = getBackendUrl().replace(/\/$/, '');
  const url = `${base}/api/groq`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, dataset, query, params })
  });

  const text = await resp.text().catch(() => null);
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }

  if (!resp.ok) {
    const errMsg = (data && data.error) ? data.error : text || `Status ${resp.status}`;
    throw new Error(`GROQ proxy error: ${errMsg}`);
  }

  return data;
}

const defaultConfig = {
  app_title: "Flashcard Study",
  app_subtitle: "Create custom subjects and master your knowledge",
  background_color: "#f0f4f8",
  card_background: "#ffffff",
  primary_color: "#2563eb",
  text_color: "#1e293b",
  secondary_color: "#64748b"
};

const DEFAULT_SETTINGS = {
  theme: "light",
  colors: {
    primary: "#2563eb",
    background: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a"
  },
  font: {
    family: "Open Sans",
    size: 16,
    lineHeight: 1.6
  },
  layout: {
    radius: 16,
    cardSize: "normal",
    animation: "flip"
  },
  layoutMode: "auto"
};

const THEME_PRESETS = {

  light: {
    colors: {
      primary: "#2563eb",
      primaryHover: "#1d4ed8",
      primaryDark: "#1e40af",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#f59e0b",
      accentDark: "#d97706",
      background: "#f8fafc",
      card: "#ffffff",
      surface: "#f1f5f9",
      surfaceHover: "#e2e8f0",
      text: "#1e293b",
      textMuted: "#64748b",
      textSecondary: "#475569",
      success: "#10b981",
      successDark: "#059669",
      error: "#ef4444",
      errorDark: "#dc2626",
      warning: "#f59e0b",
      warningDark: "#d97706",
      border: "#e2e8f0",
      borderHover: "#cbd5e1"
    },
    fonts: {
      family: "'Inter', system-ui, -apple-system, sans-serif",
      headingFamily: "'Inter', system-ui, -apple-system, sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 0, 0, 0.1)",
      colorLg: "rgba(0, 0, 0, 0.15)"
    },
    glass: {
      background: "rgba(255, 255, 255, 0.95)",
      border: "rgba(255, 255, 255, 0.2)"
    }
  },

  dark: {
    colors: {
      primary: "#60a5fa",
      primaryHover: "#3b82f6",
      primaryDark: "#2563eb",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#fbbf24",
      accentDark: "#f59e0b",
      background: "#020617",
      card: "#0f172a",
      surface: "#1e293b",
      surfaceHover: "#334155",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      textSecondary: "#cbd5e1",
      success: "#34d399",
      successDark: "#10b981",
      error: "#f87171",
      errorDark: "#ef4444",
      warning: "#fbbf24",
      warningDark: "#f59e0b",
      border: "#334155",
      borderHover: "#475569"
    },
    fonts: {
      family: "'Inter', system-ui, -apple-system, sans-serif",
      headingFamily: "'Inter', system-ui, -apple-system, sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 0, 0, 0.3)",
      colorLg: "rgba(0, 0, 0, 0.5)"
    },
    glass: {
      background: "rgba(15, 23, 42, 0.95)",
      border: "rgba(255, 255, 255, 0.1)"
    }
  },

  cyber: {
    colors: {
      primary: "#22d3ee",
      primaryHover: "#06b6d4",
      primaryDark: "#0891b2",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#a855f7",
      accentDark: "#9333ea",
      background: "#020617",
      card: "#0c0a09",
      surface: "#1c1917",
      surfaceHover: "#292524",
      text: "#ecfeff",
      textMuted: "#a5f3fc",
      textSecondary: "#67e8f9",
      success: "#34d399",
      successDark: "#10b981",
      error: "#f87171",
      errorDark: "#ef4444",
      warning: "#fbbf24",
      warningDark: "#f59e0b",
      border: "#292524",
      borderHover: "#3f3f46"
    },
    fonts: {
      family: "'JetBrains Mono', monospace",
      headingFamily: "'JetBrains Mono', monospace",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 0, 0, 0.5)",
      colorLg: "rgba(0, 0, 0, 0.7)"
    },
    glass: {
      background: "rgba(12, 10, 9, 0.95)",
      border: "rgba(34, 211, 238, 0.2)"
    }
  },

  futuristic: {
    colors: {
      primary: "#00ffea",
      primaryHover: "#00e6d4",
      primaryDark: "#00ccbb",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#ff0080",
      accentDark: "#e60073",
      background: "#0a0a0a",
      card: "#111111",
      surface: "#1a1a1a",
      surfaceHover: "#262626",
      text: "#ffffff",
      textMuted: "#b3b3b3",
      textSecondary: "#cccccc",
      success: "#00ff88",
      successDark: "#00e67a",
      error: "#ff4444",
      errorDark: "#e63939",
      warning: "#ffaa00",
      warningDark: "#e69500",
      border: "#333333",
      borderHover: "#444444"
    },
    fonts: {
      family: "'Orbitron', sans-serif",
      headingFamily: "'Orbitron', sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 255, 234, 0.2)",
      colorLg: "rgba(0, 255, 234, 0.4)"
    },
    glass: {
      background: "rgba(17, 17, 17, 0.95)",
      border: "rgba(0, 255, 234, 0.2)"
    },
    backgroundImage: "url('images/futuristic.svg')"
  },

  paper: {
    colors: {
      primary: "#92400e",
      primaryHover: "#78350f",
      primaryDark: "#5c2a0c",
      secondary: "#a16207",
      secondaryDark: "#854d0e",
      accent: "#ea580c",
      accentDark: "#c2410c",
      background: "#fef3c7",
      card: "#fffbeb",
      surface: "#fef3c7",
      surfaceHover: "#fde68a",
      text: "#451a03",
      textMuted: "#92400e",
      textSecondary: "#78350f",
      success: "#16a34a",
      successDark: "#15803d",
      error: "#dc2626",
      errorDark: "#b91c1c",
      warning: "#d97706",
      warningDark: "#b45309",
      border: "#fed7aa",
      borderHover: "#fdba74"
    },
    fonts: {
      family: "'Playfair Display', serif",
      headingFamily: "'Playfair Display', serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(146, 64, 14, 0.15)",
      colorLg: "rgba(146, 64, 14, 0.25)"
    },
    glass: {
      background: "rgba(255, 251, 235, 0.95)",
      border: "rgba(255, 255, 255, 0.3)"
    }
  },

  midnight: {
    colors: {
      primary: "#818cf8",
      primaryHover: "#6366f1",
      primaryDark: "#4f46e5",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#a78bfa",
      accentDark: "#8b5cf6",
      background: "#0b1020",
      card: "#121a33",
      surface: "#1e293b",
      surfaceHover: "#334155",
      text: "#e0e7ff",
      textMuted: "#94a3b8",
      textSecondary: "#cbd5e1",
      success: "#34d399",
      successDark: "#10b981",
      error: "#f87171",
      errorDark: "#ef4444",
      warning: "#fbbf24",
      warningDark: "#f59e0b",
      border: "#334155",
      borderHover: "#475569"
    },
    fonts: {
      family: "'Inter', system-ui, -apple-system, sans-serif",
      headingFamily: "'Inter', system-ui, -apple-system, sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 0, 0, 0.4)",
      colorLg: "rgba(0, 0, 0, 0.6)"
    },
    glass: {
      background: "rgba(18, 26, 51, 0.95)",
      border: "rgba(129, 140, 248, 0.2)"
    }
  },

  forest: {
    colors: {
      primary: "#16a34a",
      primaryHover: "#15803d",
      primaryDark: "#166534",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#84cc16",
      accentDark: "#65a30d",
      background: "#052e16",
      card: "#064e3b",
      surface: "#0f5132",
      surfaceHover: "#14532d",
      text: "#ecfdf5",
      textMuted: "#86efac",
      textSecondary: "#bbf7d0",
      success: "#22c55e",
      successDark: "#16a34a",
      error: "#f87171",
      errorDark: "#ef4444",
      warning: "#f59e0b",
      warningDark: "#d97706",
      border: "#14532d",
      borderHover: "#166534"
    },
    fonts: {
      family: "'Inter', system-ui, -apple-system, sans-serif",
      headingFamily: "'Inter', system-ui, -apple-system, sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(0, 0, 0, 0.4)",
      colorLg: "rgba(0, 0, 0, 0.6)"
    },
    glass: {
      background: "rgba(6, 78, 59, 0.95)",
      border: "rgba(22, 163, 74, 0.2)"
    }
  },

  sunset: {
    colors: {
      primary: "#f97316",
      primaryHover: "#ea580c",
      primaryDark: "#c2410c",
      secondary: "#64748b",
      secondaryDark: "#475569",
      accent: "#f59e0b",
      accentDark: "#d97706",
      background: "#fff7ed",
      card: "#ffedd5",
      surface: "#fed7aa",
      surfaceHover: "#fdba74",
      text: "#7c2d12",
      textMuted: "#9a3412",
      textSecondary: "#c2410c",
      success: "#16a34a",
      successDark: "#15803d",
      error: "#dc2626",
      errorDark: "#b91c1c",
      warning: "#d97706",
      warningDark: "#b45309",
      border: "#fed7aa",
      borderHover: "#fdba74"
    },
    fonts: {
      family: "'Inter', system-ui, -apple-system, sans-serif",
      headingFamily: "'Inter', system-ui, -apple-system, sans-serif",
      weightNormal: "400",
      weightMedium: "500",
      weightSemibold: "600",
      weightBold: "700"
    },
    shadows: {
      color: "rgba(249, 115, 22, 0.15)",
      colorLg: "rgba(249, 115, 22, 0.25)"
    },
    glass: {
      background: "rgba(255, 237, 213, 0.95)",
      border: "rgba(255, 255, 255, 0.3)"
    }
  },

  rose: {
    colors: {
      primary: "#e11d48",
      background: "#fff1f2",
      card: "#ffe4e6",
      text: "#4c0519"
    }
  },

  graphite: {
    colors: {
      primary: "#38bdf8",
      background: "#0f172a",
      card: "#111827",
      text: "#cbd5f5"
    },
    font: {
      family: "Roboto"
    }
  },

  lavender: {
    colors: {
      primary: "#8b5cf6",
      background: "#f5f3ff",
      card: "#ede9fe",
      text: "#312e81"
    }
  },

  coffee: {
    colors: {
      primary: "#78350f",
      background: "#faf3e0",
      card: "#f3e5ab",
      text: "#3f1d0b"
    },
    font: {
      family: "Playfair Display"
    }
  },

  mint: {
    colors: {
      primary: "#14b8a6",
      background: "#ecfeff",
      card: "#cffafe",
      text: "#134e4a"
    }
  },

blackpink: {
  colors: {
    primary: "#E1CBD8",
    background: "#503A49",
    card: "#947284",
    text: "#1a1a1a"
  },
  font: { family: "Google Sans" },
  backgroundImage: "url('images/blackpink.svg')"
},

bts: {
  colors: { 
    primary: "#6a5acd", 
    background: "#f3f0ff", 
    card: "#e6e1ff", 
    text: "#111" 
  },
  font: { family: "Poppins" },
  backgroundImage: "url('images/bts.svg')"
},

twice: {
  colors: { 
    primary: "#ff6ec7", 
    background: "#fff5fa", 
    card: "#ffe0f2", 
    text: "#111" 
  },
  font: { family: "Open Sans" },
  backgroundImage: "url('images/twice.svg')"
},
seventeen: {
  colors: { 
    primary: "#9d8df1", 
    background: "#f6f3ff", 
    card: "#e8e0ff", 
    text: "#111" 
  },
  font: { family: "Poppins" },
  backgroundImage: "url('images/seventeen.svg')"
},
straykids: {
  colors: { 
    primary: "#bd2222", 
    background: "#fff5f5", 
    card: "#ffe0e0", 
    text: "#111" 
  },
  font: { family: "Poppins" },
  backgroundImage: "url('images/straykids.svg')"

},
exo: {
  colors: { 
    primary: "#111", 
    background: "#e5e7eb", 
    card: "#fff", 
    text: "#000" 
  },
  font: { family: "Poppins" },
  backgroundImage: "url('images/exo.svg')"
},
redvelvet: {
  colors: { 
    primary: "#e63946", 
    background: "#fff4f4", 
    card: "#ffe1e1", 
    text: "#111" 
  },
  font: { family: "Poppins" },
  backgroundImage: "url('images/redvelvet.svg')"
},
itzy: {
  colors: { 
    primary: "#FF1E56", 
    background: "#FFE600", 
    card: "#00D0FF", 
    text: "#111" 
  },
  font: { family: "Open Sans" },
  backgroundImage: "url('images/itzy.svg')"
},
newjeans: {
  colors: { 
    primary: "#97C9DE", 
    background: "#DCB69F",  
    card: "#24537D", 
    text: "#111" 
  },
  font: { family: "Open Sans" },
  backgroundImage: "url('images/newjeans.svg')"
},
  jungle: {
    colors: {
      primary: "#1e5128",      
      background: "#d4f4dd",   
      card: "#a8e6cf",         
      text: "#0b3d0b"          
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/jungle.svg')"
  },

  safari: {
    colors: {
      primary: "#c19a6b",      
      background: "#fff8f0",   
      card: "#f5e0c3",         
      text: "#5a3e2b"          
    },
    font: { family: "Roboto" },
    backgroundImage: "url('images/safari.svg')"
  },

  ocean: {
    colors: {
      primary: "#0288d1",      
      background: "#e0f7fa",   
      card: "#b2ebf2",         
      text: "#014f86"          
    },
    font: { family: "Poppins" },
    backgroundImage: "url('images/ocean.svg')"
  },

lake: {
  colors: {
    primary: "#1fa2a6",      
    background: "#d0f0ea",   
    card: "#a0e3d8",         
    text: "#054d44"
  },
  font: { family: "Open Sans" },
  backgroundImage: "url('images/lake.svg')"
},

    animals_jungle: {
    colors: {
      primary: "#1e5128",
      background: "#d4f4dd",
      card: "#a8e6cf",
      text: "#0b3d0b"
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/animals_jungle.svg')"
  },

  animals_safari: {
    colors: {
      primary: "#c19a6b",
      background: "#fff8f0",
      card: "#f5e0c3",
      text: "#5a3e2b"
    },
    font: { family: "Roboto" },
    backgroundImage: "url('images/animals_safari.svg')"
  },

  animals_ocean: {
    colors: {
      primary: "#0288d1",
      background: "#e0f7fa",
      card: "#b2ebf2",
      text: "#014f86"
    },
    font: { family: "Poppins" },
    backgroundImage: "url('images/animals_ocean.svg')"
  },

  animals_pets: {
    colors: {
      primary: "#ff6f61",
      background: "#fff0f0",
      card: "#ffe6e6",
      text: "#331a1a"
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/pets.svg')"
  },

  animals_arctic: {
    colors: {
      primary: "#00bcd4",
      background: "#e0f7fa",
      card: "#b2ebf2",
      text: "#002f3d"
    },
    font: { family: "Roboto" },
    backgroundImage: "url('images/arctic.svg')"
  },

  animals_rainforest: {
    colors: {
      primary: "#2e7d32",
      background: "#dcedc8",
      card: "#aed581",
      text: "#1b5e20"
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/rainforest.svg')"
  },

  animals_desert: {
    colors: {
      primary: "#ff9800",
      background: "#fff3e0",
      card: "#ffe0b2",
      text: "#5d4037"
    },
    font: { family: "Poppins" },
    backgroundImage: "url('images/desert.svg')"
  },

  animals_farm: {
    colors: {
      primary: "#f57f17",
      background: "#fff8e1",
      card: "#ffecb3",
      text: "#4e342e"
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/farm.svg')"
  },

  animals_jungle_night: {
    colors: {
      primary: "#0d3b1e",
      background: "#081f0f",
      card: "#14391c",
      text: "#c8f5d9"
    },
    font: { family: "Roboto" },
    backgroundImage: "url('images/jungle_night.svg')"
  },

  animals_deep_sea: {
    colors: {
      primary: "#005f73",
      background: "#001219",
      card: "#0a9396",
      text: "#e0fbfc"
    },
    font: { family: "Poppins" },
    backgroundImage: "url('images/deep_sea.svg')"
  },

  animals_butterflies: {
    colors: {
      primary: "#f48fb1",
      background: "#fff0f6",
      card: "#ffd6e8",
      text: "#4a148c"
    },
    font: { family: "Open Sans" },
    backgroundImage: "url('images/butterflies.svg')"
  },

  animals_tropical_birds: {
    colors: {
      primary: "#ff5722",
      background: "#fff3e0",
      card: "#ffccbc",
      text: "#3e2723"
    },
    font: { family: "Roboto" },
    backgroundImage: "url('images/tropical_birds.svg')"
  }
};

const COLOR_PALETTES = {
  /* ───── Light / Clean ───── */
  pastel:      { primary:"#ff9ecb", background:"#fff5fb", card:"#ffe3f1", text:"#4a4a4a" },
  softMint:    { primary:"#97f2d7", background:"#eafff7", card:"#c8ffee", text:"#2d3a34" },
  airyBlue:    { primary:"#7dd3fc", background:"#e0f7ff", card:"#cdefff", text:"#0a2b3a" },
  creamLatte:  { primary:"#c69c6d", background:"#f9f0e5", card:"#f2ded0", text:"#3a2a20" },
  roseCloud:   { primary:"#ffb3c1", background:"#fff0f5", card:"#ffe1eb", text:"#432b3b" },
  lilacMist:   { primary:"#c7a0ff", background:"#f4e9ff", card:"#e8d5ff", text:"#392f52" },
  minimalGray: { primary:"#4b5563", background:"#f3f4f6", card:"#e5e7eb", text:"#1f2937" },

  /* ───── Dark Modes ───── */
  dark:        { primary:"#5aa2ff", background:"#0b111e", card:"#111a2d", text:"#e6ecff" },
  obsidian:    { primary:"#00eaff", background:"#020617", card:"#0f172a", text:"#d6faff" },
  midnight:    { primary:"#bfdbfe", background:"#0a1733", card:"#102347", text:"#eafbff" },
  cyberGray:   { primary:"#00ffa3", background:"#1b1b1b", card:"#262626", text:"#ffffff" },
  noirBrown:   { primary:"#d0a354", background:"#221c15", card:"#2d251c", text:"#f1e6d0" },
  neonNight:   { primary:"#39ff14", background:"#000000", card:"#0a0a0a", text:"#d3ffd1" },
  vaporDark:   { primary:"#ff87f2", background:"#1a0225", card:"#2a0438", text:"#ffd8fa" },

  /* ───── Nature / Earth ───── */
  forest:      { primary:"#16a34a", background:"#042f1a", card:"#064e3b", text:"#eafff7" },
  mossGreen:   { primary:"#6ee7b7", background:"#064e3b", card:"#0d6f52", text:"#eafff2" },
  sandDune:    { primary:"#d6a67a", background:"#2c241b", card:"#3a2f23", text:"#f7e9d8" },
  autumnLeaf:  { primary:"#e77f24", background:"#331806", card:"#52240c", text:"#f6d4b4" },
  ocean:       { primary:"#38bdf8", background:"#e0f7ff", card:"#b8ecff", text:"#0b2a36" },
  coralReef:   { primary:"#ff7a7a", background:"#ffecec", card:"#ffd6d6", text:"#3f1a1a" },
  natureWood:  { primary:"#b08968", background:"#f2e9dc", card:"#e6ccb2", text:"#3a2e28" },

  /* ───── Fun / Pop / Gaming ───── */
  neon:        { primary:"#00f0ff", background:"#00131a", card:"#002a33", text:"#00e7ff" },
  arcade:      { primary:"#ff00c8", background:"#000428", card:"#1a0340", text:"#ffd6fb" },
  synthwave:   { primary:"#ff00a0", background:"#140022", card:"#240042", text:"#ffdbfa" },
  gamerGreen:  { primary:"#26ff00", background:"#001100", card:"#002200", text:"#caffc6" },
  retroPixel:  { primary:"#ffcc00", background:"#2a1e05", card:"#3a2b07", text:"#fff7d1" },
  cosmicBlue:  { primary:"#00bfff", background:"#001733", card:"#01294a", text:"#c9eeff" },
  dragonFire:  { primary:"#ff462b", background:"#200000", card:"#340000", text:"#ffb1a6" },

  /* ───── Aesthetic / Cute / Soft ───── */
  sakura:      { primary:"#ff9bbf", background:"#ffeaf3", card:"#ffd4e7", text:"#402332" },
  skyCotton:   { primary:"#8ccaff", background:"#e9f5ff", card:"#d2ebff", text:"#172534" },
  matchaMilk:  { primary:"#9fc788", background:"#f3f9ef", card:"#e7f4e2", text:"#2e4027" },
  sunset:      { primary:"#ff7d45", background:"#fff0e6", card:"#ffe0d1", text:"#4a1e09" },
  lavenderMilk:{ primary:"#b98cff", background:"#f7f1ff", card:"#e6daff", text:"#2f2452" },
  bubbleGum:   { primary:"#ff77e9", background:"#ffe3fb", card:"#ffc6f5", text:"#45163b" },

  /* ───── Professional / UI Neutral ───── */
  officeBlue:  { primary:"#2563eb", background:"#f3f6fc", card:"#dbe7ff", text:"#1e293b" },
  slateMono:   { primary:"#64748b", background:"#f1f5f9", card:"#e2e8f0", text:"#1e293b" },
  steelGrey:   { primary:"#4b5563", background:"#1f2937", card:"#374151", text:"#e5e7eb" },
  businessTeal:{ primary:"#14b8a6", background:"#ecfdfa", card:"#cff8f3", text:"#083d37" }
};


const BUILT_IN_SETS = {
  circuits: {
    subject: { name: "Circuits", icon: "⚡" },
    set: { name: "Circuit Analysis", description: "Learn to analyze and solve electrical circuits" },
    cards: [
      {
        question: "Analyze this series circuit and find the total resistance:",
        questionImage: "CircuitsImg/CircuitsQ1.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <msub>
    <mi>i</mi>
    <mn>1</mn>
  </msub>
  <mo>=</mo>
  <mn>9</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mspace width="1em" />
  <msub>
    <mi>i</mi>
    <mn>2</mn>
  </msub>
  <mo>=</mo>
  <mn>2.5</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mspace width="1em" />
  <msub>
    <mi>i</mi>
    <mn>3</mn>
  </msub>
  <mo>=</mo>
  <mn>2</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA1.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
      {
        question: "Calculate the current through this parallel circuit:",
        questionImage: "CircuitsImg/CircuitsQ2.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <msub>
    <mi>I</mi>
    <mn>1</mn>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;<!-- − --></mo>
  <mn>3</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mspace width="1em" />
  <msub>
    <mi>I</mi>
    <mn>2</mn>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;<!-- − --></mo>
  <mn>2</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mspace width="1em" />
  <msub>
    <mi>I</mi>
    <mn>3</mn>
  </msub>
  <mo>=</mo>
  <mn>0</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA2.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
      {
        question: "Find the voltage across each resistor in this circuit:",
        questionImage: "CircuitsImg/CircuitsQ3.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mtable columnalign="right left right left right left right left right left right left" rowspacing="3pt" columnspacing="0em 2em 0em 2em 0em 2em 0em 2em 0em 2em 0em" displaystyle="true">
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>1</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>7.403</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>2</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>1.26</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>3</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>5.97</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
  </mtable>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA3.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
            {
        question: "Find the voltage across each resistor in this circuit:",
        questionImage: "CircuitsImg/CircuitsQ4.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mtable columnalign="right left right left right left right left right left right left" rowspacing="3pt" columnspacing="0em 2em 0em 2em 0em 2em 0em 2em 0em 2em 0em" displaystyle="true">
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>1</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>3.33</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>2</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>0.3298</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>3</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>1.508</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>4</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>2.497</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
  </mtable>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA4.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
            {
        question: "Find the voltage across each resistor in this circuit:",
        questionImage: "CircuitsImg/CircuitsQ5.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <msub>
    <mi>I</mi>
    <mn>1</mn>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;<!-- − --></mo>
  <mn>1.455</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mspace width="1em" />
  <msub>
    <mi>I</mi>
    <mn>2</mn>
  </msub>
  <mo>=</mo>
  <mn>0.5455</mn>
  <mtext>&#xA0;</mtext>
  <mrow class="MJX-TeXAtom-ORD">
    <mi mathvariant="normal">A</mi>
  </mrow>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA5.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
            {
        question: "Find the voltage across each resistor in this circuit:",
        questionImage: "CircuitsImg/CircuitsQ6.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mtable columnalign="right left right left right left right left right left right left" rowspacing="3pt" columnspacing="0em 2em 0em 2em 0em 2em 0em 2em 0em 2em 0em" displaystyle="true">
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>1</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>4.92</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>2</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>0.25</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
    <mtr>
      <mtd>
        <msub>
          <mi>I</mi>
          <mn>3</mn>
        </msub>
      </mtd>
      <mtd>
        <mi></mi>
        <mo>=</mo>
        <mn>4.25</mn>
        <mtext>&#xA0;</mtext>
        <mrow class="MJX-TeXAtom-ORD">
          <mi mathvariant="normal">A</mi>
        </mrow>
      </mtd>
    </mtr>
  </mtable>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA6.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      },
            {
        question: "Find the voltage across each resistor in this circuit:",
        questionImage: "CircuitsImg/CircuitsQ7.jpeg",
        answer: {
          mathml: `
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <msub>
    <mi>i</mi>
    <mrow class="MJX-TeXAtom-ORD">
      <mn>1</mn>
    </mrow>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;<!-- − --></mo>
  <mn>7.5</mn>
  <mrow class="MJX-TeXAtom-ORD">
    <mtext>&#xA0;</mtext>
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mo>,</mo>
  <mspace width="1em" />
  <msub>
    <mi>i</mi>
    <mrow class="MJX-TeXAtom-ORD">
      <mn>2</mn>
    </mrow>
  </msub>
  <mo>=</mo>
  <mo>&#x2212;<!-- − --></mo>
  <mn>2.5</mn>
  <mrow class="MJX-TeXAtom-ORD">
    <mtext>&#xA0;</mtext>
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mo>,</mo>
  <mspace width="1em" />
  <msub>
    <mi>i</mi>
    <mrow class="MJX-TeXAtom-ORD">
      <mn>3</mn>
    </mrow>
  </msub>
  <mo>=</mo>
  <mn>3.93</mn>
  <mrow class="MJX-TeXAtom-ORD">
    <mtext>&#xA0;</mtext>
    <mi mathvariant="normal">A</mi>
  </mrow>
  <mo>,</mo>
  <mspace width="1em" />
  <msub>
    <mi>i</mi>
    <mrow class="MJX-TeXAtom-ORD">
      <mn>4</mn>
    </mrow>
  </msub>
  <mo>=</mo>
  <mn>2.143</mn>
  <mrow class="MJX-TeXAtom-ORD">
    <mtext>&#xA0;</mtext>
    <mi mathvariant="normal">A</mi>
  </mrow>
</math>
`,
        },
        answerImage: "CircuitsImg/CircuitsA7.jpeg",
        imageCredit: "Mondal, M. (n.d.). Solved problems on super mesh analysis. https://www.engineeringdevotion.com/electric-circuits/solved-problems/super-mesh-analysis.html"
      }
    ]
  },

math: {
  subject: {
    name: "Math",
    icon: "➗"
  },
  set: {
    name: "Basic Math Expanded"
  },
  cards: [
    // Addition
    { question: "2 + 2", answer: "4" },
    { question: "7 + 5", answer: "12" },
    { question: "15 + 6", answer: "21" },
    { question: "100 + 250", answer: "350" },

    // Subtraction
    { question: "9 - 4", answer: "5" },
    { question: "25 - 10", answer: "15" },
    { question: "120 - 45", answer: "75" },

    // Multiplication
    { question: "5 × 3", answer: "15" },
    { question: "6 × 7", answer: "42" },
    { question: "12 × 12", answer: "144" },

    // Division
    { question: "10 ÷ 2", answer: "5" },
    { question: "36 ÷ 6", answer: "6" },
    { question: "81 ÷ 9", answer: "9" },

    // Fractions
    { question: "1/2 + 1/2", answer: "1" },
    { question: "3/4 - 1/4", answer: "1/2" },
    { question: "1/3 × 3", answer: "1" },

    // Algebra basics
    { question: "Solve: x + 5 = 12", answer: "x = 7" },
    { question: "Solve: 3x = 18", answer: "x = 6" },
    { question: "Solve: x - 8 = 10", answer: "x = 18" },

    // Geometry
    { question: "How many sides does a triangle have?", answer: "3" },
    { question: "Area of a square = ?", answer: "side × side" },
    { question: "A shape with 6 sides is called?", answer: "Hexagon" }
  ]
},

science: {
  subject: {
    name: "Science",
    icon: "🔬"
  },
  set: {
    name: "Basic Science"
  },
  cards: [
    { question: "Water formula", answer: "H2O" },
    { question: "Sun is a?", answer: "Star" },
    { question: "Earth revolves around?", answer: "Sun" },
    { question: "Gravity", answer: "Force that attracts objects toward each other" },
    { question: "Photosynthesis", answer: "Process plants make food using sunlight" },
    { question: "Atom", answer: "Smallest unit of matter" },
    { question: "Molecule", answer: "Two or more atoms bonded together" },
    { question: "Solid", answer: "State of matter with fixed shape" },
    { question: "Liquid", answer: "State of matter with no fixed shape" },
    { question: "Gas", answer: "State of matter that expands to fill space" },
    { question: "Evaporation", answer: "Liquid turning into gas" },
    { question: "Condensation", answer: "Gas turning into liquid" },
    { question: "Oxygen symbol", answer: "O" },
    { question: "Carbon symbol", answer: "C" },
    { question: "Nitrogen symbol", answer: "N" },
    { question: "Force", answer: "Push or pull on an object" },
    { question: "Energy", answer: "Ability to do work" },
    { question: "Magnet attracts?", answer: "Iron and steel" },
    { question: "Boiling point of water", answer: "100°C or 212°F" },
    { question: "Freezing point of water", answer: "0°C or 32°F" }
  ]
},

history: {
  subject: {
    name: "History",
    icon: "🏛️"
  },
  set: {
    name: "World History Basics"
  },
  cards: [
    { question: "First president of the Philippines", answer: "Emilio Aguinaldo"},
    { question: "Year World War II ended", answer: "1945" },
    { question: "Ancient civilization in Egypt", answer: "Egyptians" },
    { question: "Great Wall is in?", answer: "China" },
    { question: "Renaissance period", answer: "14th to 17th century Europe" },
    { question: "Columbus discovered America in?", answer: "1492" },
    { question: "Roman Empire capital", answer: "Rome" },
    { question: "Industrial Revolution started in", answer: "Britain" },
    { question: "Declaration of Independence year", answer: "1776" },
    { question: "Napoleon was from?", answer: "France" }
  ]
},

computer: {
  subject: {
    name: "Computer Science",
    icon: "💻"
  },
  set: {
    name: "Basic Concepts"
  },
  cards: [
    { question: "HTML stands for?", answer: "HyperText Markup Language" },
    { question: "CSS is for?", answer: "Styling web pages" },
    { question: "JS is short for?", answer: "JavaScript" },
    { question: "Function in JS", answer: "Reusable block of code" },
    { question: "Variable", answer: "Stores data values" },
    { question: "Array", answer: "Collection of values in order" },
    { question: "Object", answer: "Data structure with key-value pairs" },
    { question: "Loop", answer: "Executes code repeatedly" },
    { question: "Conditional", answer: "Runs code based on a condition" },
    { question: "Boolean", answer: "True or false value" }
  ]
},

filipino: {
  subject: {
    name: "Filipino",
    icon: "🇵🇭"
  },
  set: {
    name: "Basic Words"
  },
  cards: [
    { question: "Hello in Filipino", answer: "Kumusta" },
    { question: "Thank you", answer: "Salamat" },
    { question: "Good morning", answer: "Magandang umaga" },
    { question: "Good night", answer: "Magandang gabi" },
    { question: "Yes", answer: "Oo" },
    { question: "No", answer: "Hindi" },
    { question: "Please", answer: "Pakiusap" },
    { question: "Excuse me", answer: "Paumanhin" },
    { question: "Friend", answer: "Kaibigan" },
    { question: "Family", answer: "Pamilya" }
  ]
},

english: {
  subject: {
    name: "English",
    icon: "📘"
  },
  set: {
    name: "Basic Vocabulary"
  },
  cards: [
    { question: "Hello", answer: "A greeting" },
    { question: "Goodbye", answer: "A farewell" },
    { question: "Please", answer: "Used to make a polite request" },
    { question: "Thank you", answer: "Expression of gratitude" },
    { question: "Yes", answer: "Affirmative response" },
    { question: "No", answer: "Negative response" },
    { question: "Excuse me", answer: "Used to politely get attention" },
    { question: "Sorry", answer: "Expression of apology" },
    { question: "Friend", answer: "Someone you have a close relationship with" },
    { question: "Family", answer: "Group of related people" },
    { question: "Book", answer: "Collection of written or printed pages" },
    { question: "School", answer: "Place where people learn" },
    { question: "Food", answer: "What people eat" },
    { question: "Water", answer: "Liquid essential for life" },
    { question: "Happy", answer: "Feeling of joy or pleasure" },
    { question: "Sad", answer: "Feeling of unhappiness" }
  ]
},


  biology: {
    subject: { name: "Biology", icon: "🧬" },
    set: { name: "Basic Biology" },
    cards: [
      { question: "What is the powerhouse of the cell?", answer: "Mitochondria" },
      { question: "What is the largest organ in the human body?", answer: "Skin" },
      { question: "What carries genetic information?", answer: "DNA" },
      { question: "The basic unit of life?", answer: "Cell" },
      { question: "Process by which plants make food?", answer: "Photosynthesis" },
      { question: "Blood cells that fight infection?", answer: "White blood cells" },
      { question: "Blood cells that carry oxygen?", answer: "Red blood cells" },
      { question: "Liquid part of blood?", answer: "Plasma" },
      { question: "Where digestion begins?", answer: "Mouth" },
      { question: "Organ that pumps blood?", answer: "Heart" },
      { question: "Where gas exchange occurs?", answer: "Lungs" },
      { question: "Process of cell division?", answer: "Mitosis" },
      { question: "Organism made of many cells?", answer: "Multicellular organism" },
      { question: "Organism made of one cell?", answer: "Unicellular organism" },
      { question: "Organ that filters blood?", answer: "Kidney" },
      { question: "Tissue that connects muscles to bones?", answer: "Tendon" },
      { question: "Tissue that connects bones to bones?", answer: "Ligament" },
      { question: "Primary molecule in cell membranes?", answer: "Phospholipid" },
      { question: "Process of evolution?", answer: "Natural selection" },
      { question: "Study of living organisms?", answer: "Biology" }
    ]
  },

methodsOfResearch: {
  subject: { name: "Methods of Research", icon: "🔬" },
  set: { name: "Research Basics" },
  cards: [
    { question: "What is research?", answer: "A systematic investigation to establish facts or principles" },
    { question: "Qualitative research", answer: "Research that focuses on understanding phenomena through observation and interviews" },
    { question: "Quantitative research", answer: "Research that uses numerical data and statistical analysis" },
    { question: "Experimental research", answer: "Research involving experiments to test hypotheses" },
    { question: "Survey research", answer: "Research using questionnaires to collect data from a population" },
    { question: "Case study", answer: "In-depth study of a particular instance or event" },
    { question: "Research ethics", answer: "Guidelines for conducting research responsibly and ethically" },
    { question: "Hypothesis", answer: "A testable statement predicting the outcome of research" },
    { question: "Literature review", answer: "A summary and evaluation of existing research on a topic" },
    { question: "Sampling", answer: "Process of selecting a representative group from a population for study" },
    { question: "Variables", answer: "Elements or factors that can change or be measured in research" },
    { question: "Independent variable", answer: "The factor that is manipulated to observe its effect" },
    { question: "Dependent variable", answer: "The factor that is measured to see the effect of changes" },
    { question: "Control group", answer: "Group in an experiment not exposed to the independent variable" },
    { question: "Random sampling", answer: "Selecting participants randomly to avoid bias" },
    { question: "Reliability", answer: "The consistency of a research measurement over time" },
    { question: "Validity", answer: "The accuracy of a measurement in reflecting what it is supposed to measure" },
    { question: "Data analysis", answer: "The process of organizing and interpreting collected data" },
    { question: "Research design", answer: "The overall strategy used to integrate the different components of a study" },
    { question: "Primary data", answer: "Data collected directly from first-hand sources" },
    { question: "Secondary data", answer: "Data collected from existing sources or research" }
  ]
},

engineeringManagement: {
  subject: { name: "Engineering Management", icon: "⚙️" },
  set: { name: "Management Concepts" },
  cards: [
    { question: "What is engineering management?", answer: "Application of management principles to engineering projects and teams" },
    { question: "Project management", answer: "Planning, organizing, and overseeing a project to achieve specific goals" },
    { question: "Risk management", answer: "Identifying, assessing, and mitigating potential risks in a project" },
    { question: "Leadership in engineering", answer: "Guiding and motivating technical teams to achieve objectives" },
    { question: "Quality management", answer: "Ensuring products or services meet defined standards" },
    { question: "Resource allocation", answer: "Distributing materials, people, and time efficiently for a project" },
    { question: "Engineering ethics", answer: "Professional standards and moral responsibilities of engineers" },
    { question: "Decision-making", answer: "Choosing the best course of action among alternatives" },
    { question: "Cost estimation", answer: "Predicting the financial requirements of a project" },
    { question: "Time management", answer: "Planning and controlling time to improve efficiency" },
    { question: "Team building", answer: "Creating a cohesive and effective engineering team" },
    { question: "Communication skills", answer: "Ability to convey ideas clearly within a team or project" },
    { question: "Performance evaluation", answer: "Assessing the efficiency and output of team members" },
    { question: "Process improvement", answer: "Analyzing and enhancing workflows for better productivity" },
    { question: "Budgeting", answer: "Planning financial resources for projects" },
    { question: "Conflict resolution", answer: "Managing disagreements effectively within a team" },
    { question: "Strategic planning", answer: "Defining long-term goals and outlining steps to achieve them" },
    { question: "Operations management", answer: "Overseeing day-to-day project operations" },
    { question: "Engineering standards", answer: "Guidelines and regulations that must be followed in engineering projects" },
    { question: "Documentation", answer: "Keeping detailed records of project plans, progress, and results" }
  ]
},

technopreneurship: {
  subject: { name: "Technopreneurship", icon: "💡" },
  set: { name: "Entrepreneurship in Tech" },
  cards: [
    { question: "What is technopreneurship?", answer: "Entrepreneurship that focuses on technology-based innovations" },
    { question: "Startup", answer: "A new business focused on growth and innovation" },
    { question: "Business model", answer: "A plan for how a company creates, delivers, and captures value" },
    { question: "Pitch deck", answer: "A presentation to attract investors to a startup" },
    { question: "Innovation", answer: "Developing new ideas, products, or services" },
    { question: "Funding", answer: "Securing financial resources to grow a business" },
    { question: "Market research", answer: "Studying market needs, trends, and competitors" },
    { question: "Product development", answer: "Designing and building a product from concept to launch" },
    { question: "Entrepreneurial mindset", answer: "Thinking creatively, taking risks, and solving problems" },
    { question: "Scaling a business", answer: "Growing a startup efficiently to reach more customers" },
    { question: "Lean startup", answer: "A methodology for developing businesses quickly with minimal waste" },
    { question: "Value proposition", answer: "The unique value a product or service provides to customers" },
    { question: "Customer validation", answer: "Testing assumptions by getting feedback from real users" },
    { question: "Revenue streams", answer: "Ways a business generates income" },
    { question: "Intellectual property", answer: "Protecting innovations through patents, copyrights, or trademarks" },
    { question: "Business plan", answer: "A formal document detailing business goals and strategies" },
    { question: "Networking", answer: "Building professional connections to support growth" },
    { question: "Competition analysis", answer: "Studying competitors to identify advantages and threats" },
    { question: "Technology adoption", answer: "Implementing new tech to improve products or services" },
    { question: "Exit strategy", answer: "Plan for how a founder or investor will leave the business profitably" }
  ]
},

thesisOutline: {
  subject: { name: "Thesis Outline Topics", icon: "📝" },
  set: { name: "Electronics Engineering Topics" },
  cards: [
    { question: "Thesis purpose", answer: "To investigate, analyze, and present findings on a technical problem" },
    { question: "Title selection", answer: "Choosing a concise and relevant topic for research" },
    { question: "Abstract", answer: "A summary of the research, methodology, and results" },
    { question: "Introduction", answer: "Background information and problem statement" },
    { question: "Literature review", answer: "Survey of existing studies related to the research topic" },
    { question: "Methodology", answer: "Detailed plan of how the research is conducted" },
    { question: "Results", answer: "Presentation of data and findings" },
    { question: "Discussion", answer: "Interpretation and analysis of the results" },
    { question: "Conclusion", answer: "Summary of findings and recommendations" },
    { question: "References", answer: "List of all sources cited in the research" },
    { question: "Problem statement", answer: "The specific issue or question the research addresses" },
    { question: "Scope and limitations", answer: "Defines boundaries and constraints of the research" },
    { question: "Research objectives", answer: "Specific goals the research aims to achieve" },
    { question: "Hypothesis formulation", answer: "Creating a testable prediction based on theory" },
    { question: "Data collection methods", answer: "Techniques for gathering research data" },
    { question: "Analysis techniques", answer: "Methods for interpreting and processing data" },
    { question: "Figures and tables", answer: "Visual representations of data in the thesis" },
    { question: "Appendices", answer: "Supplementary materials provided at the end of the thesis" },
    { question: "Acknowledgments", answer: "Section to thank contributors and mentors" },
    { question: "Future work", answer: "Suggestions for research or development beyond the current study" }
  ]
},

  geography: {
    subject: { name: "Geography", icon: "🌍" },
    set: { name: "Basic Geography" },
    cards: [
      { question: "Largest continent?", answer: "Asia" },
      { question: "Longest river in the world?", answer: "Nile" },
      { question: "Largest ocean?", answer: "Pacific" },
      { question: "Highest mountain?", answer: "Mount Everest" },
      { question: "Capital of France?", answer: "Paris" },
      { question: "Country with most population?", answer: "China" },
      { question: "Continent Australia is in?", answer: "Oceania" },
      { question: "Imaginary line dividing Earth into N and S?", answer: "Equator" },
      { question: "Largest desert?", answer: "Sahara" },
      { question: "What is tectonic plate movement called?", answer: "Plate tectonics" }
    ]
  },

  chemistry: {
    subject: { name: "Chemistry", icon: "⚗️" },
    set: { name: "Basic Chemistry" },
    cards: [
      { question: "Water formula?", answer: "H2O" },
      { question: "Atomic number?", answer: "Number of protons" },
      { question: "pH of pure water?", answer: "7" },
      { question: "Most abundant gas in air?", answer: "Nitrogen" },
      { question: "Chemical symbol for gold?", answer: "Au" },
      { question: "Process of solid to gas?", answer: "Sublimation" },
      { question: "Acidic solution has pH?", answer: "<7" },
      { question: "Base solution has pH?", answer: ">7" },
      { question: "Covalent bond?", answer: "Sharing of electrons" },
      { question: "Ionic bond?", answer: "Transfer of electrons" }
    ]
  },

  physics: {
    subject: { name: "Physics", icon: "🪐" },
    set: { name: "Basic Physics" },
    cards: [
      { question: "Force formula?", answer: "F = ma" },
      { question: "Speed formula?", answer: "Distance ÷ Time" },
      { question: "Acceleration formula?", answer: "Change in velocity ÷ Time" },
      { question: "Unit of energy?", answer: "Joule" },
      { question: "Unit of force?", answer: "Newton" },
      { question: "Unit of power?", answer: "Watt" },
      { question: "Gravity acceleration?", answer: "9.8 m/s²" },
      { question: "Light speed?", answer: "3 × 10⁸ m/s" },
      { question: "Newton's 1st law?", answer: "Inertia" },
      { question: "Newton's 2nd law?", answer: "F = ma" }
    ]
  },

  art: {
    subject: { name: "Art", icon: "🎨" },
    set: { name: "Basic Art" },
    cards: [
      { question: "Primary colors?", answer: "Red, Blue, Yellow" },
      { question: "Famous painter of Mona Lisa?", answer: "Leonardo da Vinci" },
      { question: "Art of making sculptures?", answer: "Sculpture" },
      { question: "Famous Dutch painter of Starry Night?", answer: "Vincent van Gogh" },
      { question: "Technique of shading?", answer: "Hatching" },
      { question: "Mixing colors?", answer: "Color theory" },
      { question: "Modern art style using geometric shapes?", answer: "Cubism" },
      { question: "Art of decorative writing?", answer: "Calligraphy" },
      { question: "Famous Mexican muralist?", answer: "Diego Rivera" },
      { question: "Art movement with surreal imagery?", answer: "Surrealism" }
    ]
  }
};

let config = { ...defaultConfig };
let allData = [];
let currentView = !getUser() ? 'login' : 'home';
let currentSubject = null;
let currentSet = null;
let currentCardIndex = 0;
let isFlipped = false;
let isLoading = false;
let quizIndex = 0;
let quizScore = 0;
let quizQuestions = [];
let selectedAnswer = null;
let answeredQuestions = new Set();
let confirmedAnswers = {};
let deferredInstallPrompt = null;
let teacherQuestions = [];
let saveTimeout;
let teacherDraftSaveTimer;
let isQuizPreview = false;
let teacherQuizData = null;
let teacherQuizIndex = 0;
let teacherQuizScore = 0;
let isTeacherQuiz = false;
let currentQuizId = null;
let isStudentLocked = false;
let studentTab = "main";   
let teacherTab = "main";
let pendingQuizId = null;
let timerHidden = false;
let showTimerControls = true;
let activeBottomTab = "home"; 
let currentBrowseSetId = null;
let currentBrowseSetCards = [];
let currentBrowseCardIndex = 0;
let isBrowseCardFlipped = false;
let pdfRenderTask = null; 
let pageNum = 1;
let scale = 1.0;
let readingMode = false;
let canvas, ctx, pdfDoc;
let touchStartX = 0;
let touchEndX = 0;
const swipeThreshold = 50;
let isFullscreen = false;
let currentStudent = {
  name: "",
  id: ""
};
let studyTimer = {
  duration: 20 * 60,
  remaining: 20 * 60,
  interval: null,
  running: false,
  startTime: null
};

// ============= LOGIN VIEW =============
function renderLoginView() {
  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;
  const backendOrigin = 'https://ec-eclassroom-backend.espaderarios.workers.dev';

  return `
    <div style="
      min-height:100vh;
      background:linear-gradient(135deg, ${primary}22 0%, ${primary}11 100%);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      font-family:var(--font-family);
    ">
      <div style="
        background:${bg};
        border-radius:24px;
        padding:40px 30px;
        max-width:420px;
        width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,0.15);
        border:1px solid rgba(255,255,255,0.1);
        animation:slideUp 0.5s ease;
      ">
        <!-- Logo/Title -->
        <div style="text-align:center; margin-bottom:40px;">
          <h1 style="
            font-size:32px;
            color:${primary};
            margin:0 0 8px 0;
            font-weight:700;
          ">🎓 EcE Classroom</h1>
          <p style="
            color:${text};
            opacity:0.7;
            margin:0;
            font-size:14px;
          ">Choose how to continue</p>
        </div>

        <!-- Login Option: Google OAuth -->
        <button onclick="startGoogleOAuth()" style="
          width:100%;
          padding:14px 16px;
          border:none;
          border-radius:12px;
          background:linear-gradient(135deg, #4285F4 0%, #1E88E5 100%);
          color:white;
          font-weight:600;
          font-size:16px;
          cursor:pointer;
          margin-bottom:16px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:12px;
          transition:all 0.3s ease;
          box-shadow:0 4px 12px rgba(66, 133, 244, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(66, 133, 244, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(66, 133, 244, 0.3)';">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
          </svg>
          Sign in with Google
        </button>

        <!-- Divider -->
        <div style="
          display:flex;
          align-items:center;
          gap:12px;
          margin:24px 0;
          color:${text};
          opacity:0.5;
          font-size:13px;
        ">
          <div style="flex:1; height:1px; background:${text}; opacity:0.2;"></div>
          <span>OR</span>
          <div style="flex:1; height:1px; background:${text}; opacity:0.2;"></div>
        </div>

        <!-- Login Option: Guest/Local -->
        <div style="margin-bottom:16px;">
          <label style="
            display:block;
            color:${text};
            font-weight:600;
            margin-bottom:8px;
            font-size:14px;
          ">Choose your role:</label>
          <select id="guestRole" style="
            width:100%;
            padding:12px;
            border:2px solid ${primary}33;
            border-radius:8px;
            background:${bg};
            color:${text};
            font-size:14px;
            font-weight:500;
            cursor:pointer;
            transition:all 0.3s ease;
          " onchange="this.style.borderColor='${primary}66';" onfocus="this.style.borderColor='${primary}'" onblur="this.style.borderColor='${primary}33';">
            <option value="student">📚 Student (Local Data)</option>
            <option value="teacher">👨‍🏫 Teacher (Local Data)</option>
          </select>
        </div>

        <button onclick="loginAsGuest()" style="
          width:100%;
          padding:14px 16px;
          border:2px solid ${primary};
          border-radius:12px;
          background:transparent;
          color:${primary};
          font-weight:600;
          font-size:16px;
          cursor:pointer;
          transition:all 0.3s ease;
        " onmouseover="this.style.background='${primary}11';" onmouseout="this.style.background='transparent';">
          Continue without Sign In
        </button>

        <!-- Info Message -->
        <div style="
          margin-top:24px;
          padding:14px;
          background:${primary}08;
          border-radius:8px;
          border-left:4px solid ${primary};
          font-size:13px;
          color:${text};
          opacity:0.8;
          line-height:1.5;
        ">
          <strong style="color:${primary};">📌 About your data:</strong><br/>
          <strong>Sign in:</strong> Your quiz scores sync to the cloud<br/>
          <strong>Local:</strong> Data only saved on this device
        </div>
      </div>

      <style>
        @keyframes slideUp {
          from {
            opacity:0;
            transform:translateY(30px);
          }
          to {
            opacity:1;
            transform:translateY(0);
          }
        }
      </style>
    </div>
  `;
}

function startGoogleOAuth() {
  // Redirect to backend OAuth start endpoint
  const backendOrigin = 'https://ec-eclassroom-backend.espaderarios.workers.dev';
  window.location.href = backendOrigin + '/auth/google/start';
}

function loginAsGuest() {
  const roleSelect = document.getElementById('guestRole');
  const role = roleSelect ? roleSelect.value : 'student';
  
  // Create guest user without authentication
  setUser({
    id: crypto.randomUUID(),
    name: role === 'teacher' ? 'Teacher Demo' : 'Student Demo',
    role: role,
    authenticated: false
  });
  
  window.isAuthenticated = false;
  currentView = 'home';
  renderApp();
}

function confirmLogout() {
  if (confirm('Are you sure you want to log out? You can log back in with Google OAuth.')) {
    logoutUser();
    window.isAuthenticated = false;
    currentView = 'login';
    renderApp();
  }
}


function renderBottomNav() {
  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;

  const tabStyle = (tab, icon, label) => `
    flex:1;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    padding:8px 4px;
    font-size:12px;
    color:${activeBottomTab === tab ? primary : text};
    font-weight:${activeBottomTab === tab ? "600" : "400"};
    transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height:64px;
    position:relative;
    border-radius:12px;
    margin:2px;
  `;

  const activeIndicator = (tab) => activeBottomTab === tab ? `
    <div style="
      position:absolute;
      bottom:0;
      left:50%;
      transform:translateX(-50%);
      width:24px;
      height:3px;
      background:linear-gradient(90deg, ${primary}, ${primary}dd);
      border-radius:2px;
      animation:slideIn 0.3s ease;
    "></div>
  ` : '';

  return `
    <nav class="bottom-nav glass-effect" role="navigation" aria-label="Main navigation" style="
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border-top: 1px solid var(--glass-border);
      box-shadow: 0 -4px 20px var(--shadow-color);
      padding: 8px 12px;
      font-family: var(--font-family);
    ">
      <button style="${tabStyle("browse", "📚", "Browse")}" onclick="goToBrowse()" aria-label="Browse flashcards" class="nav-tab ${activeBottomTab === 'browse' ? 'active' : ''}">
        <div class="icon-container" style="
          width:32px;
          height:32px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:all 0.3s ease;
          background:${activeBottomTab === 'browse' ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
        ">
          <span style="font-size:18px; margin-bottom:2px; transition:transform 0.3s ease;" class="${activeBottomTab === 'browse' ? 'scale-110' : ''}">📚</span>
        </div>
        <span style="margin-top:2px;">Browse</span>
        ${activeIndicator("browse")}
      </button>

      <button style="${tabStyle("home", "🏠", "Home")}" onclick="goToHome()" aria-label="Go to home" class="nav-tab ${activeBottomTab === 'home' ? 'active' : ''}">
        <div class="icon-container" style="
          width:32px;
          height:32px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:all 0.3s ease;
          background:${activeBottomTab === 'home' ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
        ">
          <span style="font-size:18px; margin-bottom:2px; transition:transform 0.3s ease;" class="${activeBottomTab === 'home' ? 'scale-110' : ''}">🏠</span>
        </div>
        <span style="margin-top:2px;">Home</span>
        ${activeIndicator("home")}
      </button>

      <button style="${tabStyle("pdfs", "📄", "PDFs")}" onclick="goToPdfs()" aria-label="View PDFs" class="nav-tab ${activeBottomTab === 'pdfs' ? 'active' : ''}">
        <div class="icon-container" style="
          width:32px;
          height:32px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:all 0.3s ease;
          background:${activeBottomTab === 'pdfs' ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
        ">
          <span style="font-size:18px; margin-bottom:2px; transition:transform 0.3s ease;" class="${activeBottomTab === 'pdfs' ? 'scale-110' : ''}">📄</span>
        </div>
        <span style="margin-top:2px;">PDFs</span>
        ${activeIndicator("pdfs")}
      </button>

      <button style="${tabStyle("themes", "🎨", "Themes")}" onclick="goToThemes()" aria-label="Change themes" class="nav-tab ${activeBottomTab === 'themes' ? 'active' : ''}">
        <div class="icon-container" style="
          width:32px;
          height:32px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:all 0.3s ease;
          background:${activeBottomTab === 'themes' ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
        ">
          <span style="font-size:18px; margin-bottom:2px; transition:transform 0.3s ease;" class="${activeBottomTab === 'themes' ? 'scale-110' : ''}">🎨</span>
        </div>
        <span style="margin-top:2px;">Themes</span>
        ${activeIndicator("themes")}
      </button>
    </nav>
  `;
}

function goToHome() {
  activeBottomTab = "home";
  currentView = "home";
  renderApp();
}

function goToBrowse() {
  activeBottomTab = "browse";
  currentView = "browse"; 
  renderApp();
}

function goToPdfs() {
  activeBottomTab = "pdfs";
  currentView = "pdfs"; 
  renderApp();
}

function goToThemes() {
  activeBottomTab = "themes";
  currentView = "themes"; 
  renderApp();
}

function renderBrowseView() {
  const builtInSets = [
    { id: 'circuits', name: 'Circuits', icon: '⚡', gradient: 'from-yellow-400 to-orange-600', count: 3 },
    { id: 'math', name: 'Math', icon: '➗', gradient: 'from-blue-400 to-blue-600', count: 22 },
    { id: 'science', name: 'Science', icon: '🔬', gradient: 'from-green-400 to-green-600', count: 20 },
    { id: 'english', name: 'English', icon: '📖', gradient: 'from-purple-400 to-purple-600', count: 16 },
    { id: 'biology', name: 'Biology', icon: '🧬', gradient: 'from-blue-600 to-green-600', count: 20 },
    { id: 'history', name: 'History', icon: '🏛️', gradient: 'from-yellow-400 to-yellow-600', count: 10 },
    { id: 'filipino', name: 'Filipino', icon: '🇵🇭', gradient: 'from-yellow-400 to-red-600', count: 10 },
    { id: 'computer', name: 'ComputerScience', icon: '💻', gradient: 'from-pink-400 to-pink-600', count: 10 },
    { id: 'geography', name: 'Geography', icon: '🌍', gradient: 'from-teal-400 to-teal-600', count: 10 },
    { id: 'chemistry', name: 'Chemistry', icon: '⚗️', gradient: 'from-indigo-400 to-indigo-600', count: 10 },
    { id: 'physics', name: 'Physics', icon: '🪐', gradient: 'from-gray-400 to-gray-600', count: 10 },
    { id: 'art', name: 'Art', icon: '🎨', gradient: 'from-red-400 to-red-600', count: 10 },

    // Electronics Engineering–related sets
    { id: 'methodsOfResearch', name: 'Methods of Research', icon: '🔬', gradient: 'from-green-400 to-green-600', count: 21 },
    { id: 'engineeringManagement', name: 'Engineering Management', icon: '⚙️', gradient: 'from-blue-400 to-blue-600', count: 20 },
    { id: 'technopreneurship', name: 'Technopreneurship', icon: '💡', gradient: 'from-yellow-400 to-yellow-600', count: 20 },
    { id: 'thesisOutline', name: 'Thesis Outline', icon: '📝', gradient: 'from-purple-400 to-purple-600', count: 20 }
  ];

  const setsHTML = builtInSets.map(set => `
    <div 
      class="browse-card card-touch flex flex-col items-center justify-center p-6 rounded-2xl shadow-lg cursor-pointer text-white transition transform hover:scale-105 active:scale-95 bg-gradient-to-br ${set.gradient} quiz-option" 
      onclick="openBrowseSet('${set.id}')"
      style="min-height: 120px;"
    >
      <div class="text-4xl mb-3">${set.icon}</div>
      <h3 class="font-semibold text-xl">${set.name}</h3>
      <p class="text-base opacity-80 mt-2">${set.count} card${set.count !== 1 ? 's' : ''}</p>
    </div>
  `).join('');

  return `
    <div class="mobile-optimized p-4 fade-in max-w-4xl mx-auto">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold mb-2 text-text">
          📚 Browse Flashcards
        </h2>
        <p class="text-base text-text-muted">
          Choose a subject to explore and study
        </p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${setsHTML}
      </div>
    </div>
  `;
}

function openBrowseSet(id) {
  currentBrowseSetId = id;
  currentView = "browse-cards";
  renderApp();
}

function renderBrowseCardsView() {
  if (!currentBrowseSetId) return renderBrowseView();

  const data = BUILT_IN_SETS[currentBrowseSetId];
  if (!data) return renderBrowseView();

  const cardsHTML = data.cards.map((card, i) => `
    <div class="card p-4 mb-3 hover:shadow-lg transition-shadow duration-200">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
          ${i + 1}
        </div>
        <div class="flex-1">
          <div class="font-medium text-text mb-2">
            ${card.question}
          </div>
          ${card.questionImage ? `<img src="${card.questionImage}" alt="Question diagram" class="w-full max-w-xl rounded-lg mb-3 border" onerror="this.style.display='none'">` : ''}
          <div class="text-text-muted text-sm">
            ${card.answer}
          </div>
          ${card.answerImage ? `<img src="${card.answerImage}" alt="Answer solution" class="w-full max-w-xl rounded-lg mt-2 border" onerror="this.style.display='none'">` : ''}
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="fade-in p-6 max-w-2xl mx-auto">
      <div class="mb-6">
        <button
          class="btn-secondary mb-4"
          onclick="goBackToBrowse()"
        >
          ← Back to Sets
        </button>

        <div class="card p-6 mb-6">
          <h2 class="text-2xl font-bold mb-2 text-text">${data.set.name}</h2>
          <p class="text-text-muted mb-4">${data.set.description || 'Explore this flashcard set'}</p>
          <div class="flex items-center gap-4 text-sm text-text-muted">
            <span>📚 ${data.cards.length} cards</span>
            <span>⏱️ ${Math.ceil(data.cards.length * 0.5)} min study time</span>
          </div>
        </div>
      </div>

      <div class="mb-6">
        <button
          class="btn-primary w-full py-4 text-lg font-semibold"
          onclick="startBrowseStudy('${currentBrowseSetId}')"
        >
          🚀 Start Studying
        </button>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-text mb-4">Card Preview</h3>
        ${cardsHTML}
      </div>
    </div>
  `;
}

function startBrowseStudy(setId) {
  const data = BUILT_IN_SETS[setId];
  if (!data) return;

  currentBrowseSetCards = data.cards;
  currentBrowseCardIndex = 0;
  isBrowseCardFlipped = false;
  currentView = "browse-study";
  renderApp();
}

// ---------- Render Browse Study as Flashcards ----------
function renderBrowseStudyView() {
  const card = currentBrowseSetCards[currentBrowseCardIndex];
  if (!card) return renderBrowseCardsView();

  const totalCards = currentBrowseSetCards.length;
  const progress = ((currentBrowseCardIndex + 1) / totalCards) * 100;

  const answerText = card.answer?.text || (typeof card.answer === 'string' ? card.answer : '');
  const answerMathML = card.answer?.mathml || '';

  return `
    <div class="p-6 max-w-lg mx-auto fade-in" style="color: var(--text);">

      <!-- Back & progress -->
      <div class="mb-6">
        <button class="btn-secondary mb-4" onclick="backToBrowseCards()">← Back to Cards</button>
        <div class="progress-bar mb-4" style="background: var(--surface);">
          <div style="width: ${progress}%; background: var(--primary); height: 4px;"></div>
        </div>
        <div class="text-center text-sm text-text-muted mb-4">
          Card ${currentBrowseCardIndex + 1} of ${totalCards}
        </div>
      </div>

      <!-- Flashcard -->
<div class="card-study rounded-xl mb-2" style="background: var(--card-bg); box-shadow: var(--shadow); perspective: 1000px;">
  <div class="card-inner ${isBrowseCardFlipped ? 'flipped' : ''}"
       onclick="flipBrowseCard()"
       style="transform-style: preserve-3d; cursor: pointer; width: 100%; min-height: 260px; border-radius: var(--radius); transition: transform 0.6s cubic-bezier(.175,.885,.32,1.275), scale 0.3s ease;">

    <!-- FRONT -->
    <div class="card-front absolute inset-0 rounded-xl flex flex-col items-center justify-center p-4"
         style="backface-visibility: hidden; background: var(--card-bg);">
      ${card.questionImage ? `<img src="${card.questionImage}" style="max-width: 100%; max-height: 60%; object-fit: contain; border-radius: var(--radius);" alt="Question image">` : ""}
      <div class="text-center text-lg font-semibold mt-2" style="color: var(--text);">${!isBrowseCardFlipped ? card.question : ''}</div>
    </div>

    <!-- BACK -->
    <div class="card-back absolute inset-0 rounded-xl flex flex-col items-center justify-center p-4"
         style="backface-visibility: hidden; transform: rotateY(180deg); background: var(--card-bg);">
      ${card.answerImage ? `<img src="${card.answerImage}" style="max-width: 100%; max-height: 60%; object-fit: contain; border-radius: var(--radius);" alt="Answer image">` : ""}
      <div class="text-center text-lg font-semibold mt-2" style="color: var(--text);">${isBrowseCardFlipped ? answerText : ''}</div>
      ${isBrowseCardFlipped && answerMathML ? `<div id="answerMath" class="text-lg leading-relaxed mt-2" style="color: var(--text);">${answerMathML}</div>` : ""}
    </div>

  </div>
</div>


      <!-- Image credits below -->
      ${card.imageCredit ? `<div class="text-right text-text-muted mb-4" style="font-size: 10px;">Image credit: ${card.imageCredit}</div>` : ''}

      <!-- Tap hint -->
      <div class="text-center mb-4">
        <p class="text-text-muted">Tap the card to ${isBrowseCardFlipped ? 'see question' : 'reveal answer'}</p>
      </div>

      <!-- Navigation -->
      <div class="flex justify-between gap-4">
        <button onclick="prevBrowseCard()"
                class="btn-secondary flex-1 py-3 ${currentBrowseCardIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                ${currentBrowseCardIndex === 0 ? 'disabled' : ''}>← Previous</button>
        <button onclick="nextBrowseCard()"
                class="btn-secondary flex-1 py-3 ${currentBrowseCardIndex === totalCards - 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                ${currentBrowseCardIndex === totalCards - 1 ? 'disabled' : ''}>Next →</button>
      </div>

      <style>
        .card-inner { transform: rotateY(0deg); }
        .card-inner.flipped { transform: rotateY(180deg) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
        .card-back { opacity: 0; transition: opacity 0.3s ease 0.25s; }
        .card-inner.flipped .card-back { opacity: 1; }
      </style>
    </div>
  `;
}


// ---------- Flip Card ----------
function flipBrowseCard() {
  isBrowseCardFlipped = !isBrowseCardFlipped;
  renderApp();
}

// ---------- Navigation ----------
function prevBrowseCard() {
  if (currentBrowseCardIndex > 0) currentBrowseCardIndex--;
  isBrowseCardFlipped = false; // reset flip
  renderApp();
}

function nextBrowseCard() {
  if (currentBrowseCardIndex < currentBrowseSetCards.length - 1) currentBrowseCardIndex++;
  isBrowseCardFlipped = false; // reset flip
  renderApp();
}

function startBrowseQuiz(setId) {
  const data = BUILT_IN_SETS[setId];
  if (!data) return;

  currentBrowseQuizCards = data.cards;
  currentBrowseQuizIndex = 0;
  currentBrowseQuizScore = 0;
  currentView = "browse-quiz";
  renderApp();
}

function renderBrowseQuizView() {
  const card = currentBrowseQuizCards[currentBrowseQuizIndex];
  if (!card) {
    return `
      <div class="p-4 max-w-md mx-auto fade-in text-center">
        <h2 class="text-xl font-semibold mb-4">Quiz Complete!</h2>
        <p class="mb-4">Score: ${currentBrowseQuizScore} / ${currentBrowseQuizCards.length}</p>
        <button class="px-4 py-2 rounded-lg" style="background:var(--primary); color:white;" onclick="backToBrowseCards()">
          Back to Set
        </button>
      </div>
    `;
  }

  return `
    <div class="p-4 max-w-md mx-auto fade-in">
      <h3 class="font-semibold text-lg mb-2">Q${currentBrowseQuizIndex + 1}: ${card.question}</h3>

      <button class="w-full py-3 mt-3 rounded-xl text-white" style="background:var(--primary)" onclick="answerBrowseQuiz(true)">
        Show Answer
      </button>
    </div>
  `;
}

function answerBrowseQuiz(showAnswer) {
  if (showAnswer) currentBrowseQuizScore++;
  currentBrowseQuizIndex++;
  renderApp();
}

function backToBrowseCards() {
  currentView = "browse-cards";
  renderApp();
}

function goBackToBrowse() {
  currentBrowseSetId = null;
  currentView = "browse";
  renderApp();
}

function renderThemesView() {
  const categories = {
    "Nature": ["jungle", "safari", "ocean", "lake"],
    "Animals": [
      "animals_jungle","animals_safari","animals_ocean","animals_pets","animals_arctic",
      "animals_rainforest","animals_desert","animals_farm","animals_jungle_night",
      "animals_deep_sea","animals_butterflies","animals_tropical_birds"
    ],
    "K-pop": ["blackpink", "bts", "twice","seventeen","straykids","exo","redvelvet","itzy","newjeans"],
    "Vibes": ["forest","mint","lavender","coffee"],
    "Dark Aesthetic": ["midnight","graphite","cyber","futuristic"],
    "Light & Minimal": ["light","paper","sunset","rose"]
  };

  // Build theme sections
  const themeSection = Object.keys(categories).map(category => `
    <div class="theme-section mb-5">
      <h3 class="text-lg font-semibold mb-2">${category}</h3>
      <div class="grid grid-cols-2 gap-2">
        ${categories[category].map(t => createThemeButton(t)).join("")}
      </div>
    </div>
  `).join("");

  // Add the toggle button dynamically inside Themes view
  const toggleButtonHTML = `
    <div class="flex justify-center mb-4">
      <button id="toggleSettingsBtn" class="px-4 py-2 bg-blue-500 text-white rounded-md shadow">
        Toggle Settings
      </button>
    </div>
  `;

  // Hide settings button immediately in Themes view
  const settingsBtn = document.getElementById("openSettingsBtn");
  if (settingsBtn) settingsBtn.style.display = "none";

  // Combine all content
  const content = `
    <div class="mobile-optimized p-4 fade-in max-w-md mx-auto">
      <h2 class="text-xl font-bold mb-4 text-center">🎨 Themes</h2>
      <p class="text-base opacity-70 text-center mb-4">Choose a theme category below</p>
      ${toggleButtonHTML}
      ${themeSection}
    </div>
  `;

  // Return the content to be inserted in the app
  return content;
}

// Attach global toggle behavior
document.addEventListener("click", (event) => {
  const settingsBtn = document.getElementById("openSettingsBtn");
  const toggleBtn = document.getElementById("toggleSettingsBtn");

  // Check if the clicked element is the toggle button
  if (toggleBtn && (event.target === toggleBtn || toggleBtn.contains(event.target))) {
    if (settingsBtn) {
      settingsBtn.style.display = settingsBtn.style.display === "none" ? "" : "none";
    }
  }
});



function formatName(name) {
  return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function createThemeButton(themeName) {
  const preset = THEME_PRESETS[themeName];
  if (!preset) return "";

  const bgImage = preset.backgroundImage || null;
  const previewStyle = bgImage
    ? `background-image:${bgImage}; background-size:cover; background-position:center;`
    : `background:${preset.colors.background}; border:1px solid #ccc;`;

  return `
    <button 
      onclick="applyThemePreset('${themeName}')"
      style="
        padding:12px; 
        border-radius:10px;
        background:${preset.colors.card}; 
        color:${preset.colors.text};
        text-align:center;
        font-weight:600;
        transition:.2s;
        display:flex;
        flex-direction:column;
        gap:8px;
        min-height: 100px;
      "
      class="theme-btn hover:scale-[1.03] quiz-option"
    >

      <!-- Preview Box -->
      <div style="
        width:100%; 
        height:60px; 
        border-radius:8px;
        ${previewStyle}
      "></div>

      <!-- Label -->
      <span style="font-size:14px">${formatName(themeName)}</span>
    </button>
  `;
}


function applyThemePreset(name) {
  const theme = THEME_PRESETS[name];
  if (!theme) return;

  window.currentTheme = name;
  localStorage.setItem("flashcard-theme", name);

  const r = document.documentElement.style;

  // Colors
  r.setProperty("--primary", theme.colors.primary);
  r.setProperty("--primary-hover", theme.colors.primaryHover || theme.colors.primary);
  r.setProperty("--primary-dark", theme.colors.primaryDark || theme.colors.primary);
  r.setProperty("--secondary", theme.colors.secondary);
  r.setProperty("--secondary-dark", theme.colors.secondaryDark || theme.colors.secondary);
  r.setProperty("--accent", theme.colors.accent);
  r.setProperty("--accent-dark", theme.colors.accentDark || theme.colors.accent);
  r.setProperty("--background", theme.colors.background);
  r.setProperty("--card-bg", theme.colors.card);
  r.setProperty("--surface", theme.colors.surface);
  r.setProperty("--surface-hover", theme.colors.surfaceHover || theme.colors.surface);
  r.setProperty("--text", theme.colors.text);
  r.setProperty("--text-muted", theme.colors.textMuted);
  r.setProperty("--text-secondary", theme.colors.textSecondary || theme.colors.textMuted);
  r.setProperty("--success", theme.colors.success);
  r.setProperty("--success-dark", theme.colors.successDark || theme.colors.success);
  r.setProperty("--error", theme.colors.error);
  r.setProperty("--error-dark", theme.colors.errorDark || theme.colors.error);
  r.setProperty("--warning", theme.colors.warning);
  r.setProperty("--warning-dark", theme.colors.warningDark || theme.colors.warning);
  r.setProperty("--border", theme.colors.border);
  r.setProperty("--border-hover", theme.colors.borderHover || theme.colors.border);

  // Fonts
  r.setProperty("--font-family", theme.fonts.family);
  r.setProperty("--font-family-heading", theme.fonts.headingFamily || theme.fonts.family);
  r.setProperty("--font-weight-normal", theme.fonts.weightNormal);
  r.setProperty("--font-weight-medium", theme.fonts.weightMedium);
  r.setProperty("--font-weight-semibold", theme.fonts.weightSemibold);
  r.setProperty("--font-weight-bold", theme.fonts.weightBold);

  // Shadows
  r.setProperty("--shadow-color", theme.shadows.color);
  r.setProperty("--shadow-color-lg", theme.shadows.colorLg);

  // Glass effects
  r.setProperty("--glass-bg", theme.glass.background);
  r.setProperty("--glass-border", theme.glass.border);

  // Background image
  if (theme.backgroundImage) {
    r.setProperty("--background-image", theme.backgroundImage);
  } else {
    r.setProperty("--background-image", "none");
  }

  renderApp();
}

function initPdfWorker() {
  if (!window.pdfjsLib) return;

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}




function getBuiltInPdfs() {
  // Define all available PDFs in the pdfs folder
  const pdfFiles = [
    { name: "Basic Electronics", url: "pdfs/basic-electronics.pdf", description: "Comprehensive guide to basic electronics concepts", type: "built-in", icon: "⚡" },
    { name: "Basic Electronics (Text)", url: "pdfs/basic-electronics.txt", description: "Text version of basic electronics guide", type: "built-in", icon: "📝" },
    { name: "Flashcard Study Guide", url: "pdfs/study-guide.txt", description: "Complete study guide for using flashcards effectively", type: "built-in", icon: "📚" },
    { name: "Learning Tips", url: "pdfs/learning-tips.txt", description: "Effective learning strategies and study techniques", type: "built-in", icon: "💡" },
    { name: "Quick Reference", url: "pdfs/quick-reference.txt", description: "Quick reference guide for common concepts", type: "built-in", icon: "🔍" },
    { name: "Quiz Instructions", url: "pdfs/quiz-instructions.txt", description: "How to use the quiz feature effectively", type: "built-in", icon: "❓" },
    { name: "Sample Import", url: "pdfs/sample-import.txt", description: "Sample file showing import format", type: "built-in", icon: "📄" }
  ];

  return pdfFiles;
}

function renderPdfsView() {
  // Get imported PDFs from localStorage
  const importedPdfs = JSON.parse(localStorage.getItem('imported-pdfs') || '[]');

  // Calculate storage usage
  const storageUsage = calculateStorageUsage();

  // Dynamically load built-in PDFs from the pdfs folder
  const builtInPdfs = getBuiltInPdfs();

  // Combine built-in and imported PDFs
  const allPdfs = [...builtInPdfs, ...importedPdfs.map(pdf => ({ ...pdf, type: "imported" }))];

  const pdfList = allPdfs.map(pdf => `
    <div class="pdf-item card p-4 mb-3 cursor-pointer hover:scale-[1.02] transition-all duration-200 hover:shadow-lg"
         onclick="openPdf('${pdf.url}', '${pdf.name}', '${pdf.type}')"
         style="background: var(--card-bg); border-radius: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border);">
      <div class="flex items-center gap-4">
        <div class="pdf-icon text-3xl flex-shrink-0">${pdf.icon || (pdf.type === 'imported' ? '📁' : '📄')}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <h3 class="font-semibold text-base truncate" style="color: var(--text);">${pdf.name}</h3>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${pdf.type === 'imported' ? '<span class="text-xs text-white px-2 py-1 rounded-full font-medium" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">Imported</span>' : '<span class="text-xs text-white px-2 py-1 rounded-full font-medium" style="background: linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%);">Built-in</span>'}
              ${pdf.type === 'imported' ? `<button onclick="deleteImportedPdf('${pdf.url}', event)" class="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors" title="Delete PDF">🗑️</button>` : ''}
            </div>
          </div>
          <p class="text-sm opacity-75 leading-relaxed" style="color: var(--text-muted);">${pdf.description}</p>
          ${pdf.type === 'imported' ? `<div class="text-xs opacity-60 mt-1" style="color: var(--text-muted);">Added ${pdf.importedAt ? new Date(pdf.importedAt).toLocaleDateString() : 'recently'}</div>` : ''}
        </div>
        <div class="pdf-arrow text-lg opacity-50">→</div>
      </div>
    </div>
  `).join("");

  return `
    <div class="mobile-optimized p-4 fade-in max-w-md mx-auto relative">
      <!-- Header with gradient background -->
      <div class="card p-6 mb-6 relative overflow-hidden" style="background: linear-gradient(135deg, var(--card-bg) 0%, var(--surface) 100%); border-radius: 20px; box-shadow: var(--shadow-lg); border: 1px solid var(--border);">
        <div class="absolute inset-0 opacity-30" style="background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 50%, var(--secondary) 100%);"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">
                <span class="text-xl text-white">📚</span>
              </div>
              <div>
                <h2 class="text-2xl font-bold" style="color: var(--text); font-family: var(--font-family-heading);">PDF Library</h2>
                <p class="text-sm opacity-75" style="color: var(--text-muted);">${allPdfs.length} documents available</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="clearImportedPdfs()" class="p-2 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 shadow-md" style="background: var(--error);" title="Clear all imported PDFs">
                <span class="text-lg">🗑️</span>
              </button>
              <button onclick="importPdf()" class="px-4 py-2 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 shadow-md" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">
                <span class="mr-1">+</span> Import
              </button>
            </div>
          </div>

          ${storageUsage.importedCount > 0 ? `
            <div class="storage-info p-3 rounded-xl" style="background: var(--glass-bg); border: 1px solid var(--glass-border);">
              <div class="flex items-center justify-between text-sm mb-2">
                <span style="color: var(--text); font-medium;">Storage Usage</span>
                <span style="color: var(--text-muted);">${storageUsage.totalSize}</span>
              </div>
              <div class="storage-bar w-full h-2 rounded-full overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
                <div class="h-full transition-all duration-500 ease-out rounded-full" style="width: ${Math.min(storageUsage.usagePercent, 100)}%; background: linear-gradient(90deg, ${storageUsage.usagePercent > 80 ? 'var(--error)' : storageUsage.usagePercent > 60 ? 'var(--warning)' : 'var(--success)'}, ${storageUsage.usagePercent > 80 ? 'var(--error-dark)' : storageUsage.usagePercent > 60 ? 'var(--warning-dark)' : 'var(--success-dark)'});"></div>
              </div>
              <div class="text-xs opacity-70 mt-1" style="color: var(--text-muted);">${storageUsage.importedCount} imported document${storageUsage.importedCount !== 1 ? 's' : ''}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- PDF List -->
      <div class="pdf-list space-y-3">
        ${pdfList}
      </div>

      <!-- Empty state -->
      ${allPdfs.length === 0 ? `
        <div class="text-center py-12">
          <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style="background: var(--surface); border: 2px solid var(--border);">
            <span class="text-3xl">📄</span>
          </div>
          <h3 class="text-lg font-semibold mb-2" style="color: var(--text); font-family: var(--font-family-heading);">No PDFs yet</h3>
          <p class="text-sm opacity-70 mb-4" style="color: var(--text-muted);">Import your first PDF document to get started</p>
          <button onclick="importPdf()" class="px-6 py-3 text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-md" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">
            Import PDF
          </button>
        </div>
      ` : ''}

      <input type="file" id="pdf-import-input" accept=".pdf,.txt" style="display: none;" onchange="handlePdfImport(event)">
    </div>
  `;
}

function openPdf(url, name, type = "built-in") {
  window.currentPdf = { url, name, type };
  currentView = "pdf-viewer";
  renderApp();

  requestAnimationFrame(() => {
    openPdfViewer(url);
  });
}

function openPdfViewer(pdfUrl) {
  initPdfWorker();
  pageNum = 1;
  scale = 1.0;
  loadPdf(pdfUrl);
}

async function loadPdf(url) {
  canvas = document.getElementById("pdf-canvas");
  if (!canvas) {
    console.error("Canvas not found");
    return;
  }

  ctx = canvas.getContext("2d");
  showLoadingIndicator();

  let pdfSource = url;

  // Handle imported PDFs stored in localStorage
  if (url.startsWith('imported-')) {
    const importedPdfs = JSON.parse(localStorage.getItem('imported-pdfs') || '[]');
    const importedPdf = importedPdfs.find(pdf => pdf.url === url);

    if (!importedPdf) {
      console.error('Imported PDF not found in localStorage');
      hideLoadingIndicator();
      showToast('PDF not found. It may have been deleted.');
      return;
    }

    // For imported PDFs, content is now stored as a base64 data URL
    pdfSource = importedPdf.content;
  }

  try {
    const loadingTask = pdfjsLib.getDocument(pdfSource);
    pdfDoc = await loadingTask.promise;

    document.getElementById("total-pages").textContent = pdfDoc.numPages;
    document.getElementById("page-input").max = pdfDoc.numPages;

    renderPage(pageNum);
  } catch (error) {
    console.error('Error loading PDF:', error);
    hideLoadingIndicator();
    showToast('Error loading PDF. Please try again.');
  }

 setupPdfSwipe();

}

function handlePdfSwipe() {
  const deltaX = touchEndX - touchStartX;

  if (Math.abs(deltaX) < swipeThreshold) return;

  const direction = deltaX > 0 ? -1 : 1; // right = prev, left = next

  // Animate swipe
  canvas.style.transform = `translateX(${direction * 100}%)`;
  setTimeout(() => {
    canvas.style.transition = 'none';
    canvas.style.transform = 'translateX(0)';
    canvas.offsetHeight; // force reflow
    canvas.style.transition = 'transform 0.25s ease';

    if (direction > 0) nextPage();
    else previousPage();
  }, 200);
}


function setupPdfSwipe() {
  const container = document.getElementById("pdf-content");
  if (!container) return;

  // Remove any existing listeners
  container.ontouchstart = null;
  container.ontouchend = null;
  container.onmousedown = null;
  container.onmouseup = null;

  let mouseDown = false;

  container.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  container.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handlePdfSwipe();
  });

  container.addEventListener("mousedown", (e) => {
    mouseDown = true;
    touchStartX = e.screenX;
  });

  container.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    touchEndX = e.screenX;
    handlePdfSwipe();
  });
}


function renderPdfViewerView() {
  const pdf = window.currentPdf;
  if (!pdf) {
    return `
      <div class="mobile-optimized p-4 fade-in max-w-md mx-auto">
        <h2 class="text-xl font-bold mb-4 text-center">📄 PDF Viewer</h2>
        <p class="text-center">No PDF selected</p>
        <button onclick="goToPdfs()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">Back to PDFs</button>
      </div>
    `;
  }

  return `
    <div class="pdf-viewer-container mobile-optimized fade-in w-full max-w-md mx-auto">
      <!-- Enhanced PDF Viewer Header -->
      <div class="pdf-header card p-3 sm:p-4 mb-2 sm:mb-3" style="background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow-sm);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button onclick="goToPdfs()" class="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105 flex-shrink-0" title="Back to PDFs">
              <span class="text-xl">⬅️</span>
            </button>
            <div class="flex-1 min-w-0">
              <h2 class="text-base sm:text-lg font-bold truncate" style="color: var(--text);">${pdf.name}</h2>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs opacity-70" style="color: var(--text);">${pdf.type === 'imported' ? 'Imported Document' : 'Built-in Document'}</span>
                ${pdf.type === 'imported' ? '<span class="text-xs text-white px-2 py-1 rounded-full font-medium" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">Imported</span>' : '<span class="text-xs text-white px-2 py-1 rounded-full font-medium" style="background: linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%);">Built-in</span>'}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 rounded-xl p-1 ml-2" style="background: var(--surface); border: 1px solid var(--border);">
            <button onclick="zoomOut()" class="p-2 rounded-lg transition-all duration-200 hover:scale-105" style="color: var(--text);" title="Zoom Out">
              <span class="text-base sm:text-lg">🔍➖</span>
            </button>
            <span id="zoom-level" class="text-xs sm:text-sm font-semibold px-2 sm:px-3 min-w-[40px] sm:min-w-[50px] text-center" style="color: var(--text);">100%</span>
            <button onclick="zoomIn()" class="p-2 rounded-lg transition-all duration-200 hover:scale-105" style="color: var(--text);" title="Zoom In">
              <span class="text-base sm:text-lg">🔍➕</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Enhanced PDF Content Area -->
      <div class="pdf-content-area card" style="background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow-sm); overflow: hidden;">
        <!-- Modern Toolbar -->
        <div id="pdf-toolbar" class="pdf-toolbar px-3 sm:px-4 py-2 sm:py-3 border-b" style="border-color: var(--border); background: linear-gradient(135deg, var(--surface) 0%, var(--card-bg) 100%);">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div class="flex items-center gap-1 sm:gap-2">
                <span class="text-xs sm:text-sm font-medium" style="color: var(--text);">📄</span>
                <span id="page-info" class="text-xs sm:text-sm font-semibold" style="color: var(--text);">Page 1 of 1</span>
              </div>
              <div class="hidden sm:block h-4 w-px bg-gray-300" style="background: var(--border);"></div>
              <div class="flex items-center gap-1 sm:gap-2">
                <span class="text-xs sm:text-sm opacity-70" style="color: var(--text);">📊</span>
                <span id="word-count" class="text-xs sm:text-sm opacity-70" style="color: var(--text);">Loading...</span>
              </div>
            </div>
            <div class="flex items-center gap-1 sm:gap-2">
              <button onclick="toggleReadingMode()" id="reading-mode-btn" class="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105" style="color: var(--text);" title="Toggle Reading Mode">
                <span class="text-sm sm:text-lg">📖</span>
              </button>
              <button onclick="toggleFullscreen()" class="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105" style="color: var(--text);" title="Toggle Fullscreen">
                <span class="text-sm sm:text-lg">⛶</span>
              </button>
              <button onclick="fitToWidth()" class="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-105" style="color: var(--text);" title="Fit to Width">
                <span class="text-sm sm:text-lg">↔️</span>
              </button>
            </div>
          </div>
        </div>

        <!-- PDF Content with Loading State -->
        <div id="pdf-content" class="pdf-content relative" style="min-height:60vh; max-height:70vh; overflow:auto; background: var(--surface);">
          <div id="pdf-loading" class="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm" style="background: var(--glass-bg);">
            <div class="flex flex-col items-center gap-3">
              <div class="animate-spin rounded-full h-10 w-10 border-3 border-t-transparent" style="border-color: var(--primary); border-top-color: transparent;"></div>
              <span class="text-sm font-medium opacity-70" style="color: var(--text);">Loading PDF...</span>
            </div>
          </div>
          <div class="p-2 sm:p-4 flex justify-center">
            <canvas id="pdf-canvas" class="shadow-sm max-w-full h-auto" style="border-radius: 8px; touch-action: manipulation;"></canvas>
          </div>
        </div>
      </div>

      <!-- Enhanced Navigation Footer -->
      <div class="pdf-footer card p-3 sm:p-4 mt-2 sm:mt-3" style="background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow-sm);">
        <div class="flex items-center justify-between gap-2">
          <button onclick="previousPage()" id="prev-page-btn"
                  class="px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm shadow-sm hover:shadow-md active:scale-95 touch-manipulation"
                  style="background: linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%); color: var(--text); border: 1px solid var(--border);" disabled>
            <span class="hidden sm:inline">⬅️ Previous</span>
            <span class="sm:hidden text-sm">⬅️</span>
          </button>

          <div class="flex items-center gap-2 sm:gap-3 rounded-xl px-3 sm:px-4 py-2" style="background: var(--surface); border: 1px solid var(--border);">
            <input type="number" id="page-input" value="1" min="1" max="1"
                   class="w-12 sm:w-14 px-1 sm:px-2 py-1 text-center border-0 bg-transparent font-semibold text-xs sm:text-sm focus:outline-none rounded touch-manipulation"
                   style="color: var(--text); background: var(--surface);">
            <span class="text-xs sm:text-sm opacity-70" style="color: var(--text-muted);">of</span>
            <span id="total-pages" class="text-xs sm:text-sm font-bold" style="color: var(--text);">1</span>
          </div>

          <button onclick="nextPage()" id="next-page-btn"
                  class="px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm shadow-sm hover:shadow-md active:scale-95 touch-manipulation"
                  style="background: linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%); color: var(--text); border: 1px solid var(--border);" disabled>
            <span class="hidden sm:inline">Next ➡️</span>
            <span class="sm:hidden text-sm">➡️</span>
          </button>
        </div>

        <!-- Progress Bar -->
        <div class="mt-3 sm:mt-4">
          <div class="w-full rounded-full h-2 sm:h-2.5" style="background: var(--surface); border: 1px solid var(--border);">
            <div id="page-progress" class="h-2 sm:h-2.5 rounded-full transition-all duration-300" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); width: 100%;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}


async function renderPage(num) {
  if (!pdfDoc || !canvas) return;

  const page = await pdfDoc.getPage(num);

  // Get device pixel ratio for high DPI displays (mobile devices)
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Adjust scale for reading mode (better readability)
  const effectiveScale = readingMode ? scale * 1.2 : scale;

  // Create viewport with scale and device pixel ratio for crisp rendering
const viewport = page.getViewport({
  scale: scale * (window.devicePixelRatio || 1)
});


  // Set canvas size accounting for device pixel ratio
  const canvasContainer = canvas.parentElement;
  const maxWidth = canvasContainer ? canvasContainer.clientWidth - 32 : viewport.width / devicePixelRatio;
  const maxHeight = canvasContainer ? canvasContainer.clientHeight - 32 : viewport.height / devicePixelRatio;

  // Auto-fit to width on mobile if scale is 1.0
  if (scale === 1.0 && window.innerWidth < 768) {
    const fitScale = maxWidth / (viewport.width / devicePixelRatio);
    scale = Math.min(fitScale, 2.0); // Cap at 200% for readability
    const adjustedViewport = page.getViewport({
      scale: scale * devicePixelRatio
    });
    canvas.width = adjustedViewport.width;
    canvas.height = adjustedViewport.height;
  } else {
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }

  // Scale canvas back to CSS pixels for proper display
  canvas.style.width = (canvas.width / devicePixelRatio) + 'px';
  canvas.style.height = (canvas.height / devicePixelRatio) + 'px';

  // Cancel any previous render
  if (pdfRenderTask) {
    pdfRenderTask.cancel();
  }

  pdfRenderTask = page.render({
    canvasContext: ctx,
    viewport,
    // Improve text rendering quality
    renderInteractiveForms: false,
    // Enable text layer for better text selection and accessibility
    textLayer: {
      textContentSource: page.streamTextContent(),
      viewport: viewport,
      container: document.getElementById('pdf-text-layer') || canvas.parentElement,
      enhanceTextSelection: true
    }
  });

  try {
    await pdfRenderTask.promise;
  } catch (err) {
    if (err instanceof pdfjsLib.RenderingCancelledException) {
      return; // expected when render is cancelled
    } else {
      console.error(err);
    }
  }

  pdfRenderTask = null;

  // Update navigation UI
  updateNavButtons();
  updateZoomLabel();
  updatePageInfo();
  hideLoadingIndicator();
}

window.addEventListener("resize", () => {
  if (isFullscreen && pdfDoc) {
    renderPage(pageNum);
  }
});


function updateNavButtons() {
  document.getElementById("prev-page-btn").disabled = pageNum <= 1;
  document.getElementById("next-page-btn").disabled = pageNum >= pdfDoc.numPages;
}

function updateZoomLabel() {
  const zoomLabel = document.getElementById("zoom-level");
  if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function updatePageInfo() {
  const pageInfo = document.getElementById("page-info");
  if (pageInfo) pageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
  updateProgressBar();
}

// Navigation buttons
function nextPage() {
  if (pageNum < pdfDoc.numPages) {
    pageNum++;
    renderPage(pageNum);
  }
}

function previousPage() {
  if (pageNum > 1) {
    pageNum--;
    renderPage(pageNum);
  }
}

// Zoom buttons
function zoomIn() {
  scale = Math.min(scale + 0.1, 3);
  renderPage(pageNum);
}

function zoomOut() {
  scale = Math.max(scale - 0.1, 0.5);
  renderPage(pageNum);
}

function toggleFullscreen() {
  const container = document.querySelector(".pdf-viewer-container");
  if (!container) return;

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen();
  }
}


document.addEventListener("fullscreenchange", () => {
  const container = document.querySelector(".pdf-viewer-container");
  if (!container) return;

  const isFull = !!document.fullscreenElement;
  isFullscreen = isFull;

  const header = document.querySelector(".pdf-header");
  const toolbar = document.getElementById("pdf-toolbar");
  const footer = document.querySelector(".pdf-footer");
  const settingsBtn = document.getElementById("openSettingsBtn");

  // Toggle UI
  [header, toolbar, footer, settingsBtn].forEach(el => {
    if (el) el.style.display = isFull ? "none" : "";
  });

  // Toggle fullscreen styles
  container.classList.toggle("pdf-fullscreen", isFull);
  document.body.classList.toggle("pdf-lock", isFull);

  // Re-render to fit screen or restore
  requestAnimationFrame(() => {
    renderPage(pageNum);
  });
});



function hidePdfUI(hide = true) {
  const header = document.querySelector(".pdf-header");
  const toolbar = document.getElementById("pdf-toolbar");
  const footer = document.querySelector(".pdf-footer");

  [header, toolbar, footer].forEach(el => {
    if (el) el.style.display = hide ? "none" : "";
  });
}

document.addEventListener("fullscreenchange", () => {
  const canvas = document.getElementById("pdf-canvas");
  const header = document.querySelector(".pdf-header");
  const toolbar = document.getElementById("pdf-toolbar");
  const footer = document.querySelector(".pdf-footer");

  const isFull = !!document.fullscreenElement;
  isFullscreen = isFull;

  // SHOW UI when NOT fullscreen, HIDE UI when fullscreen
  [header, toolbar, footer].forEach(el => {
    if (el) el.style.display = isFull ? "none" : "";
  });

  if (canvas) {
    if (isFull) {
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.objectFit = "contain";
    } else {
      canvas.style.objectFit = "initial";
      // Re-render page to reset canvas size
      if (pdfDoc) renderPage(pageNum);
    }
  }
});




function toggleReadingMode() {
  readingMode = !readingMode;
  const btn = document.getElementById('reading-mode-btn');
  if (btn) {
    btn.classList.toggle('bg-blue-100', readingMode);
    btn.title = readingMode ? 'Exit Reading Mode' : 'Toggle Reading Mode';
  }

  // Apply reading mode styles
  const pdfContent = document.getElementById('pdf-content');
  if (pdfContent) {
    if (readingMode) {
      pdfContent.classList.add('reading-mode');
      pdfContent.style.background = 'var(--surface)';
      pdfContent.style.filter = 'sepia(10%) contrast(1.1) brightness(1.05)';
    } else {
      pdfContent.classList.remove('reading-mode');
      pdfContent.style.background = 'var(--surface)';
      pdfContent.style.filter = 'none';
    }
  }

  // Re-render current page with reading mode settings
  if (pdfDoc) {
    renderPage(pageNum);
  }

  showToast(readingMode ? 'Reading mode enabled' : 'Reading mode disabled');
}

// Fit to width function
function fitToWidth() {
  if (!pdfDoc || !canvas) return;

  const container = document.getElementById("pdf-content");
  if (!container) return;

  const containerWidth = container.clientWidth - 32; // Account for padding
  const page = pdfDoc.getPage(pageNum);

  page.then(p => {
    const viewport = p.getViewport({ scale: 1 });
    const scaleToFit = containerWidth / viewport.width;
    scale = Math.min(scaleToFit, 2); // Cap at 200% to prevent too much zoom
    renderPage(pageNum);
  });
}

// Update progress bar
function updateProgressBar() {
  const progressBar = document.getElementById("page-progress");
  if (progressBar && pdfDoc) {
    const progress = (pageNum / pdfDoc.numPages) * 100;
    progressBar.style.width = `${progress}%`;
  }
}

// Hide loading indicator
function hideLoadingIndicator() {
  const loading = document.getElementById("pdf-loading");
  if (loading) {
    loading.style.display = "none";
  }
}

// Show loading indicator
function showLoadingIndicator() {
  const loading = document.getElementById("pdf-loading");
  if (loading) {
    loading.style.display = "flex";
  }
}

function calculateStorageUsage() {
  const importedPdfs = JSON.parse(localStorage.getItem('imported-pdfs') || '[]');

  let totalSize = 0;
  importedPdfs.forEach(pdf => {
    // Estimate size: content + metadata (rough calculation)
    const contentSize = pdf.content ? pdf.content.length * 2 : 0; // UTF-16 characters
    const metadataSize = JSON.stringify(pdf).length * 2;
    totalSize += contentSize + metadataSize;
  });

  // Convert to human readable format
  const sizeInMB = totalSize / (1024 * 1024);
  let sizeString;
  if (sizeInMB >= 1) {
    sizeString = sizeInMB.toFixed(1) + 'MB';
  } else {
    sizeString = (totalSize / 1024).toFixed(1) + 'KB';
  }

  // Estimate usage percentage (localStorage typically has 5-10MB limit)
  const estimatedQuota = 5 * 1024 * 1024; // Assume 5MB limit
  const usagePercent = (totalSize / estimatedQuota) * 100;

  return {
    totalSize: sizeString,
    importedCount: importedPdfs.length,
    usagePercent: Math.round(usagePercent)
  };
}

// Helper functions for home view stats
function getTotalSubjects() {
  const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
  return subjects.length;
}

function getTotalCards() {
  const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
  let totalCards = 0;
  subjects.forEach(subject => {
    if (subject.sets) {
      subject.sets.forEach(set => {
        if (set.cards) {
          totalCards += set.cards.length;
        }
      });
    }
  });
  return totalCards;
}

function getTotalQuizzes() {
  const quizzes = JSON.parse(localStorage.getItem('teacher-quizzes') || '[]');
  return quizzes.length;
}

function clearImportedPdfs() {
  if (confirm('Are you sure you want to delete all imported PDFs? This action cannot be undone.')) {
    localStorage.removeItem('imported-pdfs');
    showToast('All imported PDFs cleared');
    renderApp();
  }
}

function importPdf() {
  const input = document.getElementById('pdf-import-input');
  if (input) {
    input.click();
  }
}

function handlePdfImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file type
  if (!file.type.includes('text') && !file.type.includes('pdf')) {
    showToast('Please select a text file or PDF');
    return;
  }

  // Check file size (limit to 2MB to avoid localStorage quota issues)
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    showToast(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 2MB.`);
    return;
  }

  const reader = new FileReader();
  const isPdf = file.type.includes('pdf');

  reader.onload = function(e) {
    let content = e.target.result;
    const fileName = file.name.replace(/\.(txt|pdf)$/i, '');

    // For PDFs, convert ArrayBuffer to base64 data URL
    if (isPdf) {
      const arrayBuffer = content;
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
      content = 'data:application/pdf;base64,' + btoa(binaryString);
    }

    // Create imported PDF object
    const importedPdf = {
      name: fileName,
      url: `imported-${Date.now()}`,
      description: `Imported on ${new Date().toLocaleDateString()}`,
      content: content,
      originalFileName: file.name,
      importedAt: new Date().toISOString(),
      size: file.size,
      type: isPdf ? 'pdf' : 'text'
    };

    try {
      // Try to save to localStorage
      const importedPdfs = JSON.parse(localStorage.getItem('imported-pdfs') || '[]');

      // Check if we already have this file
      const existingIndex = importedPdfs.findIndex(pdf => pdf.originalFileName === file.name);
      if (existingIndex !== -1) {
        if (!confirm(`"${fileName}" already exists. Replace it?`)) {
          return;
        }
        importedPdfs.splice(existingIndex, 1);
      }

      importedPdfs.push(importedPdf);
      localStorage.setItem('imported-pdfs', JSON.stringify(importedPdfs));

      showToast(`"${fileName}" imported successfully!`);
      renderApp(); // Refresh the PDF list

    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        showToast('Storage quota exceeded. Please delete some imported PDFs to free up space.');
      } else {
        showToast('Error saving PDF: ' + error.message);
      }
    }
  };

  reader.onerror = function() {
    showToast('Error reading file');
  };

  // Read PDF as ArrayBuffer, text files as text
  if (isPdf) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }

  // Reset the input
  event.target.value = '';
}

document.addEventListener("change", function (e) {
  if (e.target.id === "page-input") {
    const value = parseInt(e.target.value, 10);

    if (!pdfDoc) return;

    if (value >= 1 && value <= pdfDoc.numPages) {
      pageNum = value;
      renderPage(pageNum);
    } else {
      e.target.value = pageNum;
    }
  }
});


function renderHomeView() {
  const user = getUser();
  
  return `
    <div class="w-full min-h-screen p-lg" style="background-color: var(--background);">
      <div class="container max-w-4xl mx-auto">
        <!-- Welcome Section -->
        <div class="animate-slideInUp mb-2xl">
          <div class="flex flex-col items-center text-center mb-xl">
            <div class="w-20 h-20 rounded-full flex items-center justify-center mb-lg" style="background: linear-gradient(135deg, var(--primary), var(--accent)); font-size: 2.5rem;">
              🎓
            </div>
            <h1 class="text-4xl font-bold mb-md" style="color: var(--text);">Study Hub</h1>
            <p class="text-lg" style="color: var(--text-muted); max-width: 500px;">
              Master your subjects with interactive flashcards and quizzes
            </p>
          </div>
        </div>

        <!-- User Status Card -->
        ${createCard(`
          <div class="flex-between gap-lg">
            <div>
              <div class="text-sm font-medium" style="color: var(--text-muted); margin-bottom: var(--spacing-sm);">
                ${window.isAuthenticated ? '☁️ Cloud Sync Enabled' : '💾 Local Data Only'}
              </div>
              <div class="text-xl font-semibold" style="color: var(--text);">
                Welcome, ${user.name || 'Guest'}
              </div>
            </div>
            ${window.isAuthenticated ? `<button class="btn-danger text-sm" onclick="confirmLogout()">Logout</button>` : ''}
          </div>
        `, { className: 'mb-xl' })}

        <!-- Main Actions Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-lg mb-2xl">
          <!-- Flashcards Card -->
          ${createCard(`
            <div class="text-center">
              <div class="text-4xl mb-md">🃏</div>
              <h3 class="text-xl font-semibold mb-md">Flashcards</h3>
              <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
                Study with interactive flashcards
              </p>
              <button class="btn-primary w-full" onclick="openFlashcards()">
                Start Studying
              </button>
            </div>
          `, { elevated: true })}

          <!-- Create Quiz Card -->
          ${createCard(`
            <div class="text-center">
              <div class="text-4xl mb-md">👩‍🏫</div>
              <h3 class="text-xl font-semibold mb-md">Create Quiz</h3>
              <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
                Design and share quizzes
              </p>
              <button class="btn-primary w-full" onclick="openTeacherQuiz()">
                New Quiz
              </button>
            </div>
          `, { elevated: true })}

          <!-- Join Quiz Card -->
          ${createCard(`
            <div class="text-center">
              <div class="text-4xl mb-md">👨‍🎓</div>
              <h3 class="text-xl font-semibold mb-md">Join Quiz</h3>
              <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
                Take quizzes with class code
              </p>
              <button class="btn-primary w-full" onclick="openStudentQuiz()">
                Join Now
              </button>
            </div>
          `, { elevated: true })}
        </div>

        <!-- Stats Section -->
        <div class="grid grid-cols-3 gap-lg">
          ${createCard(`
            <div class="text-center">
              <div class="text-3xl font-bold" style="color: var(--primary);">${getTotalSubjects()}</div>
              <div class="text-sm mt-md" style="color: var(--text-muted);">Subjects</div>
            </div>
          `)}

          ${createCard(`
            <div class="text-center">
              <div class="text-3xl font-bold" style="color: var(--accent);">${getTotalCards()}</div>
              <div class="text-sm mt-md" style="color: var(--text-muted);">Cards</div>
            </div>
          `)}

          ${createCard(`
            <div class="text-center">
              <div class="text-3xl font-bold" style="color: var(--success);">${getTotalSets()}</div>
              <div class="text-sm mt-md" style="color: var(--text-muted);">Sets</div>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

function openFlashcards() {
  activeBottomTab = "subjects"; // sync bottom nav
  currentView = "subjects";
  renderApp();
}

function openTeacherQuiz() {
  currentView = "teacher";
  initTeacherView();
  renderApp();
}

function openStudentQuiz() {
  currentView = "student";
  renderApp();
}

// ============= PROFILE & CLASS HELPER FUNCTIONS =============

function handleProfilePictureUpload(file) {
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    toast('File size must be less than 5MB');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const pictureUrl = e.target.result;
    const profile = getStudentProfile();
    profile.profilePictureUrl = pictureUrl;
    saveStudentProfile(profile);
    renderApp();
    toast('✅ Profile picture uploaded');
  };
  reader.readAsDataURL(file);
}

function removeProfilePicture() {
  const profile = getStudentProfile();
  profile.profilePictureUrl = null;
  saveStudentProfile(profile);
  renderApp();
  toast('Profile picture removed');
}

async function connectGoogle() {
  const currentUser = getUser();
  
  if (!currentUser) {
    toast('❌ Please log in first');
    return;
  }
  
  // If user is already authenticated with Google, just show info
  if (currentUser.provider === 'google' && currentUser.googleId) {
    const profile = getStudentProfile();
    profile.googleId = currentUser.googleId;
    profile.googleEmail = currentUser.googleEmail || currentUser.email;
    profile.profilePictureUrl = currentUser.picture || profile.profilePictureUrl;
    saveStudentProfile(profile);
    renderApp();
    toast('✅ Google account already connected');
    return;
  }
  
  // Store current user ID to link after OAuth
  localStorage.setItem('pending_google_link_user', currentUser.id);
  
  // Redirect to Google OAuth
  const backendOrigin = 'https://ec-eclassroom-backend.espaderarios.workers.dev';
  window.location.href = backendOrigin + '/auth/google/start';
}

async function disconnectGoogle() {
  if (!confirm('Are you sure you want to disconnect your Google account? You can reconnect anytime.')) return;
  
  const profile = getStudentProfile();
  const currentUser = getUser();
  
  // Clear Google info from profile
  profile.googleId = null;
  profile.googleEmail = null;
  saveStudentProfile(profile);
  
  // If currently logged in with Google, convert to guest/local user
  if (currentUser && currentUser.provider === 'google') {
    const newLocalUser = {
      id: crypto.randomUUID(),
      name: profile.name || currentUser.name,
      email: profile.email || '',
      role: 'student',
      authenticated: false
    };
    setUser(newLocalUser);
    window.isAuthenticated = false;
    
    // Update profile with new local ID
    profile.id = newLocalUser.id;
    saveStudentProfile(profile);
  }
  
  renderApp();
  toast('✅ Google account disconnected. You can continue using local data.');
}

function saveEnhancedProfile() {
  const name = document.getElementById('profile-name')?.value?.trim();
  const email = document.getElementById('profile-email')?.value?.trim();
  const studentId = document.getElementById('profile-student-id')?.value?.trim();
  const school = document.getElementById('profile-school')?.value?.trim();
  const yearLevel = document.getElementById('profile-year-level')?.value?.trim();
  
  if (!name) {
    toast('❌ Name is required');
    return;
  }
  
  const profile = getStudentProfile();
  profile.name = name;
  profile.email = email;
  profile.id = studentId || profile.id || crypto.randomUUID();
  profile.school = school;
  profile.yearLevel = yearLevel;
  
  saveStudentProfile(profile);
  window.currentStudent = {
    name: profile.name,
    id: profile.id,
    email: profile.email
  };
  localStorage.setItem('currentStudent', JSON.stringify(window.currentStudent));
  
  // Keep profile tab active after saving so user sees saved data persist
  studentTab = 'profile';
  renderApp();
  toast('✅ Profile saved successfully');
}

function enrollInClass() {
  const classCode = document.getElementById('class-code-input')?.value?.trim()?.toUpperCase();
  
  if (!classCode) {
    toast('❌ Please enter a class code');
    return;
  }
  
  const result = enrollStudentInClass(classCode);
  
  if (result.success) {
    document.getElementById('class-code-input').value = '';
    renderApp();
    toast('✅ Successfully enrolled in class!');
  } else {
    toast('❌ ' + result.error);
  }
}

function unenrollFromClass(classId) {
  if (!confirm('Are you sure you want to unenroll from this class?')) return;
  
  const enrolledClasses = getStudentEnrolledClasses();
  const filtered = enrolledClasses.filter(e => e.classId !== classId);
  localStorage.setItem(STUDENT_CLASSES_KEY, JSON.stringify(filtered));
  
  renderApp();
  toast('Unenrolled from class');
}

function startClassQuiz(quizId) {
  const classQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  const quiz = classQuizzes.find(q => q.id === quizId);
  
  if (!quiz) {
    toast('Quiz not found');
    return;
  }
  
  // Check attempt limit
  const studentId = window.currentStudent?.id;
  const classId = quiz.classId;
  const attemptLimit = getQuizAttemptLimit(classId, quizId);
  const attempts = getStudentQuizAttempts(studentId, quizId);
  
  if (attempts.length >= attemptLimit) {
    toast('You have reached the maximum of ' + attemptLimit + ' attempt(s) for this quiz');
    return;
  }
  
  if (quiz.timeLimit) {
    window._quizTimeLimit = quiz.timeLimit * 60;
  }
  
  window._classQuizId = quizId;
  window._classQuiz = quiz;
  currentView = 'class-quiz';
  renderApp();
}

function createNewClass() {
  const name = document.getElementById('new-class-name')?.value?.trim();
  const subject = document.getElementById('new-class-subject')?.value?.trim();
  const grade = document.getElementById('new-class-grade')?.value?.trim();
  const description = document.getElementById('new-class-description')?.value?.trim();
  
  if (!name) {
    toast('❌ Class name is required');
    return;
  }
  
  const teacherId = window.currentTeacher?.id || 'teacher_' + localStorage.getItem('currentTeacherId');
  const classId = 'class_' + Date.now();
  const classCode = generateClassCode();
  
  const newClass = {
    id: classId,
    name: name,
    subject: subject || '',
    grade: grade || '',
    description: description || '',
    classCode: classCode,
    teacherId: teacherId,
    createdAt: new Date().toISOString()
  };
  
  saveClass(newClass);
  
  document.getElementById('new-class-name').value = '';
  document.getElementById('new-class-subject').value = '';
  document.getElementById('new-class-grade').value = '';
  document.getElementById('new-class-description').value = '';
  
  renderApp();
  toast('✅ Class created successfully!');
}

function generateClassCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const allClasses = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  if (allClasses.some(c => c.classCode === code)) {
    return generateClassCode();
  }
  
  return code;
}

function deleteTeacherClass(classId) {
  if (!confirm('Are you sure you want to delete this class? This action cannot be undone.')) return;
  
  const teacherId = window.currentTeacher?.id || 'teacher_' + localStorage.getItem('currentTeacherId');
  const classes = getTeacherClasses(teacherId);
  const filtered = classes.filter(c => c.id !== classId);
  
  localStorage.setItem(TEACHER_CLASSES_KEY, JSON.stringify(filtered));
  
  const allQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  const filteredQuizzes = allQuizzes.filter(q => q.classId !== classId);
  localStorage.setItem(CLASS_QUIZZES_KEY, JSON.stringify(filteredQuizzes));
  
  renderApp();
  toast('Class and associated quizzes deleted');
}

function openAddQuizToClassModal(classId) {
  // Get all quizzes from localStorage
  const quizzes = [];
  
  // Search through all localStorage keys for teacher quizzes
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === 'teacher-quizzes' || key.startsWith('teacher_quizzes_')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) {
          quizzes.push(...stored);
        }
      } catch (e) {
        console.error('Error parsing quiz key:', key, e);
      }
    }
  }
  
  if (quizzes.length === 0) {
    toast('❌ You need to create quizzes first in the Dashboard');
    return;
  }
  
  let html = '<div style="background: var(--surface); color: var(--on-surface); padding: 20px; border-radius: 8px;">';
  html += '<h3 style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">Add Quiz to Class</h3>';
  html += '<p style="font-size: 14px; margin-bottom: 15px; color: var(--on-surface-variant);">Select a quiz to add to this class:</p>';
  html += '<div style="max-height: 400px; overflow-y: auto; space-y: 2;">';
  
  quizzes.forEach(quiz => {
    html += `
      <div style="background: var(--input-bg); padding: 10px; border-radius: 6px; margin-bottom: 10px; cursor: pointer;" onclick="assignQuizToClass('${classId}', '${quiz.quizId || quiz.id}'); toast('Quiz added to class')">
        <p style="font-weight: bold;">${quiz.title || quiz.quizName || 'Untitled Quiz'}</p>
        <p style="font-size: 12px; color: var(--on-surface-variant);">${quiz.questions?.length || 0} questions</p>
      </div>
    `;
  });
  
  html += '</div>';
  html += `<button style="width: 100%; margin-top: 15px; padding: 10px; background: var(--surface-variant); color: var(--on-surface); border-radius: 6px; cursor: pointer; font-weight: bold;" onclick="document.querySelector('[data-modal-overlay]').remove(); teacherTab='classes'; renderApp()">Close</button>`;
  html += '</div>';
  
  const overlay = document.createElement('div');
  overlay.setAttribute('data-modal-overlay', 'true');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  overlay.innerHTML = `<div style="width: 90%; max-width: 500px;">${html}</div>`;
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.body.appendChild(overlay);
}

function assignQuizToClass(classId, quizId) {
  // Find quiz from all storage locations
  let quiz = null;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === 'teacher-quizzes' || key.startsWith('teacher_quizzes_')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) {
          quiz = stored.find(q => q.quizId === quizId || q.id === quizId);
          if (quiz) break;
        }
      } catch (e) {
        console.error('Error parsing quiz key:', key, e);
      }
    }
  }
  
  if (!quiz) {
    toast('Quiz not found');
    return;
  }
  
  const classQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  
  if (classQuizzes.some(cq => cq.classId === classId && cq.id === quizId)) {
    toast('This quiz is already in the class');
    return;
  }
  
  // If quiz doesn't have questions locally, try to fetch from Cloudflare
  let questions = quiz.questions || [];
  
  if (!questions || questions.length === 0) {
    // Try to fetch from Cloudflare (async, but we'll save what we have)
    toast('⏳ Fetching quiz details...');
    
    // Fetch from Cloudflare in background
    (async () => {
      try {
        const cfData = await getQuizFromCloudflare(quizId);
        if (cfData && cfData.questions) {
          questions = cfData.questions;
          
          // Update the stored quiz with questions
          const key = 'teacher_quizzes_' + getUser().id;
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = stored.findIndex(q => q.quizId === quizId);
          if (idx >= 0) {
            stored[idx].questions = questions;
            localStorage.setItem(key, JSON.stringify(stored));
          }
          
          // Update class quiz with questions
          const classQuizzes2 = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
          const cqIdx = classQuizzes2.findIndex(cq => cq.classId === classId && cq.id === quizId);
          if (cqIdx >= 0) {
            classQuizzes2[cqIdx].questions = questions;
            localStorage.setItem(CLASS_QUIZZES_KEY, JSON.stringify(classQuizzes2));
          }
          
          toast('✅ Quiz added with ' + questions.length + ' questions!');
          renderApp();
        }
      } catch (err) {
        console.log('Could not fetch from Cloudflare, using local data');
      }
    })();
  }
  
  const classQuiz = {
    id: quizId,
    classId: classId,
    title: quiz.quizName || quiz.title || 'Untitled Quiz',
    questions: questions,
    timeLimit: null,
    createdAt: new Date().toISOString()
  };
  
  classQuizzes.push(classQuiz);
  localStorage.setItem(CLASS_QUIZZES_KEY, JSON.stringify(classQuizzes));
  
  teacherTab = 'classes';
  renderApp();
}

function removeQuizFromClass(classId, quizId) {
  if (!confirm('Remove this quiz from the class?')) return;
  
  const classQuizzes = JSON.parse(localStorage.getItem(CLASS_QUIZZES_KEY) || "[]");
  const filtered = classQuizzes.filter(q => !(q.classId === classId && q.id === quizId));
  localStorage.setItem(CLASS_QUIZZES_KEY, JSON.stringify(filtered));
  
  renderApp();
  toast('Quiz removed from class');
}

function renderStudentView() {
  return `
    <div class="w-full min-h-screen p-lg" style="background-color: var(--background);">
      <div class="container max-w-4xl mx-auto">
        <!-- Header with Back Button -->
        <div class="flex-between mb-2xl gap-lg">
          <h1 class="text-3xl font-bold" style="color: var(--text);">My Dashboard</h1>
          <button onclick="backStudentBtn()" class="btn-secondary">
            ← Back Home
          </button>
        </div>

        <!-- Modern Tab Navigation -->
        <div class="flex gap-md mb-2xl overflow-x-auto pb-md">
          <button
            class="px-lg py-md rounded-lg font-medium whitespace-nowrap transition-all"
            style="background-color: ${studentTab === 'main' ? 'var(--primary)' : 'var(--surface)'}; color: ${studentTab === 'main' ? 'white' : 'var(--text)'}; border: 2px solid ${studentTab === 'main' ? 'var(--primary)' : 'var(--border)'};"
            onclick="studentTab='main'; renderApp()"
          >
            📝 Quizzes
          </button>

          <button
            class="px-lg py-md rounded-lg font-medium whitespace-nowrap transition-all"
            style="background-color: ${studentTab === 'classes' ? 'var(--primary)' : 'var(--surface)'}; color: ${studentTab === 'classes' ? 'white' : 'var(--text)'}; border: 2px solid ${studentTab === 'classes' ? 'var(--primary)' : 'var(--border)'};"
            onclick="studentTab='classes'; renderApp()"
          >
            📚 Classes
          </button>

          <button
            class="px-lg py-md rounded-lg font-medium whitespace-nowrap transition-all"
            style="background-color: ${studentTab === 'profile' ? 'var(--primary)' : 'var(--surface)'}; color: ${studentTab === 'profile' ? 'white' : 'var(--text)'}; border: 2px solid ${studentTab === 'profile' ? 'var(--primary)' : 'var(--border)'};"
            onclick="studentTab='profile'; renderApp()"
          >
            👤 Profile
          </button>
        </div>

        <!-- Tab Content -->
        <div class="w-full animate-fadeIn">
          ${studentTab === 'main'
            ? renderJoinQuiz()
            : studentTab === 'classes'
            ? renderStudentClasses()
            : renderStudentProfile()}
        </div>
      </div>
    </div>
  `;
}

function renderStudentProfile() {
  const profile = getStudentProfile();
  const currentUser = getUser();
  const isGoogleConnected = profile.googleId || (currentUser && currentUser.provider === 'google' && currentUser.googleId);

  return `
    <div class="w-full max-w-3xl mx-auto">
      <!-- Profile Header Card -->
      ${createCard(`
        <div class="flex flex-col md:flex-row gap-xl items-start md:items-center">
          <!-- Profile Picture -->
          <div class="flex flex-col items-center gap-lg">
            <div class="relative w-32 h-32 rounded-full overflow-hidden border-4" style="border-color: var(--primary); background: var(--surface);">
              ${profile.profilePictureUrl ? `
                <img src="${profile.profilePictureUrl}" alt="Profile" class="w-full h-full object-cover">
              ` : `
                <div class="w-full h-full flex items-center justify-center text-5xl">
                  👤
                </div>
              `}
            </div>
            <div class="flex gap-md">
              <label class="btn-primary text-sm cursor-pointer">
                📤 Upload
                <input type="file" id="profile-picture-input" accept="image/*" style="display: none;" onchange="handleProfilePictureUpload(this.files[0])">
              </label>
              ${profile.profilePictureUrl ? `
                <button class="btn-danger text-sm" onclick="removeProfilePicture()">🗑 Remove</button>
              ` : ''}
            </div>
          </div>

          <!-- Profile Info -->
          <div class="flex-1 w-full">
            <h2 class="text-3xl font-bold mb-lg" style="color: var(--text);">${profile.name || 'Add Your Name'}</h2>
            
            <!-- Google Status -->
            <div class="p-lg rounded-lg mb-lg" style="background-color: ${isGoogleConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${isGoogleConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'};">
              <div class="flex-between gap-md">
                <div>
                  <div class="font-semibold flex items-center gap-sm">
                    ${isGoogleConnected ? '✅' : '🔗'} Google Account
                  </div>
                  <div class="text-sm mt-sm" style="color: var(--text-muted);">
                    ${isGoogleConnected ? `Connected: ${profile.googleEmail || currentUser.email || 'N/A'}` : 'Link your Google account for cloud sync'}
                  </div>
                </div>
                <button class="btn-${isGoogleConnected ? 'danger' : 'primary'} text-sm" onclick="${isGoogleConnected ? 'disconnectGoogle()' : 'connectGoogle()'}">
                  ${isGoogleConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      `, { className: 'mb-xl' })}

      <!-- Profile Form Card -->
      ${createCard(`
        <div class="space-y-lg">
          <!-- Basic Info Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div class="form-group">
              <label for="profile-name" class="block font-semibold mb-sm">📝 Full Name</label>
              <input id="profile-name"
                     class="w-full p-md border-2 rounded-lg transition-colors"
                     style="border-color: var(--border); background: var(--card-bg); color: var(--text);"
                     placeholder="Enter your full name"
                     value="${profile.name || ''}">
            </div>

            <div class="form-group">
              <label for="profile-email" class="block font-semibold mb-sm">✉️ Gmail</label>
              <input id="profile-email"
                     type="email"
                     class="w-full p-md border-2 rounded-lg transition-colors"
                     style="border-color: var(--border); background: var(--card-bg); color: var(--text);"
                     placeholder="your.email@gmail.com"
                     value="${profile.email || profile.googleEmail || ''}">
            </div>
          </div>

          <!-- Student ID & School Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div class="form-group">
              <label for="profile-student-id" class="block font-semibold mb-sm">🆔 Student ID</label>
              <input id="profile-student-id"
                     class="w-full p-md border-2 rounded-lg transition-colors"
                     style="border-color: var(--border); background: var(--card-bg); color: var(--text);"
                     placeholder="Enter your student ID"
                     value="${profile.id || ''}">
            </div>

            <div class="form-group">
              <label for="profile-school" class="block font-semibold mb-sm">🏫 School</label>
              <input id="profile-school"
                     class="w-full p-md border-2 rounded-lg transition-colors"
                     style="border-color: var(--border); background: var(--card-bg); color: var(--text);"
                     placeholder="Enter your school name"
                     value="${profile.school || ''}">
            </div>
          </div>

          <!-- Year Level -->
          <div class="form-group">
            <label for="profile-year-level" class="block font-semibold mb-sm">📊 Year Level</label>
            <select id="profile-year-level"
                    class="w-full p-md border-2 rounded-lg transition-colors"
                    style="border-color: var(--border); background: var(--card-bg); color: var(--text);">
              <option value="">Select Year Level</option>
              <optgroup label="High School">
                <option value="Grade 7" ${profile.yearLevel === 'Grade 7' ? 'selected' : ''}>Grade 7</option>
                <option value="Grade 8" ${profile.yearLevel === 'Grade 8' ? 'selected' : ''}>Grade 8</option>
                <option value="Grade 9" ${profile.yearLevel === 'Grade 9' ? 'selected' : ''}>Grade 9</option>
                <option value="Grade 10" ${profile.yearLevel === 'Grade 10' ? 'selected' : ''}>Grade 10</option>
                <option value="Grade 11" ${profile.yearLevel === 'Grade 11' ? 'selected' : ''}>Grade 11</option>
                <option value="Grade 12" ${profile.yearLevel === 'Grade 12' ? 'selected' : ''}>Grade 12</option>
              </optgroup>
              <optgroup label="College">
                <option value="1st Year" ${profile.yearLevel === '1st Year' ? 'selected' : ''}>1st Year</option>
                <option value="2nd Year" ${profile.yearLevel === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                <option value="3rd Year" ${profile.yearLevel === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                <option value="4th Year" ${profile.yearLevel === '4th Year' ? 'selected' : ''}>4th Year</option>
              </optgroup>
            </select>
          </div>
        </div>
      `, { 
        className: 'mb-xl',
        footer: `
          <div class="flex gap-lg justify-end">
            <button class="btn-secondary" onclick="studentTab='main'; renderApp()">Cancel</button>
            <button class="btn-primary" onclick="saveEnhancedProfile()">💾 Save Changes</button>
          </div>
        `
      })}
    </div>
  `;
}




function renderJoinQuiz() {
  const student = window.currentStudent || { name: "", id: "" };

  return `
    <div class="w-full max-w-2xl mx-auto">
      <!-- Welcome Card -->
      ${student.name && student.id ? `
        ${createCard(`
          <div class="flex items-center gap-lg">
            <div class="text-3xl">✅</div>
            <div>
              <div class="text-sm" style="color: var(--text-muted);">Logged in as</div>
              <div class="text-xl font-semibold">${student.name}</div>
              <div class="text-sm" style="color: var(--text-muted);">ID: ${student.id}</div>
            </div>
          </div>
        `, { className: 'mb-xl' })}
      ` : ''}

      <!-- Join Quiz Card -->
      ${createCard(`
        <div class="text-center mb-lg">
          <div class="text-5xl mb-lg">🧠</div>
          <h2 class="text-2xl font-bold">Take a Quiz</h2>
          <p class="text-muted mt-sm">Enter the quiz code to get started</p>
        </div>

        <div class="space-y-lg">
          <div class="form-group">
            <label for="student-quiz-id" class="block font-semibold mb-sm">📋 Quiz Code</label>
            <input
              id="student-quiz-id"
              placeholder="Enter quiz code"
              class="w-full p-lg border-2 rounded-lg transition-colors"
              style="border-color: var(--border); background: var(--card-bg); color: var(--text); font-size: 16px;"
            />
          </div>

          <button
            onclick="loadStudentQuiz()"
            class="btn-primary w-full py-lg text-lg font-semibold"
          >
            🚀 Start Quiz
          </button>

          <button 
            onclick="currentView='student-score-history'; renderApp();"
            class="btn-secondary w-full py-lg text-lg font-semibold"
          >
            📊 View Score History
          </button>
        </div>

        <div id="student-error" class="mt-lg p-md rounded-lg hidden" style="background: rgba(239, 68, 68, 0.1); color: var(--error);"></div>
      `, { className: 'mb-xl', elevated: true })}
    </div>
  `;
}

function saveStudentProfile(name, id) {
  window.currentStudent = { name, id };
  localStorage.setItem("currentStudent", JSON.stringify(window.currentStudent));
  studentTab = "profile";
  renderApp();
}

function hasValidStudent() {
  return (
    window.currentStudent &&
    window.currentStudent.name &&
    window.currentStudent.id
  );
}


function clearStudentInfo() {
  if (!confirm("Clear student information?")) return;
  window.currentStudent = null;
  localStorage.removeItem("currentStudent");
  studentTab = "main";
  renderApp();
}

function openStudentInfoModal() {
  if (!window.currentStudent) return;

  document.getElementById("student-name-input").value = window.currentStudent.name || "";
  document.getElementById("student-id-input").value = window.currentStudent.id || "";

  document.getElementById("student-info-modal").classList.remove("hidden");
}

function closeStudentInfoModal() {
  document.getElementById("student-info-modal").classList.add("hidden");
}

function submitStudentInfo() {
  const name = document.getElementById("student-name").value.trim();
  const id = document.getElementById("student-id").value.trim();

  if (!name || !id) {
    toast("Please enter both name and ID");
    return;
  }

  window.currentStudent = { name, id };
  sessionStorage.setItem("currentStudent", JSON.stringify(window.currentStudent));

  closeStudentInfoModal();

  // If a quiz was pending, resume it
  if (pendingQuizId) {
    loadStudentQuiz(pendingQuizId);
    pendingQuizId = null;
  }
}




function confirmStudentInfo() {
  const name = document.getElementById("student-name-input").value.trim();
  const id = document.getElementById("student-id-input").value.trim();

  if (!name || !id) {
    toast("Please enter your name and student ID");
    return;
  }

  window.currentStudent = { name, id };
  localStorage.setItem("currentStudent", JSON.stringify(window.currentStudent));

  closeStudentInfoModal();

  if (pendingQuizId) {
    const quizId = pendingQuizId;
    pendingQuizId = null;
    loadStudentQuiz(); 
  }
}

function startStudentQuiz(quizId) {
  if (!quizId) {
    toast("Cannot start quiz: quizId missing!");
    return;
  }

  currentQuizId = quizId;
  quizIndex = 0;
  quizScore = 0;
  currentView = "teacher-quiz";
  renderApp();
}


function backStudentBtn() {
  currentView = 'home'; 
  renderApp();         
}

function renderTeacherView() {
  return `
   <div class="flex flex-col items-center mt-6 space-y-4 w-full" 
     style="background-image: var(--background-image); background-size: cover; background-position: center;">
  <div class="w-full flex justify-start px-4">
    <button
      id="backBtnTeacher"
      class="px-4 py-2 rounded-lg"
      style="background:var(--card-bg);"
    >
      ← Back
    </button>
  </div>
      <!-- Teacher Tabs -->
      <div class="flex gap-2">
        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200"
          style="
            background-color: ${teacherTab === 'main' ? 'var(--primary)' : 'var(--surface)'}; 
            color: ${teacherTab === 'main' ? 'var(--on-primary)' : 'var(--on-surface)'};"
          onclick="teacherTab='main'; renderApp()"
        >
          Dashboard
        </button>

        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200"
          style="
            background-color: ${teacherTab === 'classes' ? 'var(--primary)' : 'var(--surface)'}; 
            color: ${teacherTab === 'classes' ? 'var(--on-primary)' : 'var(--on-surface)'};"
          onclick="teacherTab='classes'; renderApp()"
        >
          Classes
        </button>

        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200"
          style="
            background-color: ${teacherTab === 'profile' ? 'var(--primary)' : 'var(--surface)'}; 
            color: ${teacherTab === 'profile' ? 'var(--on-primary)' : 'var(--on-surface)'};"
          onclick="teacherTab='profile'; renderApp()"
        >
          Profile
        </button>
      </div>

      <!-- Content -->
      <div class="mt-4 w-full max-w-4xl">
        ${teacherTab === 'main'
          ? renderTeacherQuizList()
          : teacherTab === 'classes'
          ? renderTeacherClasses()
          : renderTeacherProfile()}
      </div>

    </div>
  `;
}


function renderTeacherProfile() {
  const t = getTeacherProfile();
  const currentUser = getUser();
  const isGoogleConnected = t.googleId || (currentUser && currentUser.provider === 'google' && currentUser.googleId);

  return `
    <div class="p-6 rounded-xl shadow space-y-4" style="background-color: var(--card-bg); color: var(--on-surface); box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
      <h2 class="text-2xl font-bold text-center">Teacher Profile</h2>

      <!-- Google Account Connection Status -->
      <div class="p-4 rounded-lg" style="background-color: ${isGoogleConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 146, 60, 0.1)'}; border: 1px solid ${isGoogleConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 146, 60, 0.3)'}; margin-bottom: 20px;">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-semibold flex items-center gap-2">
              ${isGoogleConnected ? '✅' : '🔗'} Google Account
            </div>
            ${isGoogleConnected ? `
              <div class="text-sm mt-1" style="opacity: 0.8;">
                Connected: ${t.googleEmail || currentUser.email || 'N/A'}
              </div>
            ` : `
              <div class="text-sm mt-1" style="opacity: 0.8;">
                Link your Google account for cloud sync
              </div>
            `}
          </div>
          <button 
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all"
            style="background: ${isGoogleConnected ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, #4285F4 0%, #1E88E5 100%)'}; color: ${isGoogleConnected ? '#dc2626' : 'white'};"
            onclick="${isGoogleConnected ? 'disconnectGoogle()' : 'connectGoogle()'}">
            ${isGoogleConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      <div>
        <label for="teacher-name" class="block text-sm font-semibold mb-1">Name</label>
        <input id="teacher-name"
          class="w-full p-3 border rounded"
          style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
          placeholder="Enter your full name"
          value="${t.name || ""}">
      </div>

      <div>
        <label for="teacher-email" class="block text-sm font-semibold mb-1">Gmail</label>
        <input id="teacher-email"
          type="email"
          class="w-full p-3 border rounded"
          style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
          placeholder="your.email@gmail.com"
          value="${t.email || t.googleEmail || ""}">
      </div>

      <button class="mt-4 w-full px-6 py-3 rounded font-semibold" 
        style="background-color: var(--primary); color: var(--on-primary, var(--text)); border-radius: var(--radius);"
        onclick="
          saveTeacherProfile({
            name: document.getElementById('teacher-name').value.trim(),
            email: document.getElementById('teacher-email').value.trim()
          })
        ">
        💾 Save Profile
      </button>
    </div>
  `;
}


function getTeacherProfile() {
  const user = getUser();
  const profile = JSON.parse(localStorage.getItem("teacherProfile") || "{}");
  
  // If user is logged in with Google, use Google data as primary source
  if (user && user.provider === 'google') {
    return {
      ...profile,
      name: user.name || profile.name || "",
      email: user.email || profile.email || "",
      googleId: user.googleId || profile.googleId,
      googleEmail: user.googleEmail || user.email || profile.googleEmail,
      profilePictureUrl: user.picture || profile.profilePictureUrl,
      id: profile.id || user.id
    };
  }
  
  return profile;
}

function saveTeacherProfile(profile) {
  localStorage.setItem("teacherProfile", JSON.stringify(profile));
  // Sync to backend asynchronously
  syncTeacherProfileToBackend(profile);
  teacherTab = "profile";
  renderApp();
}

// ============= TEACHER CLASSES VIEW =============
function renderTeacherClasses() {
  const teacherId = window.currentTeacher?.id || 'teacher_' + localStorage.getItem('currentTeacherId');
  const classes = getTeacherClasses(teacherId);

  return `
    <div class="w-full p-6 space-y-6" style="background: var(--card-bg); color: var(--text);">
      <div class="max-w-4xl mx-auto fade-in">
        
        <h2 class="text-2xl font-bold mb-6">📚 My Classes</h2>
        
        <!-- Create New Class Form -->
        <div class="p-6 rounded-xl shadow space-y-4 mb-6" style="background: var(--card-bg);">
          <h3 class="text-xl font-semibold">Create New Class</h3>
          
          <div>
            <label for="new-class-name" class="block text-sm font-semibold mb-1">Class Name *</label>
            <input id="new-class-name" 
              class="w-full p-3 border rounded"
              style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
              placeholder="e.g., Physics 101">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="new-class-subject" class="block text-sm font-semibold mb-1">Subject</label>
              <input id="new-class-subject" 
                class="w-full p-3 border rounded"
                style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
                placeholder="e.g., Physics">
            </div>
            
            <div>
              <label for="new-class-grade" class="block text-sm font-semibold mb-1">Grade Level</label>
              <input id="new-class-grade" 
                class="w-full p-3 border rounded"
                style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
                placeholder="e.g., 10th Grade">
            </div>
          </div>
          
          <div>
            <label for="new-class-description" class="block text-sm font-semibold mb-1">Description</label>
            <textarea id="new-class-description" 
              class="w-full p-3 border rounded"
              style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
              rows="3"
              placeholder="Brief description of the class"></textarea>
          </div>
          
          <button class="w-full py-3 rounded-lg font-semibold"
            style="background: var(--primary); color: var(--on-primary, var(--text));"
            onclick="createNewClass()">
            ➕ Create Class
          </button>
        </div>
        
        <!-- Class List -->
        <div class="space-y-4">
          ${classes.length === 0 ? `
            <div class="p-6 rounded-xl text-center" style="background: var(--card-bg); color: var(--on-surface);">
              <p class="text-lg">No classes created yet</p>
              <p class="text-sm mt-2" style="color: var(--on-surface-variant);">Create your first class above!</p>
            </div>
          ` : classes.map(cls => {
            const quizzes = getClassQuizzes(cls.id);
            return `
              <div class="p-6 rounded-xl shadow space-y-4" style="background: var(--card-bg); box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="text-xl font-bold">${cls.name}</h3>
                    ${cls.subject ? `<p class="text-sm" style="color: var(--on-surface-variant);">📖 ${cls.subject}</p>` : ''}
                    ${cls.grade ? `<p class="text-sm" style="color: var(--on-surface-variant);">🎓 ${cls.grade}</p>` : ''}
                    ${cls.description ? `<p class="text-sm mt-2">${cls.description}</p>` : ''}
                  </div>
                  
                  <button class="px-4 py-2 rounded-lg"
                    style="background: rgba(239,68,68,.15); color:#dc2626;"
                    onclick="deleteTeacherClass('${cls.id}')">
                    🗑 Delete
                  </button>
                </div>
                
                <div class="p-4 rounded-lg" style="background: var(--primary); color: var(--on-primary, var(--text));">
                  <p class="font-semibold">Class Code:</p>
                  <div class="flex items-center gap-3 mt-2">
                    <code class="text-2xl font-bold tracking-wider">${cls.classCode}</code>
                    <button class="px-3 py-1 rounded-lg" 
                      style="background: rgba(255,255,255,0.2);"
                      onclick="navigator.clipboard.writeText('${cls.classCode}'); toast('✅ Class code copied!')">
                      📋 Copy
                    </button>
                  </div>
                  <p class="text-sm mt-1" style="opacity: 0.9;">Share this code with students to join</p>
                </div>
                
                <!-- Quizzes Section -->
                <div>
                  <div class="flex justify-between items-center mb-3">
                    <h4 class="font-semibold">Assigned Quizzes (${quizzes.length})</h4>
                    <button class="px-4 py-2 rounded-lg"
                      style="background: var(--primary); color: var(--on-primary, var(--text));"
                      onclick="openAddQuizToClassModal('${cls.id}')">
                      ➕ Add Quiz
                    </button>
                  </div>
                  
                  ${quizzes.length === 0 ? `
                    <p class="text-sm" style="color: var(--on-surface-variant);">No quizzes assigned yet</p>
                  ` : `
                    <div class="space-y-2">
                      ${quizzes.map(quiz => `
                        <div class="p-3 rounded-lg flex justify-between items-center"
                          style="background: var(--input-bg);">
                          <div>
                            <p class="font-semibold">${quiz.title || 'Untitled Quiz'}</p>
                            <p class="text-xs" style="color: var(--on-surface-variant);">
                              ${quiz.questions?.length || 0} questions
                              ${quiz.timeLimit ? ` • ${quiz.timeLimit} min` : ''}
                            </p>
                          </div>
                          <button class="px-3 py-1 rounded-lg text-sm"
                            style="background: rgba(239,68,68,.15); color:#dc2626;"
                            onclick="removeQuizFromClass('${cls.id}', '${quiz.id}')">
                            Remove
                          </button>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============= STUDENT CLASSES VIEW =============
function renderStudentClasses() {
  const enrolledClasses = getStudentEnrolledClasses();
  const allClasses = JSON.parse(localStorage.getItem(TEACHER_CLASSES_KEY) || "[]");
  
  return `
    <div class="w-full p-6 space-y-6" style="background: var(--card-bg); color: var(--text);">
      <div class="max-w-4xl mx-auto fade-in">
        
        <h2 class="text-2xl font-bold mb-6">📚 My Classes</h2>
        
        <!-- Join Class Form -->
        <div class="p-6 rounded-xl shadow space-y-4 mb-6" style="background: var(--card-bg);">
          <h3 class="text-xl font-semibold">Join a Class</h3>
          <p class="text-sm" style="color: var(--on-surface-variant);">
            Enter the class code provided by your teacher
          </p>
          
          <div class="flex gap-3">
            <input id="class-code-input" 
              class="flex-1 p-3 border rounded-lg"
              style="border-color: var(--border); background: var(--input-bg); color: var(--on-surface);"
              placeholder="Enter class code (e.g., ABC123)"
              maxlength="6">
            
            <button class="px-6 py-3 rounded-lg font-semibold"
              style="background: var(--primary); color: var(--on-primary, var(--text));"
              onclick="enrollInClass()">
              Join Class
            </button>
          </div>
        </div>
        
        <!-- Enrolled Classes List -->
        <div class="space-y-4">
          ${enrolledClasses.length === 0 ? `
            <div class="p-6 rounded-xl text-center" style="background: var(--surface); color: var(--on-surface);">
              <p class="text-lg">Not enrolled in any classes yet</p>
              <p class="text-sm mt-2" style="color: var(--on-surface-variant);">Join a class using the code above!</p>
            </div>
          ` : enrolledClasses.map(enrollment => {
            const classData = allClasses.find(c => c.id === enrollment.classId);
            
            if (!classData) {
              return '';
            }
            
            const quizzes = getClassQuizzes(classData.id);
            const studentId = window.currentStudent?.id;
            
            return `
              <div class="p-6 rounded-xl shadow space-y-4" style="background: var(--card-bg); box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="text-xl font-bold">${classData.name}</h3>
                    ${classData.subject ? `<p class="text-sm" style="color: var(--on-surface-variant);">📖 ${classData.subject}</p>` : ''}
                    ${classData.grade ? `<p class="text-sm" style="color: var(--on-surface-variant);">🎓 ${classData.grade}</p>` : ''}
                    ${classData.description ? `<p class="text-sm mt-2">${classData.description}</p>` : ''}
                  </div>
                  
                  <button class="px-4 py-2 rounded-lg text-sm"
                    style="background: rgba(239,68,68,.15); color:#dc2626;"
                    onclick="unenrollFromClass('${classData.id}')">
                    Leave Class
                  </button>
                </div>
                
                <!-- Available Quizzes -->
                <div>
                  <h4 class="font-semibold mb-3">Available Quizzes (${quizzes.length})</h4>
                  
                  ${quizzes.length === 0 ? `
                    <p class="text-sm" style="color: var(--on-surface-variant);">No quizzes available yet</p>
                  ` : `
                    <div class="space-y-2">
                      ${quizzes.map(quiz => {
                        const attempts = getStudentQuizAttempts(studentId, quiz.id);
                        const attemptLimit = getQuizAttemptLimit(classData.id, quiz.id);
                        const canTakeQuiz = attempts.length < attemptLimit;
                        const bestScore = attempts.length > 0 
                          ? Math.max(
                              ...attempts
                                .map(a => {
                                  const total = a.totalQuestions || a.total || 0;
                                  const score = a.score || 0;
                                  return total > 0 ? (score / total) * 100 : Number.NEGATIVE_INFINITY;
                                })
                                .filter(v => Number.isFinite(v))
                            )
                          : null;
                        
                        return `
                          <div class="p-4 rounded-lg"
                            style="background: var(--input-bg);">
                            <div class="flex justify-between items-center">
                              <div class="flex-1">
                                <p class="font-semibold text-lg">${quiz.title || 'Untitled Quiz'}</p>
                                <p class="text-sm" style="color: var(--on-surface-variant);">
                                  ${quiz.questions?.length || 0} questions
                                  ${quiz.timeLimit ? ` • ${quiz.timeLimit} min` : ''}
                                </p>
                                <p class="text-xs mt-1" style="color: var(--on-surface-variant);">
                                  Attempts: ${attempts.length}/${attemptLimit}
                                  ${bestScore !== null ? ` • Best Score: ${bestScore.toFixed(0)}%` : ''}
                                </p>
                              </div>
                              
                              ${canTakeQuiz ? `
                                <button class="px-5 py-3 rounded-lg font-semibold"
                                  style="background: var(--primary); color: var(--on-primary, var(--text));"
                                  onclick="startClassQuiz('${quiz.id}')">
                                  Start Quiz
                                </button>
                              ` : `
                                <div class="px-5 py-3 rounded-lg text-sm font-semibold"
                                  style="background: rgba(239,68,68,.15); color:#dc2626;">
                                  Max Attempts Reached
                                </div>
                              `}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}


function renderTeacherQuizList() {
  // Note: This function itself is sync but calls async operation
  // The quizzes will be loaded from localStorage (already synced)
  const user = getUser();
  if (!user) return '<p style="color: var(--secondary-text);">Please log in to view quizzes.</p>';
  
  const key = `teacher_quizzes_${user.id}`;
  let teacherQuizzes = JSON.parse(localStorage.getItem(key) || "[]");
  
  // Deduplicate on render as well
  const seen = new Set();
  teacherQuizzes = teacherQuizzes.filter(q => {
    const id = q.id || q.quizId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const quizListHTML = teacherQuizzes.length
    ? teacherQuizzes.map(q => {
        const quizId = q.quizId || q.id;
        return `
        <div class="p-4 rounded-xl flex justify-between items-center" style="background: var(--card-bg);">
          <div>
            <div style="font-weight:600; color: var(--text);">${q.title}</div>
            <code style="font-size:12px; opacity:.7; color: var(--secondary-text);">${quizId}</code>
          </div>
<div class="flex flex-wrap gap-2">
  <button 
    onclick="navigator.clipboard.writeText('${quizId}')" 
    class="px-3 py-1 rounded-full text-sm"
    style="background: var(--primary); color: var(--on-primary, var(--text)); flex-shrink: 1;"
  >
    Copy
  </button>

  <button 
    onclick="editTeacherQuiz('${quizId}')" 
    class="px-3 py-1 rounded-full text-sm"
    style="background: rgba(0,0,0,.08); flex-shrink: 1;"
  >
    Edit
  </button>

  <button 
    onclick="deleteTeacherQuiz('${quizId}')" 
    class="px-3 py-1 rounded-full text-sm"
    style="background: rgba(239,68,68,.15); color:#dc2626; flex-shrink: 1;"
  >
    Delete
  </button>
</div>

        </div>
      `;
      }).join("")
    : `<p style="color: var(--secondary-text);">No quizzes created yet.</p>`;

  const renderQuestionInputs = () => teacherQuestions.map((q, i) => `
    <div class="p-4 rounded-xl" style="background: var(--card-bg);">
      <input
        placeholder="Question"
        class="w-full mb-2 px-3 py-2 rounded-lg"
        style="background: var(--card-bg); color: var(--text); border: 1px solid var(--primary); border-radius: var(--radius);"
        value="${q.question}"
        oninput="updateTeacherQuestion(${i}, 'question', this.value)"
      />
      ${q.options.map((opt, j) => `
        <div class="flex items-center mb-2">
          <span style="width:20px; font-weight:600; color: var(--text);">${String.fromCharCode(65+j)}.</span>
          <input
            placeholder="Option ${j + 1}"
            class="w-full px-3 py-2 rounded-lg"
            style="background: var(--card-bg); color: var(--text); border: 1px solid var(--primary); border-radius: var(--radius);"
            value="${opt}"
            oninput="updateTeacherOption(${i}, ${j}, this.value)"
          />
        </div>
      `).join("")}
      <input
        placeholder="Correct answer (letter, e.g., A)"
        class="w-full px-3 py-2 rounded-lg"
        style="background: var(--card-bg); color: var(--text); border: 1px solid var(--primary); border-radius: var(--radius);"
        value="${q.correct}"
        oninput="updateTeacherQuestion(${i}, 'correct', this.value.toUpperCase())"
      />
    </div>
  `).join("");

  const renderPreview = () => teacherQuestions.length ? teacherQuestions.map((q, i) => `
    <div class="p-3 mb-3 rounded-lg" style="background: var(--card-bg);">
      <strong style="color: var(--text);">Q${i + 1}: ${q.question}</strong>
      <ul style="margin-top:4px; padding-left:18px; color: var(--text);">
        ${q.options.map((opt, j) => `<li>${String.fromCharCode(65 + j)}. ${opt}</li>`).join("")}
      </ul>
      <p style="color: var(--primary); font-size:0.9em;">Answer: ${q.correct}</p>
    </div>
  `).join("") : `<p style="color: var(--secondary-text);">No questions to preview.</p>`;

  return `
    <div class="w-full h-full overflow-auto p-6" style="background: var(--background); font-family: var(--font-family); font-size: var(--font-size); line-height: var(--line-height);">
      <div class="max-w-2xl mx-auto fade-in">


        <h3 style="font-size:calc(var(--font-size) * 1.2); margin-bottom:12px; color: var(--text);">📋 Your Quizzes</h3>
        ${quizListHTML}
        <hr style="margin:24px 0; opacity:.2;" />

        <button onclick="showTeacherScoresView()"
                class="w-full py-3 rounded-xl font-semibold"
                style="background: var(--primary); color: var(--text); box-shadow:0 6px 18px rgba(0,0,0,.1);">
          📊 View Student Scores
        </button>

        <h2 style="font-size:calc(var(--font-size) * 1.8); margin:8px; color: var(--text);">👩‍🏫 Create Quiz</h2>
        <p style="color: var(--secondary-text); margin-bottom:24px;">Build a quiz and share it</p>

        <input
          id="quiz-title"
          placeholder="Quiz title"
          value="${window._teacherTitleDraft || ""}"
          class="w-full mb-4 px-4 py-3 rounded-xl"
          style="background: var(--card-bg); color: var(--text); border-radius: var(--radius); border: 1px solid var(--primary);"
          oninput="updateTeacherTitle(this.value)"
        />

        <div class="flex flex-col gap-4 mb-4">${renderQuestionInputs()}</div>

        <button onclick="addTeacherQuestion()"
                class="w-full py-3 rounded-xl font-semibold"
                style="background: var(--card-bg); color: var(--text); border:1px solid var(--primary);">
          ➕ Add Question
        </button>
        <button onclick="submitTeacherQuiz()"
                class="w-full py-4 rounded-xl font-semibold mt-6"
                style="background: var(--primary); color:white; box-shadow:0 10px 30px rgba(37,99,235,.35);">
          🚀 Publish Quiz
        </button>

        <div id="teacher-result" class="mt-6 text-center"></div>

        <hr style="margin:32px 0; opacity:.2;" />

        <h2 style="font-size:calc(var(--font-size) * 1.8); margin-bottom:8px; color: var(--text);">📝 Preview Quiz</h2>
        <div id="preview-quiz">${renderPreview()}</div>

        <hr style="margin:32px 0; opacity:.2;" />

        <h2 style="font-size:calc(var(--font-size) * 1.8); margin-bottom:8px; color: var(--text);">🤖 AI Quiz Assistant</h2>
        <p style="color: var(--secondary-text); margin-bottom:12px;">Generate quiz questions automatically for a topic</p>
        <button onclick="openAIQuizModal()" class="w-full py-3 rounded-xl font-semibold"
                style="background: rgba(37,99,235,.15); color: var(--primary);">
          🤖 Generate AI Quiz
        </button>

        <!-- AI Quiz Modal -->
        <div id="ai-quiz-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
          <div class="bg-card rounded-xl p-6 w-full max-w-sm mx-2"
               style="background: var(--card-bg); color: var(--text); border-radius: var(--radius);">
            <h3 class="text-lg font-semibold mb-4" style="color: var(--text);">🤖 Generate AI Quiz</h3>
            <input id="ai-quiz-topic-input" placeholder="Topic"
                   class="w-full mb-3 px-3 py-2 rounded-lg"
                   style="background: var(--card-bg); color: var(--text); border: 1px solid var(--primary); border-radius: var(--radius);" />
            <input id="ai-quiz-count-input" type="number" min="1" max="20" placeholder="Number of questions"
                   class="w-full mb-4 px-3 py-2 rounded-lg"
                   style="background: var(--card-bg); color: var(--text); border: 1px solid var(--primary); border-radius: var(--radius);" />
            <div class="flex justify-end gap-2">
              <button onclick="closeAIQuizModal()"
                      class="px-4 py-2 rounded-lg"
                      style="background: var(--card-bg); color: var(--text); border:1px solid var(--primary);">Cancel</button>
              <button onclick="generateAIQuiz()"
                      class="px-4 py-2 rounded-lg"
                      style="background: var(--primary); color:white;">Generate</button>
            </div>
          </div>
        </div>

        <div id="ai-quiz-result" class="mt-4"></div>

        <hr style="margin:32px 0; opacity:.2;" />

        <h2 style="font-size:calc(var(--font-size) * 1.8); margin-bottom:8px; color: var(--text);">📄 PDF Quiz Generator</h2>
        <p style="color: var(--secondary-text); margin-bottom:12px;">Upload a PDF or document to automatically generate quiz questions</p>
        <button onclick="openPDFQuizModal()" class="w-full py-3 rounded-xl font-semibold"
                style="background: rgba(34,197,94,.15); color: var(--success);">
          📄 Generate from PDF
        </button>

        <!-- PDF Quiz Modal -->
        <div id="pdf-quiz-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
          <div class="bg-card rounded-xl p-6 w-full max-w-md mx-2"
               style="background: var(--card-bg); color: var(--text); border-radius: var(--radius);">
            <h3 class="text-lg font-semibold mb-4" style="color: var(--text);">📄 Generate Quiz from PDF</h3>

            <div class="mb-4">
              <label for="pdf-file-input" class="block text-sm font-medium mb-2">Upload PDF or Document</label>
              <input type="file" id="pdf-file-input" accept=".pdf,.doc,.docx,.txt"
                     class="w-full px-3 py-2 border rounded-lg"
                     style="background: var(--card-bg); color: var(--text); border: 1px solid var(--border);">
            </div>

            <div class="mb-4">
              <label for="pdf-quiz-count-input" class="block text-sm font-medium mb-2">Number of Questions</label>
              <input id="pdf-quiz-count-input" type="number" min="1" max="50" placeholder="10" value="10"
                     class="w-full px-3 py-2 border rounded-lg"
                     style="background: var(--card-bg); color: var(--text); border: 1px solid var(--border);">
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium mb-2">Question Types</label>
              <div class="flex gap-2">
                <label class="flex items-center">
                  <input type="checkbox" id="multiple-choice" checked class="mr-2">
                  Multiple Choice
                </label>
                <label class="flex items-center">
                  <input type="checkbox" id="true-false" class="mr-2">
                  True/False
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button onclick="closePDFQuizModal()"
                      class="px-4 py-2 rounded-lg btn-secondary">Cancel</button>
              <button onclick="generatePDFQuiz()"
                      class="px-4 py-2 rounded-lg btn-primary">Generate Quiz</button>
            </div>
          </div>
        </div>

        <div id="pdf-quiz-result" class="mt-4"></div>

        <hr style="margin:32px 0; opacity:.2;" />

        <h2 style="font-size:calc(var(--font-size) * 1.8); margin-bottom:8px; color: var(--text);">📊 Item Analysis</h2>
        <p style="color: var(--secondary-text); margin-bottom:12px;">Analyze quiz performance and question difficulty</p>
        <button onclick="openItemAnalysisModal()" class="w-full py-3 rounded-xl font-semibold"
                style="background: rgba(245,158,11,.15); color: var(--warning);">
          📊 View Item Analysis
        </button>

        <!-- Item Analysis Modal -->
        <div id="item-analysis-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
          <div class="bg-card rounded-xl p-6 w-full max-w-4xl mx-2 max-h-[80vh] overflow-y-auto"
               style="background: var(--card-bg); color: var(--text); border-radius: var(--radius);">
            <h3 class="text-xl font-semibold mb-6" style="color: var(--text);">📊 Item Analysis Dashboard</h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-primary mb-2">85%</div>
                <div class="text-sm text-text-muted">Average Score</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-success mb-2">12</div>
                <div class="text-sm text-text-muted">Total Quizzes</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-warning mb-2">3.2</div>
                <div class="text-sm text-text-muted">Avg Difficulty</div>
              </div>
            </div>

            <div class="card p-4 mb-6">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-semibold">Question Performance</h4>
                <button onclick="toggleAnalysisFormat()" class="btn-secondary text-sm" id="format-toggle">
                  Show Fractions
                </button>
              </div>
              <div class="space-y-3" id="question-performance">
                <div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--surface);">
                  <div>
                    <div class="font-medium">Question 1</div>
                    <div class="text-sm text-text-muted">Difficulty: Easy</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-success" data-percent="95" data-fraction="19/20">95%</div>
                    <div class="text-sm text-text-muted">19/20 correct</div>
                  </div>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--surface);">
                  <div>
                    <div class="font-medium">Question 2</div>
                    <div class="text-sm text-text-muted">Difficulty: Medium</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-warning" data-percent="78" data-fraction="14/18">78%</div>
                    <div class="text-sm text-text-muted">14/18 correct</div>
                  </div>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--surface);">
                  <div>
                    <div class="font-medium">Question 3</div>
                    <div class="text-sm text-text-muted">Difficulty: Hard</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-error" data-percent="45" data-fraction="9/20">45%</div>
                    <div class="text-sm text-text-muted">9/20 correct</div>
                  </div>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--surface);">
                  <div>
                    <div class="font-medium">Question 4</div>
                    <div class="text-sm text-text-muted">Difficulty: Medium</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-success" data-percent="92" data-fraction="23/25">92%</div>
                    <div class="text-sm text-text-muted">23/25 correct</div>
                  </div>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--surface);">
                  <div>
                    <div class="font-medium">Question 5</div>
                    <div class="text-sm text-text-muted">Difficulty: Easy</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-success" data-percent="88" data-fraction="22/25">88%</div>
                    <div class="text-sm text-text-muted">22/25 correct</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button onclick="exportAnalysis()"
                      class="px-4 py-2 rounded-lg btn-secondary">Export Report</button>
              <button onclick="closeItemAnalysisModal()"
                      class="px-4 py-2 rounded-lg btn-primary">Close</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function openAIQuizModal() {
  document.getElementById("ai-quiz-modal").classList.remove("hidden");
}

function closeAIQuizModal() {
  document.getElementById("ai-quiz-modal").classList.add("hidden");
}

function openPDFQuizModal() {
  document.getElementById("pdf-quiz-modal").classList.remove("hidden");
}

function closePDFQuizModal() {
  document.getElementById("pdf-quiz-modal").classList.add("hidden");
}

async function generatePDFQuiz() {
  const fileInput = document.getElementById("pdf-file-input");
  const countInput = document.getElementById("pdf-quiz-count-input");
  const count = parseInt(countInput.value) || 10;

  if (!fileInput.files[0]) {
    toast("Please select a PDF file");
    return;
  }

  const file = fileInput.files[0];
  const resultDiv = document.getElementById("pdf-quiz-result");

  // Show loading state
  resultDiv.innerHTML = `
    <div class="p-4 rounded-xl" style="background: rgba(34,197,94,.1);">
      <div class="flex items-center gap-2 mb-2">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-success border-t-transparent"></div>
        <span class="font-semibold">Processing ${file.name}...</span>
      </div>
      <p class="text-sm">Extracting text and generating ${count} questions...</p>
    </div>
  `;

  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('numQuestions', count);

    // Use local backend or replace with your deployed URL
    // Generate mock quiz questions based on topic instead of calling missing API

    const res = await fetch(`${backendUrl}/api/generate-quiz-from-document`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to generate quiz from document');
    }

    const data = await res.json();

    // Process the generated questions into the format we need
    teacherQuestions = data.questions.map(q => {
      let options = [...(q.options || [])];
      options = shuffleArray(options);

      const correctText = (q.correct || "").trim().toLowerCase();
      let correctIndex = options.findIndex(
        opt => opt.trim().toLowerCase() === correctText
      );

      if (correctIndex === -1) {
        correctIndex = Math.floor(Math.random() * options.length);
      }

      const correctLetter = String.fromCharCode(65 + correctIndex);

      return {
        question: q.question || "",
        options,
        correct: correctLetter
      };
    });

    window._teacherTitleDraft = `${file.name.replace(/\.[^/.]+$/, "")} Quiz`;

    resultDiv.innerHTML = `
      <div class="p-4 rounded-xl" style="background: rgba(34,197,94,.1);">
        ✅ Successfully generated ${data.questions.length} questions from ${file.name}!
        <br><small class="text-text-muted">Analyzed ${data.charactersAnalyzed} characters from the document.</small>
      </div>
    `;

    closePDFQuizModal();
    fileInput.value = ''; // Clear file input
    renderApp();
    toast(`✅ Generated ${data.questions.length} questions from ${file.name}`);

  } catch (err) {
    console.error('PDF Quiz generation failed:', err);
    resultDiv.innerHTML = `
      <div class="p-4 rounded-xl" style="background: rgba(220,38,38,.1);">
        ❌ Error: ${err.message}
        <br><small class="text-text-muted">Make sure your backend is running and configured correctly.</small>
      </div>
    `;
    toast("❌ Failed to generate quiz: " + err.message);
  }
}

// ============= ITEM ANALYSIS - PER QUIZ =============

function openItemAnalysisModal() {
  document.getElementById("item-analysis-modal").classList.remove("hidden");
  
  // Populate with real data
  requestAnimationFrame(() => {
    renderQuizSelector();
  });
}

function closeItemAnalysisModal() {
  document.getElementById("item-analysis-modal").classList.add("hidden");
}

function renderQuizSelector() {
  const container = document.getElementById('question-performance');
  if (!container) return;
  
  const allScores = JSON.parse(localStorage.getItem('studentQuizScores') || '[]');
  
  if (allScores.length === 0) {
    container.innerHTML = '<p style="color: var(--on-surface-variant); text-align: center; padding: 20px;">No quiz attempts found.</p>';
    return;
  }
  
  // Get unique quizzes
  const quizzes = {};
  allScores.forEach(score => {
    if (!quizzes[score.quizId]) {
      quizzes[score.quizId] = { quizId: score.quizId, attempts: [] };
    }
    quizzes[score.quizId].attempts.push(score);
  });
  
  // Show quiz selector
  let html = '<div style="margin-bottom: 20px;"><h4 style="font-weight: bold; margin-bottom: 10px;">Select a Quiz to Analyze:</h4></div>';
  
  Object.values(quizzes).forEach(quiz => {
    const studentCount = new Set(quiz.attempts.map(a => a.studentId)).size;
    const avgScore = Math.round(quiz.attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / quiz.attempts.length);
    
    html += `
      <div class="p-4 mb-3 rounded-lg cursor-pointer hover:scale-[1.02] transition-all" 
           style="background: var(--surface); border-left: 4px solid var(--primary);"
           onclick="calculateItemAnalysisForQuiz('${quiz.quizId}')">
        <div class="flex justify-between items-center">
          <div>
            <div class="font-bold text-lg">${quiz.quizId}</div>
            <div class="text-sm" style="color: var(--on-surface-variant);">
              ${studentCount} student${studentCount !== 1 ? 's' : ''} • ${quiz.attempts.length} attempt${quiz.attempts.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold" style="color: var(--primary);">${avgScore}%</div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function calculateItemAnalysisForQuiz(quizId) {
  // Find the quiz questions
  let quiz = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === 'teacher-quizzes' || key.startsWith('teacher_quizzes_')) {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      quiz = stored.find(q => (q.quizId === quizId || q.id === quizId));
      if (quiz) break;
    }
  }
  
  if (!quiz?.questions) {
    toast("⚠️ Quiz questions not found");
    return;
  }
  
  // Get all attempts for this quiz
  const allScores = JSON.parse(localStorage.getItem('studentQuizScores') || '[]');
  const quizAttempts = allScores.filter(s => s.quizId === quizId);
  
  if (quizAttempts.length === 0) {
    const container = document.getElementById('question-performance');
    container.innerHTML = `
      <button onclick="renderQuizSelector()" style="padding: 8px 16px; background: var(--surface-variant); border-radius: 6px; margin-bottom: 15px;">
        ← Back
      </button>
      <p style="color: var(--on-surface-variant); text-align: center; padding: 20px;">No attempts found for this quiz.</p>
    `;
    return;
  }
  
  // Get only the highest score per student
  const studentBestAttempts = {};
  quizAttempts.forEach(attempt => {
    const studentId = attempt.studentId;
    if (!studentBestAttempts[studentId] || attempt.percentage > studentBestAttempts[studentId].percentage) {
      studentBestAttempts[studentId] = attempt;
    }
  });
  
  const bestAttempts = Object.values(studentBestAttempts);
  
  // Calculate per-question statistics using only best attempts
  const questionStats = quiz.questions.map((q, index) => {
    let correctCount = 0;
    let totalAnswers = 0;
    
    bestAttempts.forEach(attempt => {
      if (attempt.answers && attempt.answers[index] !== undefined) {
        totalAnswers++;
        // Check if the answer was correct
        if (attempt.correctAnswers && attempt.correctAnswers[index]) {
          correctCount++;
        }
      }
    });
    
    const percentage = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    
    return {
      questionNumber: index + 1,
      question: q.question,
      correctCount,
      totalAnswers,
      percentage,
      difficulty: percentage >= 80 ? 'Easy' : percentage >= 50 ? 'Medium' : 'Hard'
    };
  });
  
  // Calculate overall stats
  const avgScore = Math.round(bestAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / bestAttempts.length);
  const totalStudents = bestAttempts.length;
  const totalAttempts = quizAttempts.length;
  const avgDifficulty = (questionStats.reduce((sum, s) => sum + s.percentage, 0) / questionStats.length / 100 * 5).toFixed(1);
  
  // Update summary stats
  const summaryHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold text-primary mb-2">${avgScore}%</div>
        <div class="text-sm text-text-muted">Average Score (Best Attempts)</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold text-success mb-2">${totalStudents}</div>
        <div class="text-sm text-text-muted">Students (${totalAttempts} total attempts)</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold text-warning mb-2">${avgDifficulty}</div>
        <div class="text-sm text-text-muted">Avg Difficulty (1-5)</div>
      </div>
    </div>
  `;
  
  // Render results
  const container = document.getElementById('question-performance');
  let html = `
    <button onclick="renderQuizSelector()" style="padding: 8px 16px; background: var(--surface-variant); border-radius: 6px; margin-bottom: 15px;">
      ← Back to Quiz List
    </button>
    <h4 style="font-weight: bold; font-size: 18px; margin-bottom: 15px;">Analysis for: ${quiz.title || quizId}</h4>
    <p style="font-size: 12px; color: var(--on-surface-variant); margin-bottom: 15px;">Based on highest score per student</p>
  `;
  
  questionStats.forEach(stat => {
    const color = stat.percentage >= 80 ? 'var(--success)' : stat.percentage >= 50 ? 'var(--warning)' : 'var(--error)';
    
    html += `
      <div class="p-3 rounded-lg mb-2" style="background: var(--surface);">
        <div class="flex justify-between">
          <div style="flex: 1;">
            <div class="font-medium">Question ${stat.questionNumber}</div>
            <div class="text-sm" style="color: var(--on-surface-variant); margin-top: 4px;">${stat.question}</div>
            <div class="text-xs mt-2">Difficulty: ${stat.difficulty}</div>
          </div>
          <div class="text-right">
            <div class="font-semibold" style="color: ${color};" data-percent="${stat.percentage}" data-fraction="${stat.correctCount}/${stat.totalAnswers}">
              ${stat.percentage}%
            </div>
            <div class="text-sm" style="color: var(--on-surface-variant);">${stat.correctCount}/${stat.totalAnswers} correct</div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Update the summary section (if it exists in the modal)
  const modalContent = document.getElementById('item-analysis-modal');
  if (modalContent) {
    const summaryContainer = modalContent.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
    if (summaryContainer) {
      summaryContainer.outerHTML = summaryHTML;
    }
  }
}

function exportAnalysis() {
  toast("Analysis report exported successfully!");
  // In a real implementation, this would generate and download a PDF/CSV report
}

function toggleAnalysisFormat() {
  const toggleBtn = document.getElementById('format-toggle');
  const performanceItems = document.querySelectorAll('#question-performance .font-semibold[data-percent]');

  const isShowingPercent = toggleBtn.textContent.includes('Fractions');

  performanceItems.forEach(item => {
    if (isShowingPercent) {
      item.textContent = item.dataset.fraction;
      toggleBtn.textContent = 'Show Percentages';
    } else {
      item.textContent = item.dataset.percent + '%';
      toggleBtn.textContent = 'Show Fractions';
    }
  });
}

function updateTeacherQuestion(index, field, value) {
  teacherQuestions[index][field] = value;

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTeacherDraft(
      document.getElementById('quiz-title')?.value || '',
      teacherQuestions
    );
  }, 300);
}

function updateTeacherOption(qIndex, optIndex, value) {
  teacherQuestions[qIndex].options[optIndex] = value;

  clearTimeout(teacherDraftSaveTimer);
  teacherDraftSaveTimer = setTimeout(() => {
    saveTeacherDraft(
      document.getElementById('quiz-title')?.value || '',
      teacherQuestions
    );
  }, 300);
}


function updateTeacherTitle(title) {
  window._teacherTitleDraft = title;
  saveTeacherDraft(title, teacherQuestions);
}


async function generateAIQuiz() {
  const topicInput = document.getElementById("ai-quiz-topic-input");
  const countInput = document.getElementById("ai-quiz-count-input");

  const topic = topicInput?.value.trim();
  const count = Number(countInput?.value) || 5;

  if (!topic) return toast("Topic is required");

  try {
    const backendUrl = getBackendUrl();

    const res = await fetch(`${backendUrl}/api/ai/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        count
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend error: ${errText}`);
    }

    const data = await res.json().catch(() => ({}));
    const qs = data.questions || [];

    if (!Array.isArray(qs) || qs.length === 0) {
      throw new Error("AI returned no questions. Check OPENAI_API_KEY on backend.");
    }

    teacherQuestions = qs.slice(0, count).map(q => {
      // Clean options: remove any letter prefixes like "A)", "B)", "1.", etc.
      const cleanOption = (opt) => {
        if (typeof opt !== 'string') return opt;
        // Remove patterns like "A) ", "B) ", "1. ", "2. ", etc. from the start
        return opt.replace(/^[A-Z]\)\s*/i, '').replace(/^\d+\.\s*/, '').trim();
      };
      
      const opts = Array.isArray(q.options) && q.options.length >= 2 
        ? q.options.map(cleanOption) 
        : ["Option A", "Option B", "Option C", "Option D"];
      
      // Also clean the correct answer
      const cleanCorrect = cleanOption(q.correct || q.answer || "");
      
      // Shuffle the cleaned options
      const options = shuffleArray([...opts]);

      // Find which option matches the correct answer
      const correctText = cleanCorrect.trim().toLowerCase();
      let correctIndex = options.findIndex(opt => opt.trim().toLowerCase() === correctText);
      if (correctIndex === -1) correctIndex = 0;
      const correctLetter = String.fromCharCode(65 + correctIndex);

      return {
        question: q.question || q.front || "",
        options,
        correct: correctLetter
      };
    });

    window._teacherTitleDraft = `${topic} Quiz`;

    closeAIQuizModal();
    topicInput.value = "";
    countInput.value = "";

    toast(`✅ ${teacherQuestions.length} AI questions generated!`);

    currentView = "teacher";
    renderApp();
  } catch (err) {
    console.error("AI Quiz generation failed:", err);
    toast("❌ Failed to generate AI quiz: " + err.message);
  }
}


function previewTeacherQuiz() {
  const title = document.getElementById("quiz-title")?.value || "Preview Quiz";

  if (teacherQuestions.length === 0) {
    toast("Add at least one question to preview.");
    return;
  }


  isQuizPreview = true;

  quizQuestions = teacherQuestions.map(q => ({
    question: q.question,
    options: q.options,
    correct: q.correct
  }));

  quizIndex = 0;
  quizScore = 0;

  currentView = "teacher-quiz"; 
  renderApp();
}



async function editTeacherQuiz(quizId) {
  if (!quizId) {
    toast("❌ Quiz id missing; refresh and try again");
    return;
  }
  try {
    const res = await fetch(
      `${getBackendUrl()}/api/quizzes/${quizId}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch quiz");
    }

    const data = await res.json();

    clearTeacherDraft();

    window._teacherEditingQuizId = quizId;
    window._teacherTitleDraft = data.quiz.title;
    teacherQuestions = data.questions || [];

    currentView = "teacher";
    renderApp();
  } catch (err) {
    // Fallback: load from localStorage
    const user = getUser();
    if (!user) {
      toast("❌ Please log in first");
      return;
    }

    const key = `teacher_quizzes_${user.id}`;
    const quizzes = JSON.parse(localStorage.getItem(key) || "[]");
    const quiz = quizzes.find(q => q.quizId === quizId);

    if (!quiz) {
      toast("❌ Quiz not found in local storage");
      return;
    }

    clearTeacherDraft();
    window._teacherEditingQuizId = quizId;
    window._teacherTitleDraft = quiz.title;
    
    if (quiz.questions && Array.isArray(quiz.questions)) {
      teacherQuestions = quiz.questions.map(q => ({
        question: q.question,
        options: q.options || [],
        correct: q.correctAnswer || q.correct || ""
      }));
    } else {
      teacherQuestions = [];
    }

    currentView = "teacher";
    renderApp();
  }
}




async function deleteTeacherQuiz(quizId) {
  if (!confirm("Delete this quiz permanently?")) return;

  // Try to delete from backend (may not exist there if created locally)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(
      `${getBackendUrl()}/api/quizzes/${quizId}`,
      { 
        method: "DELETE",
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    
    if (res.ok) {
      console.log("✅ Quiz deleted from backend");
    }
    // Silently ignore 404 errors (quiz didn't exist on backend)
  } catch (err) {
    // Silently ignore errors (backend unavailable or timeout)
    console.log("Note: Could not sync delete to backend, removing from local storage");
  }

  const user = getUser();
  const key = `teacher_quizzes_${user.id}`;
  const quizzes = await getTeacherQuizzes();
  const filtered = quizzes.filter(q => (q.id || q.quizId) !== quizId);

  localStorage.setItem(key, JSON.stringify(filtered));
  toast("✅ Quiz deleted");
  renderApp();
}


function addTeacherQuestion() {
  teacherQuestions.push({
    question: "",
    options: ["", "", "", ""],
    correct: ""
  });

  saveTeacherDraft(
    document.getElementById("quiz-title")?.value || "",
    teacherQuestions
  );

  renderApp();
}

async function submitTeacherQuiz() {
  const title = document.getElementById("quiz-title").value.trim();

  if (!title || teacherQuestions.length === 0) {
    toast("Please add a title and at least one question.");
    return;
  }

  const isEditing = !!window._teacherEditingQuizId;

  const url = isEditing
    ? `${getBackendUrl()}/api/quizzes/${window._teacherEditingQuizId}`
    : `${getBackendUrl()}/api/quizzes`;

  const method = isEditing ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        questions: teacherQuestions,
      }),
    });

    const data = await res.json(); // read once

    if (!res.ok) {
      toast(data.error || "Failed to save quiz");
      return;
    }

    if (!isEditing) {
      saveTeacherQuiz({
        quizId: data.id || data.quizId, // Backend returns 'id', but we use 'quizId' in frontend
        id: data.id || data.quizId, // Also save as 'id' for compatibility
        title,
        questions: teacherQuestions // PASS THE QUESTIONS ARRAY
      });
    }

    if (isQuizPreview) {
      toast("Preview finished! No results were saved.");
      isQuizPreview = false;
      return;
    }

    window._teacherEditingQuizId = null;
    clearTeacherDraft();
    teacherQuestions = [];
    window._teacherTitleDraft = "";

    document.getElementById("teacher-result").innerHTML = `
      <div class="p-4 rounded-xl" style="background:rgba(34,197,94,.1);">
        ✅ Quiz ${isEditing ? "updated" : "created"} successfully!
      </div>
    `;

    renderApp();
  } catch (err) {
    console.error("Error submitting quiz:", err);
    toast("An unexpected error occurred while saving the quiz.");
  }
}



function saveTeacherQuiz(quiz) {
  const user = getUser();
  if (!user) return;

  const key = `teacher_quizzes_${user.id}`;
  const quizzes = JSON.parse(localStorage.getItem(key) || "[]");

  const quizData = {
    quizId: quiz.quizId || quiz.id,
    id: quiz.id || quiz.quizId,
    title: quiz.title,
    questions: quiz.questions || [],
    createdAt: quiz.createdAt || Date.now()
  };

  quizzes.unshift(quizData);
  localStorage.setItem(key, JSON.stringify(quizzes));
  
  // Sync to backend if authenticated with Google
  if (user.authenticated && user.provider === 'google') {
    syncQuizToBackend(quizData);
  }
}



async function getTeacherQuizzes() {
  const user = getUser();
  if (!user) return [];

  const key = `teacher_quizzes_${user.id}`;
  
  // Load from backend if authenticated
  if (user.authenticated && user.provider === 'google') {
    const backendQuizzes = await loadQuizzesFromBackend();
    if (backendQuizzes.length > 0) {
      // Merge backend quizzes with local ones
      const localQuizzes = JSON.parse(localStorage.getItem(key) || "[]");
      const quizMap = new Map();
      
      // Add backend quizzes first
      backendQuizzes.forEach(q => {
        const id = q.id || q.quizId;
        if (id) quizMap.set(id, q);
      });
      
      // Add local quizzes that don't exist in backend
      localQuizzes.forEach(q => {
        const id = q.id || q.quizId;
        if (id && !quizMap.has(id)) {
          quizMap.set(id, q);
        }
      });
      
      const mergedQuizzes = Array.from(quizMap.values());
      localStorage.setItem(key, JSON.stringify(mergedQuizzes));
      return mergedQuizzes;
    }
  }
  
  // Get quizzes from localStorage
  let quizzes = JSON.parse(localStorage.getItem(key) || "[]");
  
  // Final deduplication based on quiz ID
  const seen = new Set();
  quizzes = quizzes.filter(q => {
    const id = q.id || q.quizId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  
  // Save deduplicated list back
  localStorage.setItem(key, JSON.stringify(quizzes));
  
  return quizzes;
}

async function loadTeacherQuizzesFromBackend() {
  const user = getUser();
  if (!user) return;
  
  try {
    const res = await fetch(`${getBackendUrl()}/api/quizzes`);
    if (!res.ok) return;
    
    const quizzes = await res.json();
    
    if (Array.isArray(quizzes) && quizzes.length > 0) {
      const key = `teacher_quizzes_${user.id}`;
      const localQuizzes = JSON.parse(localStorage.getItem(key) || "[]");
      
      // Create a map of existing quiz IDs from backend
      const quizMap = new Map();
      quizzes.forEach(q => {
        const id = q.id || q.quizId;
        if (id) quizMap.set(id, q);
      });
      
      // Add local quizzes that don't exist in backend
      localQuizzes.forEach(localQuiz => {
        const id = localQuiz.id || localQuiz.quizId;
        if (id && !quizMap.has(id)) {
          quizMap.set(id, localQuiz);
        }
      });
      
      // Convert map back to array
      const mergedQuizzes = Array.from(quizMap.values());
      
      localStorage.setItem(key, JSON.stringify(mergedQuizzes));
    }
  } catch (err) {
    console.log("Could not load quizzes from backend:", err);
  }
}

function bindTeacherViewEvents() {
  // Load quizzes from backend (but don't re-render to avoid infinite loops)
  getTeacherQuizzes().catch(err => {
    console.log("Failed to load quizzes:", err);
  });
  
  const backBtn = document.getElementById("backBtnTeacher");
  if (backBtn) {
    backBtn.onclick = () => {
      currentView = "home";
      renderApp();
    };
  }
  const backTeacherBtn = document.getElementById("backBtnScoresTeacher");
  if (backTeacherBtn) {
    backTeacherBtn.onclick = () => {
      currentView = "teacher-quiz-list";
      renderApp();
    };
  }
}

async function loadStudentQuiz() {
  const quizId = document.getElementById("student-quiz-id").value.trim();

  if (!quizId) {
    document.getElementById("student-error").innerText = "Enter a quiz ID";
    return;
  }

  if (!window.currentStudent || !window.currentStudent.name || !window.currentStudent.id) {
    pendingQuizId = quizId;
    openStudentInfoModal();
    return;
  }

  try {
    const res = await fetch(
      `${getBackendUrl()}/api/quizzes/${quizId}`
    );

    if (!res.ok) {
      document.getElementById("student-error").innerText = "Quiz not found";
      return;
    }

    const data = await res.json();

    quizQuestions = data.questions;
    quizIds = quizId;
    currentQuizId = quizId;
    quizIndex = 0;
    quizScore = 0;
    isQuizPreview = false;
    isStudentLocked = true;

    currentView = "teacher-quiz";
    renderApp();

  } catch (err) {
    document.getElementById("student-error").innerText = "Network error";
  }
}

async function loadStudentQuiz(quizIdParam) {
  const quizId = quizIdParam || document.getElementById("student-quiz-id").value.trim();

  if (!quizId) {
    document.getElementById("student-error").innerText = "Enter a quiz ID";
    return;
  }

  if (!window.currentStudent || !window.currentStudent.name || !window.currentStudent.id) {
    pendingQuizId = quizId;
    openStudentInfoModal();
    return;
  }

  try {
    const res = await fetch(`${getBackendUrl()}/api/quizzes/${quizId}`);
    if (!res.ok) {
      document.getElementById("student-error").innerText = "Quiz not found";
      return;
    }

    const data = await res.json();

    quizQuestions = data.questions;
    currentQuizId = quizId;
    quizIndex = 0;
    quizScore = 0;
    isQuizPreview = false;
    isStudentLocked = true;
    answeredQuestions = new Set();
    confirmedAnswers = {};

    currentView = "teacher-quiz";
    renderApp();

  } catch (err) {
    document.getElementById("student-error").innerText = "Network error";
  }
}


function renderTeacherQuizView() {
  if (!quizQuestions || quizQuestions.length === 0) {
    console.warn("Quiz view opened without questions");
    currentView = "home";
    return renderHomeView();
  }

  const q = quizQuestions[quizIndex];
  const letters = ["A", "B", "C", "D"];
  const isAnswered = answeredQuestions.has(quizIndex);
  const confirmed = confirmedAnswers[quizIndex];
  const progress = ((quizIndex + 1) / quizQuestions.length) * 100;

  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;
  const sub = config.secondary_color;

  return `
    <div class="mobile-optimized w-full h-full overflow-auto bg-gradient-to-br from-[var(--surface)] to-[var(--primary)]">
      <div class="min-h-full flex flex-col p-4">
        <div class="max-w-4xl mx-auto fade-in w-full">

          <!-- Enhanced Header -->
          <div class="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 mb-6 shadow-xl border border-white/20">
            <div class="flex items-center justify-between mb-4">
              <button onclick="exitTeacherQuiz()"
                class="group px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95 quiz-option"
                style="background: linear-gradient(135deg, var(--surface), var(--card-bg)); color: var(--text); box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.2); min-height: 48px;">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  Exit Quiz
                </span>
              </button>

              <div class="text-center">
                <div class="flex items-center gap-2 mb-2">
                  <div class="px-3 py-1 rounded-full text-xs font-semibold"
                       style="background: linear-gradient(135deg, var(--surface), var(--card-bg)); color: var(--on-surface, var(--text)); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    👨‍🏫 Teacher Quiz
                  </div>
                  <div class="px-2 py-1 rounded-full text-xs font-semibold"
                       style="background: linear-gradient(135deg, var(--primary), var(--primary)); color: var(--on-primary, var(--text)); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    Q ${quizIndex + 1} / ${quizQuestions.length}
                  </div>
                </div>
                <div class="text-xs" style="color:${sub};">${Math.round(progress)}% Complete</div>
              </div>

              <div class="w-20"></div> <!-- Spacer for centering -->
            </div>

            <!-- Progress Bar -->
            <div class="w-full h-3 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.1); box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
              <div class="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                   style="width:${progress}%; background: linear-gradient(90deg, var(--primary), var(--secondary)); box-shadow: 0 0 10px var(--primary)50;">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
          </div>

          <!-- Question Card -->
          <div class="backdrop-blur-md bg-white/95 dark:bg-slate-800/95 rounded-3xl p-6 mb-6 shadow-2xl border border-white/30 transform hover:scale-[1.02] transition-all duration-300">
            <div class="flex items-start gap-4 mb-6">
              <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
                   style="background: linear-gradient(135deg, var(--primary), var(--surface)); color: var(--on-primary, var(--text)); box-shadow: 0 4px 12px #8b5cf630;">
                Q${quizIndex + 1}
              </div>
              <div class="flex-1">
                <h2 class="text-xl md:text-2xl font-bold leading-tight" style="color: var(--primary); line-height:1.4;">
                  ${q.question}
                </h2>
              </div>
            </div>

            <!-- Answer Status -->
            ${isAnswered ? `
              <div class="mt-6 p-4 rounded-xl border-2 ${confirmed === q.correct ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center ${confirmed === q.correct ? 'bg-green-500' : 'bg-red-500'}">
                    <span class="text-white font-bold text-sm">
                      ${confirmed === q.correct ? '✓' : '✗'}
                    </span>
                  </div>
                  <div>
                    <p class="font-semibold ${confirmed === q.correct ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}">
                      ${confirmed === q.correct ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p class="text-sm" style="color:${sub};">
                      Your answer: ${confirmed} | Correct answer: ${q.correct}
                    </p>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Options Grid -->
          <div class="grid gap-3 md:gap-4 mb-6">
            ${q.options.map((opt, j) => {
              const letter = letters[j];
              const isSelected = selectedAnswer === letter;
              const isConfirmed = confirmed === letter;
              const isCorrect = q.correct === letter;
              const showResult = isAnswered;

              let buttonStyle = `background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid transparent;`;
              let letterBg = `background: linear-gradient(135deg, ${primary}, ${primary}dd);`;

              if (showResult) {
                if (isCorrect) {
                  buttonStyle = `background: linear-gradient(135deg, #22c55e, #16a34a); color: var(--on-primary, var(--text)); border: 2px solid #16a34a;`;
                  letterBg = `background: linear-gradient(135deg, #16a34a, #15803d);`;
                } else if (isConfirmed && !isCorrect) {
                  buttonStyle = `background: linear-gradient(135deg, #ef4444, #dc2626); color: var(--on-primary, var(--text)); border: 2px solid #dc2626;`;
                  letterBg = `background: linear-gradient(135deg, #dc2626, #b91c1c);`;
                } else {
                  buttonStyle = `background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); opacity: 0.6;`;
                }
              } else if (isSelected) {
                buttonStyle = `background: linear-gradient(135deg, ${primary}, ${primary}dd); color: var(--on-primary, var(--text)); border: 2px solid rgba(255,255,255,0.3);`;
                letterBg = `background: linear-gradient(135deg, white, rgba(255,255,255,0.8)); color: ${primary};`;
              }

              return `
                <button
                  ${isAnswered ? 'disabled' : `onclick="selectTeacherQuiz('${letter}')"`}
                  class="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] quiz-option"
                  style="
                    padding: 18px 20px;
                    border-radius: 16px;
                    ${buttonStyle}
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    backdrop-filter: blur(10px);
                    text-align: left;
                    font-size: var(--font-size);
                    min-height: 64px;
                  ">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 group-hover:scale-110"
                         style="${letterBg} box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                      ${letter}
                    </div>
                    <div class="flex-1 font-medium leading-relaxed text-sm">
                      ${opt}
                    </div>
                    ${showResult && isCorrect ? `
                      <div class="text-green-400">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Hover effect overlay -->
                  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                </button>
              `;
            }).join("")}
          </div>

          <!-- Navigation Controls -->
          <div class="flex justify-center gap-3">
            <button onclick="previousTeacherQuiz()"
                    class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 quiz-option"
                    style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 48px;"
                    ${quizIndex === 0 ? 'disabled' : ''}>
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Previous
              </span>
            </button>

            <button onclick="confirmTeacherQuiz()"
                    class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 quiz-option"
                    style="background: linear-gradient(135deg, ${primary}, ${primary}dd); color: var(--on-primary, var(--text)); border: 2px solid rgba(255,255,255,0.2); min-height: 48px;"
                    ${isAnswered ? 'disabled' : ''}>
              <span class="flex items-center gap-2">
                ${isAnswered ? '✓ Confirmed' : 'Confirm Answer'}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </span>
            </button>

            <button onclick="nextTeacherQuiz()"
                    class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 quiz-option"
                    style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 48px;"
                    ${!isAnswered ? 'disabled' : ''}>
              <span class="flex items-center gap-2">
                Next
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  `;
}

function finishStudentQuiz() {
  if (!currentQuizId) {
    console.error("Cannot finish quiz: currentQuizId is missing");
    toast("Quiz ID is missing. Score will not be saved.");
    return;
  }

  if (!window.currentStudent || !window.currentStudent.id) {
    toast("Cannot save score: student info missing!");
    return;
  }

  // ✅ SAVE BEFORE submitting to cloud (score is already calculated)
  const saved = saveQuizScoreNow();
  
  if (!saved) {
    console.warn("⚠️ Failed to save quiz score locally");
  }

  // Submit to Cloudflare
  (async () => {
    try {
      const answers = {};
      for (const [key, value] of Object.entries(window.quizAnswers || {})) {
        const questionIndex = parseInt(key.replace('q', ''));
        if (!isNaN(questionIndex)) {
          answers[questionIndex] = value;
        }
      }

      const result = await submitQuizToCloudflare(currentQuizId, answers);
      if (result && !result.error) {
        console.log("✅ Quiz submission synced to cloud:", result);
      } else {
        console.warn("⚠️ Failed to sync quiz to cloud:", result?.error || "Unknown error");
      }
    } catch (error) {
      console.warn("⚠️ Could not sync quiz results to cloud:", error.message);
    }
  })();

  currentView = "student-score-history";
  renderApp();
  populateStudentScores();
}

// ============= SAVE QUIZ SCORE TO LOCALSTORAGE =============
// ============= SAVE QUIZ SCORE TO LOCALSTORAGE =============
function saveQuizScoreNow() {
  // Get current student data
  const student = window.currentStudent || JSON.parse(localStorage.getItem("currentStudent") || "{}");
  
  if (!student || !student.id || !student.name) {
    console.warn("⚠️ Cannot save quiz score: Student not logged in");
    return false;
  }

  // Determine which quiz we're saving
  const quizId = currentQuizId || window._classQuizId;
  
  if (!quizId) {
    console.warn("⚠️ Cannot save quiz score: No quiz ID found");
    return false;
  }

  // ✅ DEBUG: Log values before saving
  console.log("📊 Saving Quiz Score:", {
    studentId: student.id,
    studentName: student.name,
    quizId: quizId,
    quizScore: quizScore,
    quizQuestionsLength: quizQuestions.length
  });

  // Safety check - ensure we have valid numbers
  if (typeof quizScore !== 'number' || quizScore < 0) {
    console.error("❌ Invalid quizScore:", quizScore);
    return false;
  }

  if (typeof quizQuestions !== 'object' || !Array.isArray(quizQuestions) || quizQuestions.length === 0) {
    console.error("❌ Invalid quizQuestions:", quizQuestions);
    return false;
  }

  // Calculate percentage
  const totalQuestions = quizQuestions.length;
  const percentage = Math.round((quizScore / totalQuestions) * 100);
  const letterGrade = getLetterGrade(percentage);

  // Validate percentage
  if (isNaN(percentage)) {
    console.error("❌ Percentage is NaN:", { quizScore, totalQuestions });
    return false;
  }

  // Get existing scores
  const allScores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");

  // Create new score record
  const scoreRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `score_${Date.now()}_${Math.random()}`,
    studentId: student.id,
    studentName: student.name,
    quizId: quizId,
    score: quizScore,
    total: totalQuestions,
    percentage: percentage,
    letterGrade: letterGrade,
    completedAt: new Date().toISOString(),
    attemptNumber: allScores.filter(s => s.quizId === quizId && s.studentId === student.id).length + 1
  };

  // Add to scores array
  allScores.push(scoreRecord);

  // Save to localStorage
  try {
    localStorage.setItem("studentQuizScores", JSON.stringify(allScores));
    console.log("✅ Quiz score saved successfully:", scoreRecord);
    
    // Also save to backend for persistence across devices
    saveQuizAttemptToBackend(scoreRecord).catch(err => {
      console.log("Note: Backend save failed, but score saved locally:", err);
    });
    
    toast("✅ Score saved: " + quizScore + "/" + totalQuestions + " (" + percentage + "%)");
    return true;
  } catch (error) {
    console.error("❌ Failed to save quiz score:", error);
    toast("❌ Error saving score to local storage");
    return false;
  }
}

async function saveQuizAttemptToBackend(scoreRecord) {
  // Only sync if authenticated with Google
  if (!window.isAuthenticated) {
    console.log("User not authenticated, skipping backend sync");
    return;
  }
  
  try {
    const res = await fetch(`${getBackendUrl()}/api/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreRecord)
    });
    
    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }
    
    console.log("✅ Quiz attempt saved to backend:", scoreRecord);
    return await res.json();
  } catch (err) {
    console.log("Could not save attempt to backend:", err);
    throw err;
  }
}

async function loadStudentQuizAttemptsFromBackend() {
  const student = getUser();
  if (!student || !window.isAuthenticated) {
    console.log("User not authenticated, skipping backend load");
    return;
  }
  
  try {
    const res = await fetch(`${getBackendUrl()}/api/attempts`);
    if (!res.ok) return;
    
    const attempts = await res.json();
    
    if (Array.isArray(attempts) && attempts.length > 0) {
      // Filter attempts for this student
      const studentAttempts = attempts.filter(a => a.studentId === student.id);
      
      if (studentAttempts.length > 0) {
        // Get local attempts
        const localAttempts = JSON.parse(localStorage.getItem('studentQuizScores') || '[]');
        
        // Create a map of existing attempt IDs
        const attemptMap = new Map();
        localAttempts.forEach(a => {
          if (a.id) attemptMap.set(a.id, a);
        });
        
        // Add backend attempts that don't exist locally
        studentAttempts.forEach(a => {
          if (a.id && !attemptMap.has(a.id)) {
            attemptMap.set(a.id, a);
          }
        });
        
        // Convert back to array and save
        const mergedAttempts = Array.from(attemptMap.values());
        localStorage.setItem('studentQuizScores', JSON.stringify(mergedAttempts));
        
        console.log(`✅ Loaded ${studentAttempts.length} quiz attempts from backend`);
      }
    }
  } catch (err) {
    console.log("Could not load quiz attempts from backend:", err);
  }
}



function answerTeacherQuiz(selectedLetter) {
  const q = quizQuestions[quizIndex];
  if (!q || !q.correct) return; // safety

  const correct = q.correct;
  const correctIndex = correct.charCodeAt(0) - 65;
  const correctText = q.options[correctIndex] || "Unknown";

  let feedbackEl = document.createElement("div");
  feedbackEl.style.marginTop = "12px";
  feedbackEl.style.fontWeight = "600";
  feedbackEl.style.color = selectedLetter === correct ? "green" : "red";
  feedbackEl.innerText = selectedLetter === correct
    ? `Correct ✅`
    : `Incorrect ❌ • Correct: ${correct} (${correctText})`;

  // Use the correct container class from the updated renderTeacherQuizView
  const container = document.querySelector(".max-w-4xl.mx-auto.fade-in.w-full");
  if (container) {
    container.appendChild(feedbackEl);
    // Auto-remove feedback after 3 seconds
    setTimeout(() => {
      if (feedbackEl.parentNode) {
        feedbackEl.remove();
      }
    }, 3000);
  } else {
    console.warn("Could not find quiz container to append feedback");
  }

  if (selectedLetter === correct) quizScore++;
}

function selectTeacherQuiz(letter) {
  selectedAnswer = letter;
  // Update button styles without re-rendering
  const buttons = document.querySelectorAll('.max-w-4xl.mx-auto.fade-in.w-full .grid.gap-4.md\\:gap-6 button');
  if (buttons.length === 0) {
    console.warn("Could not find quiz option buttons to update");
    return;
  }
  const letters = ['A', 'B', 'C', 'D'];
  buttons.forEach((btn, j) => {
    const isSelected = letters[j] === letter;
    btn.classList.toggle('selected', isSelected);
  });
}

function confirmTeacherQuiz() {
  if (selectedAnswer && !answeredQuestions.has(quizIndex)) {
    answerTeacherQuiz(selectedAnswer);
    answeredQuestions.add(quizIndex);
    confirmedAnswers[quizIndex] = selectedAnswer;
    toast("Answer confirmed for this question!");
    selectedAnswer = null;
    renderApp();
  }
}

function previousTeacherQuiz() {
  if (quizIndex > 0) {
    quizIndex--;
    selectedAnswer = null;
    renderApp();
  }
}

function nextTeacherQuiz() {
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex++;
    selectedAnswer = null;
    renderApp();
  } else {
    currentView = "teacher-quiz-result";
    renderApp();
  }
}


function saveStudentScore(record) {
  const student = window.currentStudent || JSON.parse(localStorage.getItem("currentStudent") || "{}");
  if (!student.name || !student.id) {
    toast("Student information missing! Cannot save score.");
    return;
  }

  if (!record.quizId) {
    console.error("Cannot save score: quizId is missing", record);
    return;
  }

  const scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");


  const cleanedScores = scores.filter(s => s.quizId != null);

  const scoreRecord = {
    id: crypto.randomUUID(),
    ...record,
    studentName: student.name,
    studentId: student.id
  };

  cleanedScores.push(scoreRecord);
  localStorage.setItem("studentQuizScores", JSON.stringify(cleanedScores));

  if (currentView === "student-score-history") populateStudentScores();
}




function showStudentScores() {
  currentView = "student-score-history";
  renderApp();          
  populateStudentScores(); 
}

function showStudentScoresByQuiz(quizId) {
  const student = window.currentStudent || JSON.parse(localStorage.getItem("currentStudent") || "{}");
  if (!student.id) {
    toast("Student information missing!");
    return;
  }

  const allScores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  const container = document.getElementById("student-score-container");
  if (!container) return;

  const scores = allScores.filter(
    s => s.studentId === student.id && s.quizId === quizId
  );

  if (!scores.length) {
    container.innerHTML = `<p style="color:var(--secondary);">No attempts for this quiz yet.</p>`;
    return;
  }

  container.innerHTML = `
    <h3 class="mb-4 text-lg font-semibold">📘 Quiz: ${quizId}</h3>
    <ul class="flex flex-col gap-3">
      ${scores.map(s => `
        <li class="p-4 rounded-xl flex justify-between items-start" style="background:var(--card-bg);">
          <div>
            <div><strong>Score:</strong> ${s.score} / ${s.total}</div>
            <div style="color:var(--secondary); font-size:.9rem;">
              ${new Date(s.date).toLocaleString()}
            </div>
          </div>
          <button onclick="hideStudentScoreForMe('${s.id}')" class="px-3 py-1 rounded-lg text-sm"
                  style="background:rgba(239,68,68,.15); color:#dc2626;">
            Delete
          </button>
        </li>
      `).join("")}
    </ul>
    <button onclick="populateStudentScores()" class="mb-4 px-4 py-2 rounded-lg" style="background:var(--card-bg); color:white;">
      ← Back to All Scores
    </button>
  `;
}

function showTeacherScoresView() {
  currentView = "teacher-view-scores";
  renderApp();                  
  populateTeacherStudentScores();
}

function populateStudentScores() {
  const student = window.currentStudent || JSON.parse(localStorage.getItem("currentStudent") || "{}");
  if (!student.id) {
    toast("Student information missing!");
    return;
  }

  const allScores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  const container = document.getElementById("student-score-container");
  if (!container) return;

  const hiddenScores = JSON.parse(localStorage.getItem(`hiddenScores_${student.id}`) || "[]");

  const studentScores = allScores.filter(
    s => s.studentId === student.id && !hiddenScores.includes(s.id) && s.quizId != null
  );

  if (!studentScores.length) {
    container.innerHTML = `<p style="color:var(--secondary);">You haven't taken any quizzes yet.</p>`;
    return;
  }

  const quizzes = {};
  studentScores.forEach(s => {
    if (!quizzes[s.quizId]) quizzes[s.quizId] = [];
    quizzes[s.quizId].push(s);
  });

  container.innerHTML = `
    <ul class="flex flex-col gap-4">
      ${Object.entries(quizzes).map(([quizId, attempts]) => `
        <li class="p-4 rounded-xl flex justify-between items-center" style="background:var(--card-bg);">
          <div>
            <div><strong>Quiz:</strong> ${quizId}</div>
            <div style="color:var(--secondary); font-size:.9rem;">
              Attempts: ${attempts.length}
            </div>
          </div>
          <button onclick="showStudentScoresByQuiz('${quizId}')" class="px-4 py-2 rounded-xl" style="background:var(--primary); color:white;">View</button>
        </li>
      `).join("")}
    </ul>
  `;
}


function populateTeacherStudentScores() {
  const scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  const container = document.getElementById("student-score-container");
  if (!container) return;

  if (!scores.length) {
    container.innerHTML = `
      <div class="dashboard-card p-6 text-center" style="color:var(--secondary);">
        No students have taken any quizzes yet.
      </div>
    `;
    return;
  }

  const quizzes = {};
  scores.forEach(s => {
    if (!quizzes[s.quizId]) quizzes[s.quizId] = [];
    quizzes[s.quizId].push(s);
  });

  container.innerHTML = `
    <div class="dashboard-list">
      ${Object.entries(quizzes).map(([quizId, attempts]) => `
        <div class="dashboard-card overflow-hidden">
          <div class="dashboard-header"
               onclick="toggleQuizSection('${quizId}')">
            <div>
              <strong>📘 ${quizId}</strong>
              <div style="font-size:.85rem; color:var(--secondary);">
                ${attempts.length} student${attempts.length !== 1 ? "s" : ""}
              </div>
            </div>
            <span id="icon-${quizId}">▾</span>
          </div>

          <div id="quiz-${quizId}" class="dashboard-body hidden">
            <div class="dashboard-list">
              ${attempts.map(s => `
  <div class="dashboard-item">
    <div>
      <div class="font-medium">
        ${s.studentName}
        <span style="opacity:.6;">(${s.studentId})</span>
      </div>
      <div style="font-size:.8rem; color:var(--secondary);">
        ${new Date(s.date).toLocaleString()}
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="${
        s.score / s.total >= 0.7 ? "score-good" : "score-bad"
      }">
        ${s.score} / ${s.total}
      </div>

      <button
        onclick="deleteStudentScoreById('${s.id}')"
        class="px-2 py-1 rounded-md text-xs"
        style="background:rgba(239,68,68,.15); color:#dc2626;">
        ✕
      </button>
    </div>
  </div>
`).join("")}

            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function toggleQuizSection(quizId) {
  const section = document.getElementById(`quiz-${quizId}`);
  const icon = document.getElementById(`icon-${quizId}`);
  if (!section) return;

  const hidden = section.classList.toggle("hidden");
  icon.textContent = hidden ? "▾" : "▴";
    const backendUrl = getBackendUrl();

    const res = await fetch(`${backendUrl}/api/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Create ${count} multiple-choice questions about ${topic}. Return JSON {"questions":[{"question":"...","options":["A","B","C","D"],"correct":"B"}]}. Keep options concise.`
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend error: ${errText}`);
    }

    const data = await res.json().catch(() => ({}));
    const qs = data.questions || data.cards || [];

    if (!Array.isArray(qs) || qs.length === 0) {
      throw new Error("AI returned no questions. Check OPENAI_API_KEY on backend.");
    }

    teacherQuestions = qs.slice(0, count).map(q => {
      const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option A", "Option B", "Option C", "Option D"];
      const options = shuffleArray([...opts]);

      const correctText = (q.correct || q.answer || "").trim().toLowerCase();
      let correctIndex = options.findIndex(opt => opt.trim().toLowerCase() === correctText);
      if (correctIndex === -1) correctIndex = 0;
      const correctLetter = String.fromCharCode(65 + correctIndex);

      return {
        question: q.question || q.front || "",
        options,
        correct: correctLetter
      };
    });

    window._teacherTitleDraft = `${topic} Quiz`;

    closeAIQuizModal();
    topicInput.value = "";
    countInput.value = "";

    toast(`✅ ${teacherQuestions.length} AI questions generated!`);

    currentView = "teacher";
    renderApp();
  const scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  if (index < 0 || index >= scores.length) return;
  if (!confirm("Delete this score?")) return;

  scores.splice(index, 1);
  localStorage.setItem("studentQuizScores", JSON.stringify(scores));

  if (currentView === "student-score-history") populateStudentScores();
  else if (currentView === "teacher-view-scores") populateTeacherStudentScores();
}
function clearMyStudentScores() {
  const student = window.currentStudent || JSON.parse(localStorage.getItem("currentStudent") || "{}");
  if (!student || !student.id) {
    toast("Student information missing!");
    return;
  }

  if (!confirm("Delete all your quiz history?")) return;

  const scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  const filtered = scores.filter(s => s.studentId !== student.id);

  localStorage.setItem("studentQuizScores", JSON.stringify(filtered));
  populateStudentScores();
}

function clearAllStudentScores() {
  if (!confirm("This will delete ALL student scores. Continue?")) return;

  localStorage.removeItem("studentQuizScores");
  populateTeacherStudentScores();
}



function showScoresView() {
  renderApp();

  if (currentView === "student-score-history") {
    populateStudentScores();
  }

  if (currentView === "teacher-view-scores") {
    populateTeacherStudentScores();
  }
}

function clearAllStudentScores() {
  if (!confirm("Are you sure you want to delete all your quiz history?")) return;

  localStorage.removeItem("studentQuizScores");
  populateStudentScores(); // refresh view
}

function renderStudentScores() {
  const scores = JSON.parse(localStorage.getItem("studentQuizScores") || "[]");
  const container = document.getElementById("student-score-container");
  if (!container) return;

  if (!scores.length) {
    container.innerHTML = "<p>No quizzes taken yet.</p>";
    return;
  }

  container.innerHTML = `
    <ul class="flex flex-col gap-2">
      ${scores.map(s => `
        <li style="background:var(--card-bg); padding:8px; border-radius:8px;">
          Quiz: ${s.quizId} • Score: ${s.score}/${s.total} • Date: ${new Date(s.date).toLocaleString()}
        </li>
      `).join("")}
    </ul>
  `;
}



function renderStudentScoreHistoryView() {
  return `
    <div class="mobile-optimized w-full h-full p-4">
      <h2 style="font-size:1.25rem; margin-bottom:16px;">📊 Quiz Score History</h2>
      <div id="student-score-container"></div>
      <button onclick="clearMyStudentScores()" class="mt-4 px-4 py-3 rounded-xl quiz-option text-sm" style="background:rgba(239,68,68,.15); color:#dc2626; min-height: 44px;">
      🗑 Clear My Quiz History
      </button>
      <button onclick="currentView='home'; renderApp();" class="mb-4 px-4 py-3 rounded-lg quiz-option text-sm" style="background:var(--primary); color:white; min-height: 44px;">
        ← Back to Home
      </button>
    </div>
  `;
}




function renderTeacherQuizResultView() {
    if (!window._scoreAlreadySaved) {
    saveQuizScoreNow();
    window._scoreAlreadySaved = true;
  }

  if (!teacherQuizData || !teacherQuizData.questions) {
    console.warn("Teacher quiz result rendered without data");
    currentView = "home";
    return renderHomeView();
  }

  const questions = teacherQuizData.questions;
  const totalQuestions = questions.length;
  const correctAnswers = questions.reduce((count, q, index) => {
    return count + (confirmedAnswers[index] === q.correct ? 1 : 0);
  }, 0);
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;

  // Performance assessment
  let performanceLevel, performanceColor, performanceBg, emoji, message;
  if (percentage >= 90) {
    performanceLevel = "Outstanding!";
    performanceColor = "#22c55e";
    performanceBg = "from-green-400 to-green-600";
    emoji = "🏆";
    message = "Excellent work! You've mastered this quiz.";
  } else if (percentage >= 80) {
    performanceLevel = "Great Job!";
    performanceColor = "#3b82f6";
    performanceBg = "from-blue-400 to-blue-600";
    emoji = "🎉";
    message = "Well done! You're doing fantastic.";
  } else if (percentage >= 70) {
    performanceLevel = "Good Work!";
    performanceColor = "#f59e0b";
    performanceBg = "from-yellow-400 to-orange-500";
    emoji = "👍";
    message = "Not bad! Keep practicing to improve.";
  } else if (percentage >= 60) {
    performanceLevel = "Keep Trying!";
    performanceColor = "#f97316";
    performanceBg = "from-orange-400 to-red-500";
    emoji = "💪";
    message = "You're on the right track. Study more and try again.";
  } else {
    performanceLevel = "Need More Practice";
    performanceColor = "#ef4444";
    performanceBg = "from-red-400 to-red-600";
    emoji = "📚";
    message = "Don't give up! Review the material and try again.";
  }

  return `
    <div class="mobile-optimized w-full h-full overflow-auto bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-slate-900 dark:to-purple-900">
      <div class="min-h-full flex flex-col p-4">
        <div class="max-w-4xl mx-auto fade-in w-full">

          <!-- Header -->
          <div class="text-center mb-6">
            <button onclick="exitTeacherQuiz()"
              class="group px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95 mb-4 quiz-option"
              style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 48px;">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Back to Menu
              </span>
            </button>

            <h1 class="text-3xl md:text-4xl font-bold mb-2" style="color:${text};">
              Quiz Results
            </h1>
            <p class="text-lg" style="color:${config.secondary_color};">${teacherQuizData.title || 'Teacher Quiz'}</p>
          </div>

          <!-- Score Overview Card -->
          <div class="backdrop-blur-md bg-white/90 dark:bg-slate-800/90 rounded-3xl p-6 shadow-2xl border border-white/30 text-center mb-6 transform hover:scale-[1.02] transition-all duration-300">

            <!-- Celebration Emoji -->
            <div class="text-4xl mb-4 animate-bounce">${emoji}</div>

            <h2 class="text-2xl md:text-3xl font-bold mb-2" style="color:${text};">
              ${performanceLevel}
            </h2>

            <p class="text-sm mb-6" style="color: ${performanceColor}; font-weight: 600;">
              ${message}
            </p>

            <!-- Score Display -->
            <div class="relative mb-6">
              <div class="w-36 h-36 mx-auto rounded-full bg-gradient-to-br ${performanceBg} flex items-center justify-center shadow-2xl relative overflow-hidden">
                <div class="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                <div class="relative z-10 text-white">
                  <div class="text-3xl font-bold mb-1">${correctAnswers}</div>
                  <div class="text-lg opacity-90">/ ${totalQuestions}</div>
                </div>

                <!-- Circular progress ring -->
                <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.2)" stroke-width="8" fill="none"/>
                  <circle cx="50" cy="50" r="45" stroke="white" stroke-width="8" fill="none"
                          stroke-dasharray="${2 * Math.PI * 45}"
                          stroke-dashoffset="${2 * Math.PI * 45 * (1 - percentage/100)}"
                          class="transition-all duration-1000 ease-out"/>
                </svg>
              </div>

              <!-- Percentage Badge -->
              <div class="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                <span class="text-lg font-bold" style="color: ${performanceColor};">${percentage}%</span>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-3 gap-3 mb-6">
              <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
                <div class="text-xl font-bold" style="color: ${performanceColor};">${correctAnswers}</div>
                <div class="text-xs" style="color:${text}; opacity: 0.8;">Correct</div>
              </div>
              <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
                <div class="text-xl font-bold" style="color: ${performanceColor};">${totalQuestions - correctAnswers}</div>
                <div class="text-xs" style="color:${text}; opacity: 0.8;">Incorrect</div>
              </div>
              <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
                <div class="text-xl font-bold" style="color: ${performanceColor};">${percentage}%</div>
                <div class="text-xs" style="color:${text}; opacity: 0.8;">Score</div>
              </div>
            </div>
          </div>

          <!-- Detailed Results -->
          <div class="space-y-4">
            <h3 class="text-xl font-bold text-center mb-4" style="color:${text};">Question Review</h3>

            ${questions.map((q, index) => {
              const userAnswer = confirmedAnswers[index];
              const isCorrect = userAnswer === q.correct;
              const letters = ["A", "B", "C", "D"];

              return `
                <div class="backdrop-blur-md bg-white/95 dark:bg-slate-800/95 rounded-2xl p-4 shadow-xl border border-white/30 transform hover:scale-[1.01] transition-all duration-300">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white">
                      ${index + 1}
                    </div>
                    <div class="flex-1">
                      <h4 class="text-base font-semibold mb-2" style="color:${text};">${q.question}</h4>

                      <div class="grid gap-2">
                        ${q.options.map((opt, optIndex) => {
                          const letter = letters[optIndex];
                          const isUserChoice = userAnswer === letter;
                          const isCorrectChoice = q.correct === letter;

                          let optionStyle = `background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text};`;

                          if (isCorrectChoice) {
                            optionStyle = `background: linear-gradient(135deg, #22c55e, #16a34a); color: var(--on-primary, var(--text));`;
                          } else if (isUserChoice && !isCorrect) {
                            optionStyle = `background: linear-gradient(135deg, #ef4444, #dc2626); color: var(--on-primary, var(--text));`;
                          }

                          return `
                            <div class="flex items-center gap-2 p-2 rounded-lg text-sm" style="${optionStyle}">
                              <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-white/20">
                                ${letter}
                              </div>
                              <div class="flex-1 font-medium">${opt}</div>
                              ${isCorrectChoice ? '<div class="text-green-200 text-sm">✓</div>' : ''}
                              ${isUserChoice && !isCorrect ? '<div class="text-red-200 text-sm">✗</div>' : ''}
                            </div>
                          `;
                        }).join("")}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-3 mt-6">
            <button onclick="exitTeacherQuiz()"
              class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl quiz-option"
              style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 48px;">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                </svg>
                Back to Menu
              </span>
            </button>

            <button onclick="startTeacherQuiz()"
              class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl quiz-option"
              style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: var(--on-primary, var(--text)); border: 2px solid rgba(255,255,255,0.2); min-height: 48px;">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Retake Quiz
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  `;
}

function renderTeacherViewScores() {
  return `
    <div class="w-full h-full p-6">
      <button onclick="currentView='teacher'; renderApp();" 
        class="mb-4 px-4 py-2 rounded-lg" 
        style="background:var(--primary); color:white;">
        ← Back
      </button>
      <h2 style="font-size:1.5rem; margin-bottom:16px;">📊 Student Quiz Scores</h2>
      <div id="student-score-container"></div>
      <button onclick="clearAllStudentScores()"
      class="mt-4 px-4 py-2 rounded-xl"
      style="background:rgba(239,68,68,.15); color:#dc2626;">
      🗑 Clear ALL Student Scores
      </button>
    </div>
  `;
}



function exitTeacherQuiz() {
  quizQuestions = [];
  quizIndex = 0;
  quizScore = 0;
  isQuizPreview = false;

  currentView = "home";
  renderApp();
}






const savedDuration = parseInt(localStorage.getItem("studyTimerDuration"), 10);
if (!isNaN(savedDuration) && savedDuration > 0) {
  studyTimer.duration = savedDuration;
  studyTimer.remaining = savedDuration;
}


function applyUserSettings() {
  const s = userSettings;
  const r = document.documentElement.style;

  // Colors
  r.setProperty("--primary", s.colors.primary);
  r.setProperty("--background", s.colors.background);
  r.setProperty("--card-bg", s.colors.card);
  r.setProperty("--text", s.colors.text);

  // Fonts
  r.setProperty("--font-family", s.font.family);
  r.setProperty("--font-size", `${s.font.size}px`);
  r.setProperty("--line-height", s.font.lineHeight);

  // UI Dimensions
  r.setProperty("--radius", `${s.layout.radius}px`);
  document.documentElement.dataset.cardSize = s.layout.cardSize;
  document.documentElement.dataset.anim = s.layout.animation;

  // Background logic (clean & correct)
  if (s.backgroundImage) {
    r.setProperty("--background-image", s.backgroundImage);
    document.body.style.backgroundImage = s.backgroundImage;
    document.body.style.backgroundColor = "transparent";
  } else {
    r.setProperty("--background-image", "none");
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = s.colors.background;
  }

  // Save settings
  localStorage.setItem("userSettings", JSON.stringify(s));
}

let userSettings = loadSettings();
applyUserSettings();

function saveAndApplySettings() {
  localStorage.setItem("userSettings", JSON.stringify(userSettings));
  applyUserSettings();
}


function loadSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem("userSettings"))
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function closeSettings() {
  const overlay = document.querySelector('.settings-overlay');
  if (overlay) {
    overlay.remove();
  }
}


function renderCustomizationPanel() {
  return `
  <div id="settingsMenu" 
  style="
    position:relative;
    padding:20px;
  "
>
<button id="closeSettingsBtn" onclick="closeSettings()"
  style="
    position:absolute;
    top:10px;
    right:10px;
    background:none;
    border:none;
    font-size:22px;
    cursor:pointer;
    padding:4px 8px;
  "
>✕</button>

<div class="settings-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
  <h2 style="margin:0;font-size:1.2rem;font-weight:600;">🎨 Customize Interface</h2>
</div>


<div class="settings-group">
  <label class="setting-label">View Mode</label>
  <select onchange="setLayoutMode(this.value)">
    <option value="auto">Auto (Based on screen size)</option>
    <option value="mobile">Mobile View</option>
    <option value="desktop">Desktop View</option>
  </select>
</div>

    <!-- PRIMARY COLOR -->
<div class="settings-group">
  <label>
    <span>Primary Color</span>
    <input
      type="color"
      value="${userSettings.colors.primary}"
      onchange="updateSetting('colors.primary', this.value)"
    />
  </label>
</div>

<div class="settings-group">
  <label>
    <span>Background Color</span>
    <input
      type="color"
      value="${userSettings.colors.background}"
      onchange="updateSetting('colors.background', this.value)"
    />
  </label>
</div>

<div class="settings-group">
  <label>
    <span>Card Color</span>
    <input
      type="color"
      value="${userSettings.colors.card}"
      onchange="updateSetting('colors.card', this.value)"
    />
  </label>
</div>

<div class="settings-group">
  <label>
    <span>Text Color</span>
    <input
      type="color"
      value="${userSettings.colors.text}"
      onchange="updateSetting('colors.text', this.value)"
    />
  </label>
</div>

<div class="settings-group">
  <label>
    <span>Choose Palette</span>
<h3 class="mt-4 mb-2 font-semibold">Color Palettes</h3>
<div class="palette-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
  ${Object.keys(COLOR_PALETTES).map(p => `
    <div class="palette-item"
      onclick="applyPalette('${p}')"
      style="
        cursor:pointer;
        border-radius:8px;
        height:45px;
        border:2px solid #fff;
        display:flex;overflow:hidden;
      "
    >
      <div style="flex:1;background:${COLOR_PALETTES[p].primary}"></div>
      <div style="flex:1;background:${COLOR_PALETTES[p].background}"></div>
      <div style="flex:1;background:${COLOR_PALETTES[p].card}"></div>
    </div>
  `).join("")}
</div>
  </label>
</div>


    <!-- FONT FAMILY -->
    <div class="settings-group">
      <label>
        <span>Font</span>
        <select onchange="updateSetting('font.family', this.value)">
          ${[
      "BBHBartle", "BBHBorgle", "BBHHegarty",
      "Open Sans", "Open Sans Italic",
      "Google Sans", "Google Sans Italic",
      "Playfair Display", "Playfair Display Italic",
      "Roboto", "Roboto Italic", "Orbitron"
    ].map(f => `
            <option ${userSettings.font.family === f ? "selected" : ""}>
              ${f}
            </option>
          `).join("")}
        </select>
      </label>
    </div>

    <!-- FONT SIZE -->
    <div class="settings-group">
      <label>
        <span>Font Size</span>
        <input
          type="range"
          min="12"
          max="22"
          value="${userSettings.font.size}"
          onchange="updateSetting('font.size', this.value)"
        />
      </label>
    </div>

    <!-- CORNER RADIUS -->
    <div class="settings-group">
      <label>
        <span>Corner Radius</span>
        <input
          type="range"
          min="8"
          max="28"
          value="${userSettings.layout.radius}"
          onchange="updateSetting('layout.radius', this.value)"
        />
      </label>
    </div>
    <div class="settings-group">
<button onclick="resetSettings()" class="reset-btn">
  Reset to Default
</button>
    </div>
    </div>
  `;
}

function resetSettings() {
  userSettings = structuredClone(DEFAULT_SETTINGS);
  saveAndApplySettings();
}

function setLayoutMode(mode) {
  userSettings.layoutMode = mode;
  applyUserSettings();
  renderApp();
}

function applyPalette(key){
  const p = COLOR_PALETTES[key];
  if(!p) return;

  userSettings.colors.primary = p.primary;
  userSettings.colors.background = p.background;
  userSettings.colors.card = p.card;
  userSettings.colors.text = p.text;

  saveAndApplySettings();
}


document.addEventListener("click", e => {
  if (document.querySelector(".settings-overlay")) return;

  const btn = e.target.closest("#openSettingsBtn");
  if (!btn) return;

  const overlay = document.createElement("div");
  overlay.className = "settings-overlay";

  overlay.innerHTML = `
    <div class="settings-modal">
      ${renderCustomizationPanel()}
    </div>
  `;

  document.body.appendChild(overlay);

  // ✅ Trigger animation AFTER mount
  requestAnimationFrame(() => {
    overlay.classList.add("open");
  });

  overlay.addEventListener("click", ev => {
    if (ev.target === overlay) overlay.remove();
  });

  overlay.querySelector("#closeSettingsBtn")?.addEventListener("click", () => {
    overlay.remove();
  });
});





function updateSetting(path, value) {
  const keys = path.split(".");
  let obj = userSettings;

  while (keys.length > 1) {
    obj = obj[keys.shift()];
  }

  obj[keys[0]] = isNaN(value) ? value : Number(value);

  saveAndApplySettings();
}

function applyThemePreset(themeKey) {
  const theme = THEME_PRESETS[themeKey];
  if (!theme) return;

  userSettings.colors = theme.colors;
  userSettings.font = theme.font || userSettings.font;
  userSettings.backgroundImage = theme.backgroundImage || null;
  userSettings.theme = themeKey;

  // Save to localStorage
  localStorage.setItem("selectedTheme", themeKey);
  saveAndApplySettings(); // this should call applyUserSettings()
}

const savedTheme = localStorage.getItem("selectedTheme");

if (savedTheme) {
  applyThemePreset(savedTheme);    // Set settings first
} else {
  saveAndApplySettings();          // Default fallback settings
}


function deepMerge(target, source) {
  const output = structuredClone(target);

  for (const key in source) {
    if (typeof source[key] === "object" && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

const emojiOptions = ['📚', '🧪', '🎨', '💻', '🌍', '📐', '🎵', '⚽', '🔬', '📖', '🎭', '🏛️', '💼', '🍎', '🚀', '🎯', '💡', '🔧', '🌟', '🎪'];

const dataHandler = {
  onDataChanged(data) {
    allData = data;
    renderApp();
  }
};

function getSubjects() {
  const subjectMap = new Map();
  allData.filter(item => item.type === 'subject').forEach(subject => {
    subjectMap.set(subject.subject_id, subject);
  });
  return Array.from(subjectMap.values());
}

function getSetsForSubject(subjectId) {
  const setMap = new Map();
  allData.filter(item => item.type === 'set' && item.subject_id === subjectId).forEach(set => {
    setMap.set(set.set_id, set);
  });
  return Array.from(setMap.values());
}

function getCardsForSet(setId) {
  return allData.filter(item => item.type === 'card' && item.set_id === setId);
}

function renderApp() {
  const app = document.getElementById("app");
  let content = "";

  if (currentView === "login") {
    content = renderLoginView();
  } else if (currentView === "home") {
    content = renderHomeView();
  } else if (currentView === "browse") {
    content = renderBrowseView();
  } else if (currentView === "browse-study") {
    content = renderBrowseStudyView();
  } else if (currentView === "browse-quiz") {
    content = renderBrowseQuizView();
  } else if (currentView === "browse-cards") {
    content = renderBrowseCardsView();
  } else if (currentView === "themes") {
    content = renderThemesView();
  } else if (currentView === "pdfs") {
    content = renderPdfsView();
  } else if (currentView === "pdf-viewer") {
    content = renderPdfViewerView();
  } else if (currentView === "teacher") {
    content = renderTeacherView();
  } else if (currentView === "student") {
    content = renderStudentView();
  } else if (currentView === "student-score-history") {
    content = renderStudentScoreHistoryView();
  } else if ( currentView === "teacher-quiz-list") {
    content = renderTeacherQuizListView();
  } else if (currentView === "teacher-quiz") {
    content = renderTeacherQuizView();
  } else if (currentView === "teacher-quiz-result") {
    content = renderTeacherQuizResultView();
  } else if (currentView === "teacher-view-scores") {
    content = renderTeacherViewScores();
    setTimeout(() => populateTeacherStudentScores(window._teacherSelectedQuizId), 0);
  } else if (currentView === "subjects") {
    content = renderSubjectsView();
  } else if (currentView === "sets") {
    content = renderSetsView();
  } else if (currentView === "cards") {
    content = renderCardsView();
  } else if (currentView === "study") {
    content = renderStudyView();
  } else if (currentView === "quiz") {
    content = renderQuizView();
  } else if (currentView === "class-quiz") {
    content = renderClassQuizView();
  } else if (currentView === "quiz-result") {
    content = renderQuizResultView();
  } else if (currentView === "customize") {
    content = renderCustomizationPanel();
  }

  app.innerHTML = content;

  if (currentView === "teacher") bindTeacherViewEvents();
  
  if (currentView === "student") {
    // Load student quiz attempts from backend
    loadStudentQuizAttemptsFromBackend().catch(err => {
      console.log("Failed to load attempts from backend:", err);
    });
  }

  attachEventListeners();

  if (currentView === "quiz") updateTimerUI();

  if (currentView === "pdf-viewer") {
    app.innerHTML = renderPdfViewerView();
    
    requestAnimationFrame(() => {
      if (window.currentPdf?.url) {
        openPdfViewer(window.currentPdf.url);
      }
    });
  }

  if (currentView === "student-score-history") {
    populateStudentScores();
  }

  if (currentView === "cards" || currentView === "browse-cards") {
    attachCardsViewListeners();
  }

  const showBottomNav = ["home", "browse", "pdfs", "themes"].includes(currentView);
  document.body.classList.toggle("bottom-nav-visible", showBottomNav);

  if (showBottomNav) {
    app.innerHTML += renderBottomNav();
  }

  if (currentView === "browse-study") {
    setTimeout(() => {
     const card = currentBrowseSetCards[currentBrowseCardIndex];
      const answerEl = document.getElementById("answerMath");

      if (answerEl && card?.answer?.mathml) {
       answerEl.innerHTML = card.answer.mathml;

       // Optional MathJax support
       if (window.MathJax) {
         MathJax.typesetPromise([answerEl]);
       }
      }
    }, 0);
  }
}

function renderSubjectsView() {
  const subjects = getSubjects();

  const subjectsHTML = subjects.map(subject => {
    const sets = getSetsForSubject(subject.subject_id);

    return `
      <div class="category-card card-touch relative p-6 rounded-2xl shadow-sm flex flex-col items-center text-center quiz-option" style="background: var(--card-bg); box-shadow: 0 4px 12px rgba(37,99,235,0.3); color: var(--text);"
           data-subject-id="${subject.subject_id}">

        <button
          class="delete-subject-btn absolute top-3 right-3 text-gray-500 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-full"
          data-subject-id="${subject.subject_id}"
          aria-label="Delete subject"
          style="min-height: 32px; min-width: 32px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);"
        >
          ×
        </button>

        <div class="category-icon mb-4 w-20 h-20 flex items-center justify-center rounded-full" style="background: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.08); color: var(--text);">
          ${subject.subject_icon}
        </div>

        <div class="category-meta">
          <h2 class="category-title text-xl font-semibold mb-2" style="color: var(--text);">${subject.subject_name}</h2>
          <p class="category-subtitle text-base text-gray-500">
            ${sets.length} set${sets.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="subjects-view mobile-optimized w-full h-full overflow-auto p-4">
      <div class="max-w-4xl mx-auto">

        <button id="backToHomeBtn" class="mb-4 px-6 py-3 rounded-lg quiz-option"
                style="background: var(--card-bg); color: var(--text); font-size: var(--font-size); min-height: 48px;">
          ← Back
        </button>

        <div class="subjects-hero mb-6 text-center">
          <h1 class="subjects-title text-2xl font-bold">${config.app_title || defaultConfig.app_title}</h1>
          <p class="subjects-subtitle text-gray-500 mt-1 text-base">${config.app_subtitle || defaultConfig.app_subtitle}</p>
        </div>

        <div class="subjects-actions mb-6 text-center">
          <button id="addSubjectBtn" class="px-6 py-3 rounded-xl shadow-md quiz-option"
                  style="color: var(--primary); font-size: calc(var(--font-size) * 1.1); background: var(--card-bg); box-shadow: 0 4px 12px rgba(37,99,235,0.3); min-height: 48px;">
            + Add New Subject
          </button>
        </div>

        ${subjects.length === 0
          ? `<div class="subjects-empty text-center text-gray-500 py-12">
               No subjects yet. Create your first subject to get started!
             </div>`
          : `<div class="subjects-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               ${subjectsHTML}
             </div>`
        }

      </div>
    </div>
  `;
}


function openSubject(subjectId) {
  currentSubjectId = subjectId;
  currentSubject = getSubjects().find(s => s.subject_id === subjectId);
  currentSet = null; 
  currentView = "sets";
  renderApp();
}


function renderSetsView() {
  if (!currentSubject || !currentSubject.subject_id) {
    currentView = 'subjects';
    renderApp();
    return '';
  }

  const sets = getSetsForSubject(currentSubject.subject_id);
  const subtitleColor = config.secondary_color || defaultConfig.secondary_color;

  const setsHTML = sets.map(set => {
    const cards = getCardsForSet(set.set_id);
    return `
      <div class="category-card card-touch p-6 rounded-2xl quiz-option" data-set-id="${set.set_id}" 
           style="background: var(--card-bg); box-shadow: 0 4px 12px rgba(0,0,0,0.08); position: relative;">
        
        <button class="delete-set-btn" data-set-id="${set.set_id}" 
                style="position: absolute; top: 0.75rem; right: 0.75rem; color: ${subtitleColor}; font-size: calc(var(--font-size) * 1.2);
                       background: none; border: none; cursor: pointer; padding: 0.5rem; line-height: 1; min-height: 32px; min-width: 32px;"
                class="w-8 h-8 flex items-center justify-center rounded-full">
          ×
        </button>

        <h3 style="font-size: calc(var(--font-size) * 1.3); font-weight: 500; color: var(--text); margin-bottom: 0.5rem;">
          ${set.set_name}
        </h3>
        <p style="font-size: calc(var(--font-size) * 0.875); color: ${subtitleColor};">
          ${cards.length} card${cards.length !== 1 ? 's' : ''}
        </p>

        ${cards.length > 0 ? `
          <button class="study-set-btn mt-4 px-6 py-3 rounded-lg quiz-option" data-set-id="${set.set_id}" 
                  style="background: var(--primary); color: var(--on-primary, var(--text)); font-size: calc(var(--font-size) * 0.875); min-height: 48px;">
            Study Now
          </button>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="mobile-optimized w-full h-full overflow-auto">
      <div class="min-h-full flex flex-col p-4">
        <div class="max-w-4xl w-full mx-auto">

          <!-- Header -->
                <div class="mb-4">
        <button id="backToSubjectsBtn" class="px-6 py-3 rounded-lg quiz-option"
                style="background: var(--card-bg); color: var(--text); font-size: var(--font-size); min-height: 48px;">
          ← Back
        </button>
      </div>

      <!-- Centered Title + Icon -->
      <div class="text-center mb-8 slide-in">
        <div style="font-size: calc(var(--font-size) * 2); margin-bottom: 0.25rem;">
          ${currentSubject.subject_icon}
        </div>
        <h2 style="font-size: calc(var(--font-size) * 1.8); font-weight: 500; color: var(--text);">
          ${currentSubject.subject_name}
        </h2>
      </div>

          <!-- Add Set Button -->
          <div class="mb-6">
            <button id="addSetBtn" class="w-full py-5 rounded-xl transition-all font-semibold quiz-option"
                    style="background: var(--primary); color: var(--on-primary, var(--text)); font-size: calc(var(--font-size) * 1.1); box-shadow: 0 4px 12px rgba(37,99,235,0.3); min-height: 56px;">
              + Add New Set
            </button>
          </div>

          <!-- Sets Grid -->
          ${sets.length === 0 ? `
            <div class="text-center py-12" style="color: ${subtitleColor}; font-size: calc(var(--font-size) * 1.2);">
              No sets yet. Create your first set!
            </div>
          ` : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${setsHTML}</div>`}
        </div>
      </div>
    </div>
  `;
}

function openSet(setId) {
  if (!currentSubject) return;
  const sets = getSetsForSubject(currentSubject.subject_id);
  currentSet = sets.find(s => s.set_id === setId);
  currentView = "cards";
  renderApp();
}

function renderCardsView() {
  // If no set is selected, go back to sets view
  if (!currentSet || !currentSet.set_id) {
    currentView = "sets";
    renderApp();
    return "";
  }

  const cards = getCardsForSet(currentSet.set_id);

  const cardsHTML = cards.map(card => `
    <div class="card-item card-touch p-6 rounded-xl shadow-sm relative quiz-option" style="background: var(--card-bg);">

      <button
        class="card-delete-btn absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
        data-id="${card.id}"
        aria-label="Delete card"
        style="background: rgba(239, 68, 68, 0.1); border: none; cursor: pointer; min-height: 32px; min-width: 32px;"
      >
        <img src="icons/delete.svg" class="icon sm" />
      </button>

      <div class="card-section mt-2">
        <p class="card-label font-semibold text-base mb-2">Question</p>
        <p class="card-text card-question text-base leading-relaxed">${card.question}</p>
      </div>

      <div class="card-section mt-4">
        <p class="card-label font-semibold text-base mb-2">Answer</p>
        <p class="card-text card-answer text-base leading-relaxed">${card.answer}</p>
      </div>
    </div>
  `).join("");

  return `
    <div class="view-container mobile-optimized w-full h-full overflow-auto">
      <div class="view-content max-w-4xl mx-auto p-4">
        <div class="view-inner">
              <div class="mb-4">
        <button id="backToSetsBtn"
                class="px-6 py-3 rounded-lg quiz-option"
                style="background: var(--card-bg); color: var(--text); font-size: var(--font-size); min-height: 48px;">
          ← Back
        </button>
      </div>

      <!-- HEADER CENTERED -->
      <div class="text-center mb-6 slide-in">
        <h2 class="text-xl font-semibold">${currentSet.set_name}</h2>
        <p class="text-sm opacity-70">${cards.length} card${cards.length !== 1 ? "s" : ""}</p>
      </div>

          <!-- ACTIONS -->
          <div class="cards-actions mb-6">
          <div class="actions-inner grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <button id="addCardBtn" class="action-btn quiz-option py-4 px-3 rounded-lg text-center"
                    style="background: var(--primary); color: var(--on-primary, var(--text)); min-height: 56px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <img src="icons/add.svg" class="icon md" />
              <span class="text-sm">Add</span>
            </button>

            <button id="aiGenerateBtn" class="action-btn quiz-option py-4 px-3 rounded-lg text-center"
                    style="background: var(--secondary); color: var(--on-primary, var(--text)); min-height: 56px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <img src="icons/ai.svg" class="icon md" />
              <span class="text-sm">AI</span>
            </button>

            <button id="importCardsJsonBtn" class="action-btn quiz-option py-4 px-3 rounded-lg text-center"
                    style="background: var(--accent); color: var(--on-primary, var(--text)); min-height: 56px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <img src="icons/import.svg" class="icon md" />
              <span class="text-sm">Import</span>
            </button>

            ${cards.length > 0 ? `
              <button id="studyCardsBtn" class="action-btn quiz-option py-4 px-3 rounded-lg text-center"
                      style="background: var(--success); color: var(--on-primary, var(--text)); min-height: 56px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <img src="icons/flashcard.svg" class="icon md" />
                <span class="text-sm">Study</span>
              </button>` : ""}

            ${cards.length > 1 ? `
              <button id="quizCardsBtn" class="action-btn quiz-option py-4 px-3 rounded-lg text-center"
                      style="background: var(--warning); color: var(--on-primary, var(--text)); min-height: 56px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <img src="icons/quiz.svg" class="icon md" />
                <span class="text-sm">Quiz</span>
              </button>` : ""}
              </div>
          </div>

          <!-- EMPTY STATE / LIST -->
          ${cards.length === 0 ? `
            <div class="cards-empty text-center py-12 text-gray-500">
              <p class="text-lg">No cards yet. Add your first flashcard!</p>
            </div>` : `
            <div class="cards-list grid grid-cols-1 md:grid-cols-2 gap-4">
              ${cardsHTML}
            </div>`}

        </div>
      </div>
    </div>
  `;
}

function attachCardsViewListeners() {
  const addCardBtn = document.getElementById('addCardBtn');
  if (addCardBtn) {
    addCardBtn.addEventListener('click', () => {
      showAddCardModal(); // Opens your modal to add a card
    });
  }

  const aiGenerateBtn = document.getElementById('aiGenerateBtn');
  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener('click', () => {
      showAIGenerateModal(); // Opens AI card generation modal
    });
  }

  const importCardsJsonBtn = document.getElementById('importCardsJsonBtn');
  if (importCardsJsonBtn) {
    importCardsJsonBtn.addEventListener('click', () => {
      importCardsFromJsonForCurrentSet(); // Handles JSON import
    });
  }

  const studyCardsBtn = document.getElementById('studyCardsBtn');
  if (studyCardsBtn) {
    studyCardsBtn.addEventListener('click', () => {
      currentCardIndex = 0;
      isFlipped = false;
      currentView = 'study';
      renderApp();
    });
  }

  const quizCardsBtn = document.getElementById('quizCardsBtn');
  if (quizCardsBtn) {
    quizCardsBtn.addEventListener('click', () => {
      const cards = getCardsForSet(currentSet.set_id);
      quizQuestions = generateQuizQuestions(cards);
      quizIndex = 0;
      quizScore = 0;
      resetStudyTimer(); // if applicable
      currentView = 'quiz';
      renderApp();
    });

      const deleteCardBtns = document.querySelectorAll('.card-delete-btn');
  deleteCardBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent parent clicks
      const cardId = btn.dataset.id;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

      // Delete the card (replace with your actual delete logic)
      await window.dataSdk.delete({ id: cardId });

      // Re-render the cards view
      renderApp();
    });
  });
  }

  // Back button to sets
  const backToSetsBtn = document.getElementById('backToSetsBtn');
  if (backToSetsBtn) {
    backToSetsBtn.addEventListener('click', () => {
      currentSet = null;
      currentView = 'sets';
      renderApp();
    });
  }
}

function startStudyTimer() {
  if (studyTimer.running) return;

  stopStudyTimer(); // ✅ safety clear

  studyTimer.running = true;
  studyTimer.startTime = Date.now();

  studyTimer.interval = setInterval(() => {
    studyTimer.remaining--;

    if (studyTimer.remaining <= 0) {
      studyTimer.remaining = 0;
      stopStudyTimer();
      currentView = "quiz-result";
      renderApp();
      return;
    }

    updateTimerUI();
  }, 1000);
}



function stopStudyTimer() {
  clearInterval(studyTimer.interval);
  studyTimer.interval = null;
  studyTimer.running = false;
}

function resetStudyTimer() {
  stopStudyTimer();
  studyTimer.remaining = studyTimer.duration;
  
  updateTimerUI();
}


function updateTimerUI() {
  const el = document.getElementById("study-timer");
  if (!el) return;

  el.textContent = formatTime(studyTimer.remaining);

  const clock = document.getElementById("floating-timer");

if (studyTimer.remaining <= 60) {
  clock.style.background = config.primary_color;
  clock.style.color = "#fff";
} else {
  clock.style.background = config.card_background;
  clock.style.color = config.primary_color;
}

}



function applyTimerSettings() {
  if (studyTimer.running) {
    stopStudyTimer();
  }

  const h = parseInt(document.getElementById("timer-hours")?.value) || 0;
  const m = parseInt(document.getElementById("timer-minutes")?.value) || 0;

  const total = h * 3600 + m * 60;
  if (total <= 0) return;

  studyTimer.duration = total;
  studyTimer.remaining = total;
  localStorage.setItem("studyTimerDuration", total);

  updateTimerUI();
}



function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toggleFloatingTimer() {
  const el = document.getElementById("floating-timer");
  if (!el) return;

  el.style.display =
    currentView === "quiz" || currentView === "study"
      ? "flex"
      : "none";
}


function renderStudyView() {
  const cards = getCardsForSet(currentSet.set_id);
  if (cards.length === 0) {
    currentView = 'cards';
    renderApp();
    return;
  }

  const card = cards[currentCardIndex];
  const subtitleColor = config.secondary_color || defaultConfig.secondary_color;
  const progress = ((currentCardIndex + 1) / cards.length) * 100;

  return `
        <div class="mobile-optimized w-full h-full overflow-auto">
          <div class="min-h-full flex flex-col p-4">
            <div class="max-w-3xl w-full mx-auto flex flex-col" style="height: 100%;">
                                      <button id="backToCardsBtn" class="mb-4 px-6 py-3 rounded-lg quiz-option" style="width:80px; background: var(--card-bg); color: var(--text); font-size: var(--font-size); min-height: 48px;">
                  ← Back
                </button>
<div class="flex flex-col items-center mb-6 slide-in text-center">
  <h2 style="font-size: calc(var(--font-size) * 1.5); font-weight: 400; color: var(--text);">
    ${currentSet.set_name}
  </h2>
<p style="opacity:0.8;font-size: calc(var(--font-size)*0.95); margin-top:4px;">
  <span style="color:var(--primary); font-weight:600;" id="card-counter">${currentCardIndex + 1}</span>
  <span style="color: var(--text);"> / ${cards.length}</span>
</p>

</div>


              <div class="w-full rounded-full mb-6" style="background: rgba(0,0,0,0.1); height: 5px;">
                <div class="progress-bar h-full rounded-full transition-all duration-300" id="progress-bar" style="width: ${progress}%; background: var(--primary);"></div>
              </div>

              <div class="flex-1 flex items-center justify-center mb-6">
                <div class="card-3d w-full" style="max-width: 600px; height: 400px;">
                  <div id="cardInner" class="card-inner">
                    <div class="card-front" style="background: var(--card-bg); box-shadow: 0 8px 24px rgba(0,0,0,0.12);">
                      <div class="text-center">
                        <p style="font-size: calc(var(--font-size) * 1);

 color: var(--primary); font-weight: 400; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 1rem;">Question</p>
                        <p style="font-size: calc(var(--font-size) * 1.75);

 color: var(--text); font-weight: 400; line-height: 1.6;" id="card-question">${card.question}</p>
                      </div>
                    </div>
                    <div class="card-back" style="background: var(--primary);">
                      <div class="text-center">
                        <p style="font-size: calc(var(--font-size) * 1);

 color: rgba(255,255,255,0.9); font-weight: 400; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 1rem;">Answer</p>
                        <p style="font-size: calc(var(--font-size) * 1.75);

 color: var(--on-primary, var(--text)); font-weight: 400; line-height: 1.6;" id="card-answer">${card.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-4">
                <button id="flipBtn" class="w-full py-5 rounded-xl transition-all font-semibold quiz-option" style="background: var(--primary); color: var(--on-primary, var(--text)); font-size: calc(var(--font-size) * 1.1);
 box-shadow: 0 4px 12px rgba(37,99,235,0.3); min-height: 56px;">
                  Flip Card
                </button>

                <div class="flex gap-4">
                  <button id="prevBtn" class="flex-1 py-4 rounded-xl transition-all quiz-option" style="background: var(--card-bg); color: var(--text); font-size: var(--font-size);
 box-shadow: 0 2px 8px rgba(0,0,0,0.08); min-height: 48px;" ${currentCardIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                  </button>
                  <button id="nextBtn" class="flex-1 py-4 rounded-xl transition-all quiz-option" style="background: var(--card-bg); color: var(--text); font-size: var(--font-size);
 box-shadow: 0 2px 8px rgba(0,0,0,0.08); min-height: 48px;" ${currentCardIndex === cards.length - 1 ? 'disabled' : ''}>
                    Next →
                  </button>
                </div>
            </div>
          </div>
        </div>
      `;
}

// Efficient flashcard navigation without full re-render
function updateFlashcardContent() {
  const cards = getCardsForSet(currentSet?.set_id || []);
  if (cards.length === 0 || currentCardIndex >= cards.length) return;

  const card = cards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / cards.length) * 100;

  // Update card content
  const questionEl = document.getElementById('card-question');
  const answerEl = document.getElementById('card-answer');
  const counterEl = document.getElementById('card-counter');
  const progressBarEl = document.getElementById('progress-bar');

  if (questionEl) questionEl.textContent = card.question;
  if (answerEl) answerEl.textContent = card.answer;
  if (counterEl) counterEl.textContent = currentCardIndex + 1;
  if (progressBarEl) progressBarEl.style.width = `${progress}%`;

  // Update navigation buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    const isDisabled = currentCardIndex === 0;
    prevBtn.disabled = isDisabled;
    prevBtn.style.opacity = isDisabled ? '0.5' : '1';
    prevBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
  }

  if (nextBtn) {
    const isDisabled = currentCardIndex === cards.length - 1;
    nextBtn.disabled = isDisabled;
    nextBtn.style.opacity = isDisabled ? '0.5' : '1';
    nextBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
  }

  // Reset card flip state
  const cardInner = document.getElementById('cardInner');
  if (cardInner) {
    cardInner.classList.remove('flipped');
  }
}

function generateQuizQuestions(cards) {
  return cards.map(card => {
    const wrongAnswers = cards
      .filter(c => c.answer !== card.answer)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(c => c.answer);

    const options = [...wrongAnswers, card.answer]
      .sort(() => 0.5 - Math.random());

    return {
      question: card.question,
      correct: card.answer,
      options
    };
  });
}

function toggleTimerVisibility() {
  timerHidden = !timerHidden;
  renderApp();
}

// ============= CLASS QUIZ VIEW =============
function renderClassQuizView() {
  // Get the quiz data set by startClassQuiz()
  const quiz = window._classQuiz;
  
  if (!quiz) {
    return `<div class="p-6 text-center" style="color: var(--error);">Quiz data not found</div>`;
  }
  
  // Initialize quiz state if needed
  if (!window._classQuizState) {
    window._classQuizState = {
      currentIndex: 0,
      score: 0,
      // Use array to preserve order and allow map/filter operations
      answers: [],
      startTime: Date.now()
    };
  }

  // Safety: normalize answers to an array (old sessions may have stored an object)
  if (!Array.isArray(window._classQuizState.answers)) {
    window._classQuizState.answers = [];
  }
  
  const state = window._classQuizState;
  const questions = quiz.questions || [];
  
  if (!questions || questions.length === 0) {
    return `<div class="p-6 text-center" style="color: var(--on-surface);">
      <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Quiz Error</h3>
      <p style="color: var(--on-surface-variant);">This quiz has no questions. Please contact your teacher.</p>
      <button style="margin-top: 15px; padding: 10px 20px; background: var(--primary); color: var(--on-primary); border-radius: 6px; cursor: pointer; font-weight: bold;"
              onclick="currentView='student'; studentTab='classes'; renderApp()">Back to Classes</button>
    </div>`;
  }
  
  const currentQuestion = questions[state.currentIndex];
  const progress = ((state.currentIndex + 1) / questions.length) * 100;
  
  if (!currentQuestion) {
    // Quiz finished - show results
    return `
      <div class="p-6 rounded-xl shadow space-y-6"
           style="background-color: var(--surface); color: var(--on-surface); max-width: 600px; margin: 0 auto;">
        
        <h2 class="text-2xl font-bold text-center">Quiz Complete!</h2>
        
        <div class="p-6 rounded-lg text-center"
             style="background: linear-gradient(135deg, var(--primary), var(--primary)dd); color: var(--on-primary, var(--text));">
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;">${state.score}/${questions.length}</div>
          <div style="font-size: 18px;">Score: ${Math.round((state.score / questions.length) * 100)}%</div>
        </div>
        
        <div class="space-y-3">
          ${questions.map((q, idx) => {
            const correctAnswer = q.correctAnswer || q.correct;
            const userAnswer = state.answers[idx];
            
            // Debug log
            console.log('Question:', q.question);
            console.log('q.correct:', q.correct);
            console.log('q.correctAnswer:', q.correctAnswer);
            console.log('q.options:', q.options);
            
            // Convert user answer to letter format if it's full text
            let userAnswerLetter = userAnswer;
            if (userAnswer && userAnswer.length > 1) {
              const answerIndex = (q.options || []).indexOf(userAnswer);
              userAnswerLetter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : userAnswer;
            }
            
            // Determine the letter of the correct answer
            let correctAnswerLetter = 'N/A';
            if (correctAnswer && correctAnswer.length === 1 && correctAnswer >= 'A' && correctAnswer <= 'Z') {
              // Already a letter (A, B, C, D)
              correctAnswerLetter = correctAnswer;
            } else {
              // Find the letter of the correct answer in options
              const correctAnswerIndex = (q.options || []).indexOf(correctAnswer);
              correctAnswerLetter = correctAnswerIndex >= 0 ? String.fromCharCode(65 + correctAnswerIndex) : 'N/A';
            }
            
            console.log('correctAnswerLetter:', correctAnswerLetter);
            
            // Compare the letter versions
            const isCorrect = userAnswerLetter === correctAnswerLetter;
            return `
            <div class="p-4 rounded-lg"
                 style="background: var(--input-bg); border-left: 4px solid ${isCorrect ? 'var(--success)' : 'var(--error)'};">
              <p class="font-semibold mb-2">Question ${idx + 1}: ${q.question}</p>
              <p class="text-sm mb-1">
                <strong>Your Answer:</strong> 
                <span style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'};">
                  ${state.answers[idx] ? (() => {
                    const answerIndex = (q.options || []).indexOf(state.answers[idx]);
                    return answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : 'Not answered';
                  })() : 'Not answered'}
                </span>
              </p>
              ${!isCorrect ? `
                <p class="text-sm">
                  <strong>Correct Answer:</strong>
                  <span style="color: var(--success);">${(() => {
                    // If correct answer is a letter (A, B, C, D), convert to option text
                    if (correctAnswerLetter && correctAnswerLetter.length === 1 && correctAnswerLetter >= 'A' && correctAnswerLetter <= 'Z') {
                      const correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
                      const correctOption = q.options?.[correctIndex];
                      return correctOption ? `${correctAnswerLetter}. ${correctOption}` : correctAnswerLetter;
                    }
                    // Otherwise try to find it in options
                    const correctAnswerIndex = (q.options || []).indexOf(correctAnswer);
                    if (correctAnswerIndex >= 0) {
                      return `${String.fromCharCode(65 + correctAnswerIndex)}. ${correctAnswer}`;
                    }
                    return 'N/A';
                  })()}</span>
                </p>
              ` : ''}
            </div>
          `;
          }).join('')}
        </div>
        
        <button style="width: 100%; padding: 12px; background: var(--primary); color: var(--on-primary); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;"
                onclick="currentView='student'; studentTab='classes'; window._classQuiz = null; window._classQuizState = null; renderApp()">
          Back to Classes
        </button>
      </div>
    `;
  }
  
  // Show current question
  return `
    <div class="p-6 rounded-xl shadow space-y-6"
         style="background-color: var(--surface); color: var(--on-surface); max-width: 800px; margin: 0 auto;">
      
      <!-- Header -->
      <div class="flex justify-between items-center pb-4" style="border-bottom: 1px solid var(--border);">
        <div>
          <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${quiz.title}</h2>
          <p style="font-size: 14px; color: var(--on-surface-variant);">Question ${state.currentIndex + 1} of ${questions.length}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${state.score}</div>
          <div style="font-size: 12px; color: var(--on-surface-variant);">Points</div>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div style="height: 6px; background: var(--input-bg); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${progress}%; background: var(--primary); transition: width 0.3s ease;"></div>
      </div>
      
      <!-- Question -->
      <div style="background: var(--input-bg); padding: 20px; border-radius: 8px;">
        <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">${currentQuestion.question}</h3>
        
        <!-- Options -->
        <div class="space-y-2">
          ${(currentQuestion.options || []).map((option, idx) => {
            const isSelected = state.answers[state.currentIndex] === option;
            const letter = String.fromCharCode(65 + idx); // A, B, C, D
            return `
              <button style="
                display: block;
                width: 100%;
                padding: 12px 15px;
                text-align: left;
                border-radius: 6px;
                border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};
                background: ${isSelected ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--surface)'};
                color: var(--on-surface);
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: ${isSelected ? 'bold' : 'normal'};
              "
              onclick="window._classQuizState.answers[${state.currentIndex}] = '${option}'; renderApp()">
                <span style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--primary); margin-right: 10px; text-align: center; line-height: 24px; ${isSelected ? 'background: var(--primary); color: var(--on-primary, var(--text));' : ''} font-weight: bold;">
                  ${isSelected ? '✓' : letter}
                </span>
                <span style="font-weight: bold; color: var(--primary); margin-right: 8px;">${letter})</span>${option}
              </button>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="flex gap-3">
        ${state.currentIndex > 0 ? `
          <button style="flex: 1; padding: 12px; background: var(--surface-variant); color: var(--on-surface); border-radius: 6px; cursor: pointer; font-weight: bold;"
                  onclick="window._classQuizState.currentIndex--; renderApp()">
            ← Previous
          </button>
        ` : ''}
        
        ${state.currentIndex < questions.length - 1 ? `
          <button style="flex: 1; padding: 12px; background: var(--primary); color: var(--on-primary); border-radius: 6px; cursor: pointer; font-weight: bold;"
                  onclick="window._classQuizState.currentIndex++; renderApp()">
            Next →
          </button>
        ` : `
          <button style="flex: 1; padding: 12px; background: var(--success); color: var(--on-primary, var(--text)); border-radius: 6px; cursor: pointer; font-weight: bold;"
                  onclick="finishClassQuiz()">
            Submit Quiz
          </button>
        `}
        
        <button style="flex: 1; padding: 12px; background: var(--error); color: var(--on-primary, var(--text)); border-radius: 6px; cursor: pointer; font-weight: bold;"
                onclick="if(confirm('Are you sure you want to exit this quiz without submitting?')) { currentView='student'; studentTab='classes'; window._classQuiz = null; window._classQuizState = null; renderApp(); }">
          Exit
        </button>
      </div>
    </div>
  `;
}

function finishClassQuiz() {
  if (!window._classQuizState) return;
  
  const state = window._classQuizState;
  const quiz = window._classQuiz;

  // Ensure answers is an array for map/filter usage
  const answers = Array.isArray(state.answers) ? state.answers : [];
  
  // Calculate score based on correct answers
  let correctCount = 0;
  const questions = quiz.questions || [];
  
  questions.forEach((q, idx) => {
    const correctAnswer = q.correctAnswer || q.correct;
    const userAnswer = answers[idx];
    
    let userAnswerLetter = userAnswer;
    if (userAnswer && userAnswer.length > 1) {
      const answerIndex = (q.options || []).indexOf(userAnswer);
      userAnswerLetter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : userAnswer;
    }
    
    let correctAnswerLetter = correctAnswer;
    if (correctAnswer && correctAnswer.length > 1) {
      const correctIndex = (q.options || []).indexOf(correctAnswer);
      correctAnswerLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : correctAnswer;
    }
    
    if (userAnswerLetter === correctAnswerLetter) {
      correctCount++;
    }
  });
  
  // ✅ UPDATE global quizScore before saving
  quizScore = correctCount;
  quizQuestions = questions;
  
  state.score = correctCount;
  
  // ✅ Now save with correct values
  const saved = saveQuizScoreNow();
  
  if (!saved) {
    console.warn("⚠️ Failed to save class quiz score");
  }
  
  // Save score to localStorage
  const scores = JSON.parse(localStorage.getItem('studentQuizScores') || '{}');
  const percentage = Math.round((correctCount / questions.length) * 100);
  const letterGrade = getLetterGrade(percentage);
  
  // Calculate which answers were correct
  const correctAnswers = answers.map((answer, idx) => {
    const q = questions[idx];
    const correctAnswer = q.correctAnswer || q.correct;
    
    // Convert both to letter format for comparison
    let userAnswerLetter = answer;
    if (answer && answer.length > 1) {
      const answerIndex = (q.options || []).indexOf(answer);
      userAnswerLetter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : answer;
    }
    
    let correctAnswerLetter = 'N/A';
    if (correctAnswer && correctAnswer.length === 1 && correctAnswer >= 'A' && correctAnswer <= 'Z') {
      correctAnswerLetter = correctAnswer;
    } else {
      const correctAnswerIndex = (q.options || []).indexOf(correctAnswer);
      correctAnswerLetter = correctAnswerIndex >= 0 ? String.fromCharCode(65 + correctAnswerIndex) : 'N/A';
    }
    
    return userAnswerLetter === correctAnswerLetter;
  });
  
  const scoreKey = `${window._classQuizId}_${new Date().toISOString()}`;
  scores[scoreKey] = {
    quizId: window._classQuizId,
    quizTitle: quiz.title,
    score: correctCount,
    total: questions.length,
    percentage: percentage,
    letterGrade: letterGrade,
    completedAt: new Date().toISOString(),
    studentId: window.currentStudent?.id,
    attemptNumber: getStudentQuizAttempts(window.currentStudent?.id, window._classQuizId).length + 1,
    answers: state.answers,
    correctAnswers: correctAnswers
  };
  localStorage.setItem('studentQuizScores', JSON.stringify(scores));
  
  // Show results by re-rendering (will show results since currentIndex is at end)
  window._classQuizState.currentIndex = questions.length;
  renderApp();
  toast('✅ Quiz submitted successfully!');
}

function renderQuizView() {
  const q = quizQuestions[quizIndex];
  const progress = ((quizIndex + 1) / quizQuestions.length) * 100;

  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;
  const sub = config.secondary_color;

  return `
    <div class="mobile-optimized w-full h-full overflow-auto bg-gradient-to-br from-[var(--surface)] to-[var(--primary)]">
      <div class="min-h-full flex flex-col p-4">
        <div class="max-w-4xl w-full mx-auto fade-in">

          <!-- Enhanced Header with Glass Effect -->
          <div class="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 rounded-2xl p-6 mb-6 shadow-xl border border-white/20">
            <div class="flex items-center justify-between mb-4">
              <button id="exitQuizBtn"
                class="group px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                style="background: linear-gradient(135deg, var(--card-bg), rgba(255,255,255,0.1)); color:var(--text); box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.2);">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  Exit Quiz
                </span>
              </button>

              <!-- Floating Timer with Enhanced Design -->
              <div id="floating-timer"
                style="
                  position:fixed;
                  top:24px;
                  right:24px;
                  z-index:1000;
                  width:90px;
                  height:90px;
                  border-radius:50%;
                  background: linear-gradient(135deg, var(--card-bg), rgba(255,255,255,0.1));
                  backdrop-filter: blur(10px);
                  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                  border: 2px solid rgba(255,255,255,0.2);
                  display:${timerHidden ? "none" : "flex"};
                  align-items:center;
                  justify-content:center;
                  flex-direction:column;
                  font-weight:700;
                  color:${primary};
                  transition: all 0.3s ease;
                "
                class="hover:scale-110 cursor-pointer"
                onclick="toggleTimerVisibility()"
              >
                <div style="font-size:1.4rem; margin-bottom:2px;">⏱️</div>
                <div id="study-timer" style="font-size:1.1rem; letter-spacing:1px; font-weight:600;">
                  ${formatTime(studyTimer.remaining)}
                </div>
              </div>

              <div class="text-right">
                <div class="flex items-center gap-3 mb-2">
                  <div class="px-3 py-1 rounded-full text-xs font-semibold"
                       style="background: linear-gradient(135deg, var(--primary), var(--primary)); color: var(--on-primary, var(--text)); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    Q ${quizIndex + 1} / ${quizQuestions.length}
                  </div>
                  <div class="px-3 py-1 rounded-full text-xs font-semibold"
                       style="background: linear-gradient(135deg, #22c55e, #16a34a); color: var(--on-primary, var(--text)); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    ⭐ ${quizScore}
                  </div>
                </div>
                <div class="text-xs" style="color:${sub};">${Math.round(progress)}% Complete</div>
              </div>
            </div>

            <!-- Enhanced Progress Bar -->
            <div class="w-full h-3 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.1); box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
              <div class="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                   style="width:${progress}%; background: linear-gradient(90deg, ${primary}, ${primary}cc); box-shadow: 0 0 10px ${primary}50;">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
          </div>

          <!-- Timer Controls Card (Enhanced) -->
          <div id="timerControlsContainer" style="display:${showTimerControls ? "block" : "none"}; margin-bottom: 24px;">
            <div class="backdrop-blur-md bg-white/90 dark:bg-slate-800/90 rounded-2xl p-6 shadow-xl border border-white/20">
              <h3 class="text-lg font-semibold mb-4" style="color:${text};">⏰ Timer Controls</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="number" id="timer-hours" min="0" placeholder="H"
                       class="px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 text-center font-semibold"
                       style="background: ${bg}; color:${text}; border-color: rgba(0,0,0,0.1);" />
                <input type="number" id="timer-minutes" min="0" max="59" placeholder="M"
                       class="px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 text-center font-semibold"
                       style="background: ${bg}; color:${text}; border-color: rgba(0,0,0,0.1);" />

                <button onclick="applyTimerSettings()"
                        class="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                        style="background: linear-gradient(135deg, ${primary}, ${primary}dd); color: var(--on-primary, var(--text)); border: 2px solid rgba(255,255,255,0.2);">
                  Set Timer
                </button>

                <div class="flex gap-2">
                  <button onclick="startStudyTimer()"
                          class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                          style="background: linear-gradient(135deg, #22c55e, #16a34a); color: var(--on-primary, var(--text));">
                    ▶ Start
                  </button>
                  <button onclick="stopStudyTimer()"
                          class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                          style="background: linear-gradient(135deg, #ef4444, #dc2626); color: var(--on-primary, var(--text));">
                    ⏸ Pause
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Question Card with Enhanced Design -->
          <div class="backdrop-blur-md bg-white/95 dark:bg-slate-800/95 rounded-3xl p-8 mb-8 shadow-2xl border border-white/30 transform hover:scale-[1.02] transition-all duration-300">
            <div class="flex items-start gap-4 mb-6">
              <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl"
                   style="background: linear-gradient(135deg, var(--primary), var(--primary)); color: var(--on-primary, var(--text)); box-shadow: 0 4px 12px var(--primary)30;">
                Q${quizIndex + 1}
              </div>
              <div class="flex-1">
                <h2 class="text-2xl md:text-3xl font-bold leading-tight" style="color:var(--text); line-height:1.4;">
                  ${q.question}
                </h2>
              </div>
            </div>
          </div>

          <!-- Options Grid with Enhanced Cards -->
          <div class="grid gap-4 md:gap-6">
            ${q.options.map((opt, index) => `
              <button type="button" class="quiz-option group relative overflow-hidden"
                      data-answer="${opt}"
                      style="
                        padding: 24px;
                        border-radius: 20px;
                        background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1));
                        color:${text};
                        font-size: var(--font-size);
                        box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        border: 2px solid transparent;
                        backdrop-filter: blur(10px);
                        text-align: left;
                        min-height: 72px;
                      ">
                <div class="flex items-center gap-4">
                  <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 group-hover:scale-110"
                       style="background: linear-gradient(135deg, ${primary}, ${primary}dd); color: var(--on-primary, var(--text)); box-shadow: 0 4px 12px ${primary}30;">
                    ${String.fromCharCode(65 + index)}
                  </div>
                  <div class="flex-1 font-medium leading-relaxed text-base">
                    ${opt}
                  </div>
                  <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </div>

                <!-- Hover effect overlay -->
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
              </button>
            `).join("")}
          </div>

          <!-- Timer Toggle Button -->
          <div class="text-center mt-8">
            <button id="toggleTimerBtn"
                    onclick="toggleTimerVisibility()"
                    class="px-8 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl quiz-option"
                    style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 56px;">
              <span class="flex items-center gap-2">
                <span>${timerHidden ? "👁️ Show Timer" : "🙈 Hide Timer"}</span>
                <svg class="w-4 h-4 transition-transform ${timerHidden ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  `;
}

function toggleTimerControls(value) {
  showTimerControls = value === "show";
  const container = document.getElementById("timerControlsContainer");
  if (container) container.style.display = showTimerControls ? "flex" : "none";
  renderApp();
}


function renderQuizResultView() {
  const primary = config.primary_color;
  const bg = config.card_background;
  const text = config.text_color;
  const score = quizScore;
  const total = quizQuestions.length;
  const percentage = Math.round((score / total) * 100);

  // Determine performance level and styling
  let performanceLevel, performanceColor, performanceBg, emoji, message;
  if (percentage >= 90) {
    performanceLevel = "Outstanding!";
    performanceColor = "#22c55e";
    performanceBg = "from-green-400 to-green-600";
    emoji = "🏆";
    message = "Excellent work! You've mastered this material.";
  } else if (percentage >= 80) {
    performanceLevel = "Great Job!";
    performanceColor = "#3b82f6";
    performanceBg = "from-blue-400 to-blue-600";
    emoji = "🎉";
    message = "Well done! You're doing fantastic.";
  } else if (percentage >= 70) {
    performanceLevel = "Good Work!";
    performanceColor = "#f59e0b";
    performanceBg = "from-yellow-400 to-orange-500";
    emoji = "👍";
    message = "Not bad! Keep practicing to improve.";
  } else if (percentage >= 60) {
    performanceLevel = "Keep Trying!";
    performanceColor = "#f97316";
    performanceBg = "from-orange-400 to-red-500";
    emoji = "💪";
    message = "You're on the right track. Study more and try again.";
  } else {
    performanceLevel = "Need More Practice";
    performanceColor = "#ef4444";
    performanceBg = "from-red-400 to-red-600";
    emoji = "📚";
    message = "Don't give up! Review the material and try again.";
  }

  return `
    <div class="mobile-optimized w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:to-indigo-900">
      <div class="max-w-lg w-full fade-in">

        <!-- Main Result Card -->
        <div class="backdrop-blur-md bg-white/90 dark:bg-slate-800/90 rounded-3xl p-6 shadow-2xl border border-white/30 text-center transform hover:scale-[1.02] transition-all duration-300">

          <!-- Celebration Emoji -->
          <div class="text-5xl mb-6 animate-bounce">${emoji}</div>

          <!-- Title -->
          <h2 class="text-2xl md:text-3xl font-bold mb-2" style="color:${text};">
            Quiz Complete!
          </h2>

          <p class="text-base mb-8" style="color: ${performanceColor}; font-weight: 600;">
            ${performanceLevel}
          </p>

          <!-- Score Display -->
          <div class="relative mb-8">
            <div class="w-40 h-40 mx-auto rounded-full bg-gradient-to-br ${performanceBg} flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div class="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
              <div class="relative z-10 text-white">
                <div class="text-4xl font-bold mb-1">${score}</div>
                <div class="text-lg opacity-90">/ ${total}</div>
              </div>

              <!-- Circular progress ring -->
              <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.2)" stroke-width="8" fill="none"/>
                <circle cx="50" cy="50" r="45" stroke="white" stroke-width="8" fill="none"
                        stroke-dasharray="${2 * Math.PI * 45}"
                        stroke-dashoffset="${2 * Math.PI * 45 * (1 - percentage/100)}"
                        class="transition-all duration-1000 ease-out"/>
              </svg>
            </div>

            <!-- Percentage Badge -->
            <div class="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
              <span class="text-lg font-bold" style="color: ${performanceColor};">${percentage}%</span>
            </div>
          </div>

          <!-- Performance Message -->
          <p class="text-sm mb-8 leading-relaxed" style="color:${text};">
            ${message}
          </p>

          <!-- Stats Grid -->
          <div class="grid grid-cols-3 gap-3 mb-8">
            <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
              <div class="text-xl font-bold" style="color: ${performanceColor};">${score}</div>
              <div class="text-xs" style="color:${text}; opacity: 0.8;">Correct</div>
            </div>
            <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
              <div class="text-xl font-bold" style="color: ${performanceColor};">${total - score}</div>
              <div class="text-xs" style="color:${text}; opacity: 0.8;">Incorrect</div>
            </div>
            <div class="bg-white/50 dark:bg-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
              <div class="text-xl font-bold" style="color: ${performanceColor};">${percentage}%</div>
              <div class="text-xs" style="color:${text}; opacity: 0.8;">Score</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-3">
            <button id="exitQuizBtn"
              class="w-full py-4 px-6 rounded-2xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl quiz-option"
              style="background: linear-gradient(135deg, ${primary}, ${primary}dd); color: var(--on-primary, var(--text)); border: 2px solid rgba(255,255,255,0.2); min-height: 56px;">
              <span class="flex items-center justify-center gap-3">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                </svg>
                Back to Home
              </span>
            </button>

            <button onclick="startQuiz()"
              class="w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 quiz-option"
              style="background: linear-gradient(135deg, ${bg}, rgba(255,255,255,0.1)); color:${text}; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); min-height: 48px;">
              <span class="flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Take Quiz Again
              </span>
            </button>
          </div>
        </div>

        <!-- Achievement Badges -->
        ${percentage >= 80 ? `
          <div class="mt-6 text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              <span class="text-lg">🏆</span>
              <span>Achievement Unlocked: Quiz Master!</span>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}


function exitQuizBtn() {
  stopStudyTimer();
  resetStudyTimer();
  currentView = "home";
  renderApp();
}


function showAddSubjectModal() {
  const subtitleColor = config.secondary_color || defaultConfig.secondary_color;
  const primaryColor = config.primary_color || defaultConfig.primary_color;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
        <div class="modal-content" style="background: var(--card-bg); padding: 2rem;">
          <h2 style="font-size:calc(var(--font-size) * 1.8);
 font-weight: 400; color: var(--text); margin-bottom: 1.5rem;">Add New Subject</h2>
          
          <form id="addSubjectForm">
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: calc(var(--font-size) * 0.875);
 font-weight: 400; color: var(--text); margin-bottom: 0.5rem;">Subject Name</label>
              <input type="text" id="subjectNameInput" required style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: var(--radius); font-size: var(--font-size);
 color: var(--text);" placeholder="e.g., Biology, History...">
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: calc(var(--font-size) * 0.875);
 font-weight: 400; color: var(--text); margin-bottom: 0.5rem;">Choose Icon</label>
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;">
                ${emojiOptions.map((emoji, idx) => `
                  <button type="button" class="emoji-btn" data-emoji="${emoji}" style="padding: 0.75rem; border: 2px solid ${idx === 0 ? primaryColor : '#e2e8f0'}; border-radius: var(--radius); font-size: calc(var(--font-size) * 1.5);
 cursor: pointer; background: var(--card-bg); transition: all 0.2s;">
                    ${emoji}
                  </button>
                `).join('')}
              </div>
              <input type="hidden" id="selectedEmoji" value="${emojiOptions[0]}">
            </div>

            <div style="display: flex; gap: 1rem;">
              <button type="button" id="cancelSubjectBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: #e2e8f0; color: var(--text); border: none; cursor: pointer;">
                Cancel
              </button>
              <button type="submit" id="submitSubjectBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: var(--primary); color: var(--on-primary, var(--text)); border: none; cursor: pointer; font-weight: 400;">
                <span id="submitSubjectText">Add Subject</span>
              </button>
            </div>
          </form>
        </div>
      `;

  document.body.appendChild(modal);

  const emojiButtons = modal.querySelectorAll('.emoji-btn');
  const selectedEmojiInput = modal.querySelector('#selectedEmoji');

  emojiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      emojiButtons.forEach(b => b.style.borderColor = '#e2e8f0');
      btn.style.borderColor = primaryColor;
      selectedEmojiInput.value = btn.dataset.emoji;
    });
  });

  modal.querySelector('#cancelSubjectBtn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  modal.querySelector('#addSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (allData.filter(d => d.type === 'subject').length >= 999) {
      showToast('Maximum limit of 999 subjects reached');
      return;
    }

    const submitBtn = modal.querySelector('#submitSubjectBtn');
    const submitText = modal.querySelector('#submitSubjectText');
    submitBtn.disabled = true;
    submitText.innerHTML = '<span class="spinner"></span>';

    const subjectName = modal.querySelector('#subjectNameInput').value;
    const subjectIcon = selectedEmojiInput.value;
    const subjectId = 'subj_' + Date.now();

    const result = await window.dataSdk.create({
      type: 'subject',
      subject_id: subjectId,
      subject_name: subjectName,
      subject_icon: subjectIcon,
      set_id: '',
      set_name: '',
      question: '',
      answer: '',
      created_at: new Date().toISOString()
    });

    if (result.isOk) {
      modal.remove();
      renderApp();
    }
    else {
      submitBtn.disabled = false;
      submitText.textContent = 'Add Subject';
      showToast('Failed to add subject. Please try again.');
    }
  });
}

function importCardsFromJsonForCurrentSet() {
  if (!currentSet?.set_id) {
    showToast('No set selected');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json.cards)) {
        throw new Error('Invalid format');
      }

      for (const card of json.cards) {
        if (!card.question || !card.answer) continue;

        await window.dataSdk.create({
          type: 'card',
          subject_id: '',
          subject_name: '',
          subject_icon: '',
          set_id: currentSet.set_id,
          set_name: '',
          question: card.question,
          answer: card.answer,
          created_at: new Date().toISOString()
        });
      }

      showToast(`Imported ${json.cards.length} cards`);
    } catch (err) {
      console.error(err);
      showToast('Invalid JSON file');
    }
  });

  input.click();
}

function showAddSetModal() {


  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
        <div class="modal-content" style="background: var(--card-bg); padding: 2rem;">
          <h2 style="font-size:calc(var(--font-size) * 1.8);
 font-weight: 400; color: var(--text); margin-bottom: 1.5rem;">Add New Set</h2>
          
          <form id="addSetForm">
            <div style="margin-bottom: 1.5rem;">
              <label for="setNameInput" style="display: block; font-size: calc(var(--font-size) * 0.875);
 font-weight: 400; color: var(--text); margin-bottom: 0.5rem;">Set Name</label>
              <input type="text" id="setNameInput" required style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: var(--radius); font-size: var(--font-size);
 color: var(--text);" placeholder="e.g., Chapter 1, Vocabulary...">
            </div>

            <div style="display: flex; gap: 1rem;">
              <button type="button" id="cancelSetBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: #e2e8f0; color: var(--text); border: none; cursor: pointer;">
                Cancel
              </button>
              <button type="submit" id="submitSetBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: var(--primary); color: var(--on-primary, var(--text)); border: none; cursor: pointer; font-weight: 400;">
                <span id="submitSetText">Add Set</span>
              </button>
            </div>
          </form>
        </div>
      `;

  document.body.appendChild(modal);

  modal.querySelector('#cancelSetBtn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  modal.querySelector('#addSetForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (allData.filter(d => d.type === 'set').length >= 999) {
      showToast('Maximum limit of 999 sets reached');
      return;
    }

    const submitBtn = modal.querySelector('#submitSetBtn');
    const submitText = modal.querySelector('#submitSetText');
    submitBtn.disabled = true;
    submitText.innerHTML = '<span class="spinner"></span>';

    const setName = modal.querySelector('#setNameInput').value;
    const setId = 'set_' + Date.now();

    const result = await window.dataSdk.create({
      type: 'set',
      subject_id: currentSubject.subject_id,
      subject_name: '',
      subject_icon: '',
      set_id: setId,
      set_name: setName,
      question: '',
      answer: '',
      created_at: new Date().toISOString()
    });

    if (result.isOk) {
      modal.remove();
    } else {
      submitBtn.disabled = false;
      submitText.textContent = 'Add Set';
      showToast('Failed to add set. Please try again.');
    }
  });
}

function showAddCardModal() {

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
        <div class="modal-content" style="background: var(--card-bg); padding: 2rem;">
          <h2 style="font-size:calc(var(--font-size) * 1.8);
 font-weight: 400; color: var(--text); margin-bottom: 1.5rem;">Add New Card</h2>
          
          <form id="addCardForm">
            <div style="margin-bottom: 1.5rem;">
              <label for="questionInput" style="display: block; font-size: calc(var(--font-size) * 0.875);
 font-weight: 400; color: var(--text); margin-bottom: 0.5rem;">Question</label>
              <textarea id="questionInput" required rows="3" style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: var(--radius); font-size: var(--font-size);
 color: var(--text); resize: vertical;" placeholder="Enter the question..."></textarea>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label for="answerInput" style="display: block; font-size: calc(var(--font-size) * 0.875);
 font-weight: 400; color: var(--text); margin-bottom: 0.5rem;">Answer</label>
              <textarea id="answerInput" required rows="3" style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: var(--radius); font-size: var(--font-size);
 color: var(--text); resize: vertical;" placeholder="Enter the answer..."></textarea>
            </div>

            <div style="display: flex; gap: 1rem;">
              <button type="button" id="cancelCardBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: #e2e8f0; color: var(--text); border: none; cursor: pointer;">
                Cancel
              </button>
              <button type="submit" id="submitCardBtn" style="flex: 1; padding: 0.75rem; border-radius: var(--radius); font-size: var(--font-size);
 background: var(--primary); color: var(--on-primary, var(--text)); border: none; cursor: pointer; font-weight: 400;">
                <span id="submitCardText">Add Card</span>
              </button>
            </div>
          </form>
        </div>
      `;

  document.body.appendChild(modal);

  modal.querySelector('#cancelCardBtn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  modal.querySelector('#addCardForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (allData.filter(d => d.type === 'card').length >= 999) {
      showToast('Maximum limit of 999 cards reached');
      return;
    }

    const submitBtn = modal.querySelector('#submitCardBtn');
    const submitText = modal.querySelector('#submitCardText');
    submitBtn.disabled = true;
    submitText.innerHTML = '<span class="spinner"></span>';

    const question = modal.querySelector('#questionInput').value;
    const answer = modal.querySelector('#answerInput').value;

    const result = await window.dataSdk.create({
      type: 'card',
      subject_id: currentSubject.subject_id,
      subject_name: currentSubject.subject_name,
      subject_icon: currentSubject.subject_icon,
      set_id: currentSet.set_id,
      set_name: currentSet.set_name,
      question: question,
      answer: answer,
      created_at: new Date().toISOString()
    });


    if (result.isOk) {
      modal.remove();
    } else {
      submitBtn.disabled = false;
      submitText.textContent = 'Add Card';
      showToast('Failed to add card. Please try again.');
    }
  });
}

async function generateCardsWithAI(topic, count) {
  if (!navigator.onLine) {
    showToast("AI generation requires internet");
    return;
  }

  if (!currentSet?.set_id) {
    showToast("No set selected");
    return false;
  }

  showAILoading();

  try {
    const res = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count })
    });

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const json = await res.json();

    if (!Array.isArray(json.cards)) {
      throw new Error("Invalid AI response");
    }

    // Create all cards sequentially
    for (const card of json.cards) {
      const result = await window.dataSdk.create({
        type: "card",
        subject_id: currentSubject?.subject_id || "",
        subject_name: currentSubject?.subject_name || "",
        subject_icon: currentSubject?.subject_icon || "",
        set_id: currentSet.set_id,
        set_name: currentSet.set_name || "",
        question: card.question,
        answer: card.answer,
        created_at: new Date().toISOString()
      });

      if (result.isError) {
        throw new Error("Failed to create card");
      }
    }

    // UI update happens in onDataChanged when data changes are detected
    hideAILoading();
    showToast(`Successfully generated ${json.cards.length} cards`);
    return true;

  } catch (error) {
    hideAILoading();
    showToast("Failed to generate cards. Please try again.");
    console.error("AI generation error:", error);
    return false;
  }
}

function showAIGenerateModal() {
  if (document.querySelector(".modal-overlay")) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal">
      <h2>Generate Cards with AI</h2>

      <label>
        Topic
        <input id="aiTopicInput" type="text" placeholder="e.g. Photosynthesis" />
      </label>

      <label>
        Number of cards
        <input id="aiCountInput" type="number" min="1" max="50" value="10" />
      </label>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelAIModal">Cancel</button>
        <button class="btn btn-primary" id="confirmAIModal">
          Generate
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#aiTopicInput").focus();

  modal.querySelector("#cancelAIModal").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("#confirmAIModal").onclick = async () => {
    const btn = modal.querySelector("#confirmAIModal");
    btn.disabled = true;
    btn.textContent = "Generating...";

    const topic = modal.querySelector("#aiTopicInput").value.trim();
    const count = Math.min(
      50,
      Math.max(1, parseInt(modal.querySelector("#aiCountInput").value, 10))
    );

    if (!topic) {
      showToast("Please enter a topic");
      btn.disabled = false;
      btn.textContent = "Generate";
      return;
    }

    modal.remove();
    await generateCardsWithAI(topic, count);
  };
}




async function loadAllData() {
  allData = window.dataSdk.getAll();
}

let aiLoadingEl = null;

function showAILoading() {
  document.getElementById("aiLoading")?.classList.add("show");
}

function hideAILoading() {
  document.getElementById("aiLoading")?.classList.remove("show");
}




function showToast(message) {

  // Try to reuse existing toast
  let toast = document.getElementById('toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;

  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: #1e293b;
    color: var(--on-primary, var(--text));
    padding: 1rem 1.5rem;
    border-radius: var(--radius);
    font-size: var(--font-size);

    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 2000;
    opacity: 0;
  `;

  // Show animation
  toast.classList.remove('show');
  void toast.offsetWidth; // force reflow
  toast.classList.add('show');

  // Auto-hide
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function attachEventListeners() {
  // ---- BACK BUTTONS ----
  const backToHomeBtn = document.getElementById("backToHomeBtn");
  if (backToHomeBtn) {
    backToHomeBtn.onclick = () => {
      currentSet = null;
      currentCardIndex = 0;
      studyQueue = [];
      currentView = "home";
      renderApp();
    };
  }

  const backBtnTeacherQuiz = document.getElementById("backBtnTeacherQuiz");
  if (backBtnTeacherQuiz) {
    backBtnTeacherQuiz.onclick = () => {
      currentView = "home";
      renderApp();
    };
  }

  const backToSubjectsBtn = document.getElementById("backToSubjectsBtn");
  if (backToSubjectsBtn) {
    backToSubjectsBtn.onclick = () => {
      currentSubject = null;
      currentView = "subjects";
      renderApp();
    };
  }

  const backToSetsBtn = document.getElementById("backToSetsBtn");
  if (backToSetsBtn) {
    backToSetsBtn.onclick = () => {
      currentSet = null;
      currentView = "sets";
      renderApp();
    };
  }

  const backToCardsBtn = document.getElementById("backToCardsBtn");
  if (backToCardsBtn) {
    backToCardsBtn.onclick = () => {
      currentCardIndex = 0;
      isFlipped = false;
      currentView = "cards";
      renderApp();
    };
  }

  // ---- SUBJECT, SET, CARD ACTIONS ----
  const addSubjectBtn = document.getElementById("addSubjectBtn");
  if (addSubjectBtn) addSubjectBtn.onclick = showAddSubjectModal;

  const addSetBtn = document.getElementById("addSetBtn");
  if (addSetBtn) addSetBtn.onclick = showAddSetModal;

  const addCardBtn = document.getElementById("addCardBtn");
  if (addCardBtn) addCardBtn.onclick = showAddCardModal;

  const importCardsJsonBtn = document.getElementById("importCardsJsonBtn");
  if (importCardsJsonBtn) importCardsJsonBtn.onclick = importCardsFromJsonForCurrentSet;

  // Subject and Set cards
  document.querySelectorAll(".category-card").forEach(card => {
    card.onclick = e => {
      if (card.dataset.subjectId && !e.target.classList.contains("delete-subject-btn")) {
        const subjectId = card.dataset.subjectId;
        currentSubject = getSubjects().find(s => s.subject_id === subjectId);
        currentView = "sets";
        renderApp();
      }
      if (card.dataset.setId && !e.target.classList.contains("delete-set-btn") && !e.target.classList.contains("study-set-btn")) {
        const setId = card.dataset.setId;
        currentSet = getSetsForSubject(currentSubject.subject_id).find(s => s.set_id === setId);
        currentView = "cards";
        renderApp();
      }
    };
  });

  // Delete buttons
  document.querySelectorAll(".delete-subject-btn").forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const subjectId = btn.dataset.subjectId;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
      const itemsToDelete = allData.filter(d =>
        (d.type === "subject" && d.subject_id === subjectId) ||
        (d.type === "set" && d.subject_id === subjectId) ||
        (d.type === "card" && allData.some(s => s.type === "set" && s.set_id === d.set_id && s.subject_id === subjectId))
      );
      for (const item of itemsToDelete) await window.dataSdk.delete({ id: item.id }, true);
      window.dataSdk.init(dataHandler);
      if (currentSubject?.subject_id === subjectId) {
        currentSubject = null;
        currentView = "subjects";
      }
    };
  });

  document.querySelectorAll(".delete-set-btn").forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const setId = btn.dataset.setId;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
      const itemsToDelete = allData.filter(d => (d.type === "set" && d.set_id === setId) || (d.type === "card" && d.set_id === setId));
      for (const item of itemsToDelete) await window.dataSdk.delete({ id: item.id });
      renderApp();
    };
  });

  document.querySelectorAll(".delete-card-btn").forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
      await window.dataSdk.delete({ id });
      renderApp();
    };
  });

  // Study Set buttons
  document.querySelectorAll(".study-set-btn").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const setId = btn.dataset.setId;
      currentSet = getSetsForSubject(currentSubject.subject_id).find(s => s.set_id === setId);
      currentCardIndex = 0;
      isFlipped = false;
      currentView = "study";
      renderApp();
    };
  });

  // Study / Quiz buttons
  const studyCardsBtn = document.getElementById("studyCardsBtn");
  if (studyCardsBtn) studyCardsBtn.onclick = () => {
    currentCardIndex = 0;
    isFlipped = false;
    currentView = "study";
    renderApp();
  };

  const quizCardsBtn = document.getElementById("quizCardsBtn");
  if (quizCardsBtn) quizCardsBtn.onclick = () => {
    const cards = getCardsForSet(currentSet.set_id);
    quizQuestions = generateQuizQuestions(cards);
    quizIndex = 0;
    quizScore = 0;
    resetStudyTimer();
    currentView = "quiz";
    renderApp();
  };

  // Flip / Next / Prev card buttons
  const flipBtn = document.getElementById("flipBtn");
  if (flipBtn) flipBtn.onclick = () => {
    const cardInner = document.getElementById("cardInner");
    isFlipped = !isFlipped;
    cardInner?.classList.toggle("flipped", isFlipped);
  };

  const prevBtn = document.getElementById("prevBtn");
  if (prevBtn) prevBtn.onclick = () => {
    if (currentCardIndex > 0) {
      currentCardIndex--;
      isFlipped = false;
      updateFlashcardContent();
    }
  };

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) nextBtn.onclick = () => {
    const cards = getCardsForSet(currentSet?.set_id || []);
    if (currentCardIndex < cards.length - 1) {
      currentCardIndex++;
      isFlipped = false;
      updateFlashcardContent();
    }
  };

  // AI Generate
  const aiGenerateBtn = document.getElementById("aiGenerateBtn");
  if (aiGenerateBtn) aiGenerateBtn.onclick = showAIGenerateModal;

  // Exit Quiz
  const exitQuizBtn = document.getElementById("exitQuizBtn");
  if (exitQuizBtn) exitQuizBtn.onclick = () => {
    stopStudyTimer();
    resetStudyTimer();
    currentView = "cards";
    renderApp();
  };

  // Quiz option buttons
  if (currentView === "quiz") {
    document.querySelectorAll(".quiz-option").forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        if (btn.classList.contains("disabled")) return;

        const selected = btn.dataset.answer;
        const correct = quizQuestions[quizIndex].correct;

        document.querySelectorAll(".quiz-option").forEach(b => {
          b.classList.add("disabled");
          b.style.pointerEvents = "none";
        });

        btn.style.transform = "scale(1.05)";
        setTimeout(() => (btn.style.transform = "scale(1)"), 200);

        if (selected === correct) {
          btn.classList.add("correct");
          quizScore++;
        } else {
          btn.classList.add("wrong");
          document.querySelectorAll(".quiz-option").forEach(b => {
            if (b.dataset.answer === correct) b.classList.add("correct");
          });
        }

        setTimeout(() => {
          quizIndex++;
          if (quizIndex >= quizQuestions.length) currentView = "quiz-result";
          renderApp();
        }, 800);
      };
    });
  }
}


function adjustColor(color, amount) {
  const num = parseInt(color.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

async function onConfigChange(newConfig) {
  Object.assign(config, newConfig);
  renderApp();
}

function mapToCapabilities(cfg) {
  return {
    recolorables: [
      {
        get: () => cfg.background_color || defaultConfig.background_color,
        set: (value) => {
          cfg.background_color = value;
          window.elementSdk.setConfig({ background_color: value });
        }
      },
      {
        get: () => cfg.card_background || defaultConfig.card_background,
        set: (value) => {
          cfg.card_background = value;
          window.elementSdk.setConfig({ card_background: value });
        }
      },
      {
        get: () => cfg.text_color || defaultConfig.text_color,
        set: (value) => {
          cfg.text_color = value;
          window.elementSdk.setConfig({ text_color: value });
        }
      },
      {
        get: () => cfg.primary_color || defaultConfig.primary_color,
        set: (value) => {
          cfg.primary_color = value;
          window.elementSdk.setConfig({ primary_color: value });
        }
      },
      {
        get: () => cfg.secondary_color || defaultConfig.secondary_color,
        set: (value) => {
          cfg.secondary_color = value;
          window.elementSdk.setConfig({ secondary_color: value });
        }
      }
    ],
    borderables: [],
    fontEditable: {
      get: () => cfg.font_family || 'system-ui',
      set: (value) => {
        cfg.font_family = value;
        window.elementSdk.setConfig({ font_family: value });
      }
    },
    fontSizeable: {
      get: () => cfg.font_size || 16,
      set: (value) => {
        cfg.font_size = value;
        window.elementSdk.setConfig({ font_size: value });
      }
    }
  };
}

function mapToEditPanelValues(cfg) {
  return new Map([
    ["app_title", cfg.app_title || defaultConfig.app_title],
    ["app_subtitle", cfg.app_subtitle || defaultConfig.app_subtitle]
  ]);
}

(async () => {
  if (window.elementSdk) {
    window.elementSdk.init({
      defaultConfig,
      onConfigChange,
      mapToCapabilities,
      mapToEditPanelValues
    });
  }

  if (window.dataSdk) {
    const initResult = await window.dataSdk.init(dataHandler);
    if (!initResult.isOk) {
      console.error('Failed to initialize data SDK');
    }
  }
})();

window.addEventListener("beforeinstallprompt", e => {
  console.log("✅ beforeinstallprompt fired");

  e.preventDefault(); // REQUIRED
  deferredInstallPrompt = e;

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) installBtn.style.display = "block";
});

document.getElementById("installAppBtn")?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;

  deferredInstallPrompt = null;

  document.getElementById("installAppBtn").style.display = "none";

  if (choice.outcome === "accepted") {
    showToast("App installed 🎉");
  }
});

window.addEventListener("appinstalled", () => {
  console.log("🎉 App installed");
});


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(registration => {
        console.log("Service Worker registered successfully:", registration.scope);
      })
      .catch(err => {
        console.error("SW registration failed:", err);
        // Don't throw error, just log it
      });
  });
}


