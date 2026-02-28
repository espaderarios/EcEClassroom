(function () {
  const state = {
    activePanelId: null,
    sessionSnapshot: null,
    usingSampleMode: false,
    dataHealth: {
      status: "idle",
      message: "",
      source: "none"
    },
    pdfViewer: {
      doc: null,
      fileName: "",
      page: 1,
      scale: 1.2,
      renderTask: null
    },
    crossword: {
      expectedByKey: {},
      startNumberByKey: {},
      rows: 0,
      cols: 0,
      entries: [],
      sets: [],
      puzzleId: null,
      selectedSetId: null,
      answerKey: null,
      typingDirection: "across",
      lastFocusedKey: null,
      lastClickedKey: null,
      activeEntryId: null,
      reviewOnlyMissed: false,
      startedAt: null
    },
    matching: {
      selectedQuestionId: null,
      pairs: {},
      checked: false,
      correctnessByQuestion: {},
      sets: [],
      selectedSetId: null,
      loadedSetId: null,
      displayMode: "lines",
      items: [],
      reviewOnlyWrong: false,
      startedAt: null
    },
    scramble: {
      current: null,
      score: 0,
      attempts: 0,
      streak: 0,
      hintStage: 0,
      missedTerms: [],
      reviewOnlyMissed: false,
      startedAt: null,
      sets: [],
      selectedSetId: null,
      loadedSetId: null,
      terms: []
    },
    achievements: {
      crosswordBestScore: 0,
      crosswordBestTimeSec: null,
      matchingBestScore: 0,
      matchingBestTimeSec: null,
      scrambleBestStreak: 0
    }
  };

  const CROSSWORD_PROGRESS_KEY = "crossword_progress";
  const CROSSWORD_METADATA_KEY = "crossword_metadata";
  const FEATURES_SESSION_KEY = "features_last_session";
  const FEATURES_ACHIEVEMENTS_KEY = "features_achievements";

  const STOP_WORDS = new Set([
    "the", "and", "for", "that", "with", "this", "from", "have", "were", "your", "into",
    "their", "will", "would", "there", "about", "which", "when", "what", "where", "while",
    "can", "could", "should", "these", "those", "then", "than", "been", "being", "also",
    "between", "because", "after", "before", "through", "during", "each", "some", "such",
    "more", "most", "other", "only", "over", "under", "very", "many", "much", "within",
    "without", "onto", "upon", "they", "them", "ours", "yours", "ourselves", "you", "are",
    "was", "is", "it", "of", "to", "in", "on", "at", "as", "by", "an", "or", "be", "if"
  ]);

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(elementId, message, type) {
    const el = byId(elementId);
    if (!el) return;
    el.textContent = message || "";

    if (type === "success") {
      el.style.color = "#15803d";
    } else if (type === "error") {
      el.style.color = "#b91c1c";
    } else {
      el.style.color = "var(--text-muted)";
    }
  }

  function setText(elementId, value) {
    const el = byId(elementId);
    if (!el) return;
    el.textContent = value || "";
  }

  function setDisabled(elementId, disabled) {
    const button = byId(elementId);
    if (!button) return;
    button.disabled = Boolean(disabled);
  }

  function shuffle(array) {
    const copy = Array.isArray(array) ? array.slice() : [];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function ensurePdfWorker() {
    if (!window.pdfjsLib) return false;
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    return true;
  }

  async function readPdfDocument(file) {
    if (!file) throw new Error("Please choose a PDF file.");
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".pdf") && !(file.type || "").includes("pdf")) {
      throw new Error("Only PDF files are supported for this feature.");
    }
    if (!ensurePdfWorker()) {
      throw new Error("PDF.js did not load. Check your internet connection and refresh.");
    }

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    return loadingTask.promise;
  }

  function setupFeaturePanels() {
    const tiles = Array.from(document.querySelectorAll(".feature-tile[data-target]"));
    const panels = Array.from(document.querySelectorAll(".feature-panel"));
    const lobby = byId("features-lobby");
    const backButtons = Array.from(document.querySelectorAll("[data-back-lobby]"));

    function setPanel(panelId) {
      state.activePanelId = panelId;
      if (lobby) {
        lobby.hidden = Boolean(panelId);
      }
      panels.forEach((panel) => {
        const isActive = panel.id === panelId;
        panel.hidden = !isActive;
        panel.classList.toggle("feature-panel-active", isActive);
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      tiles.forEach((tile) => {
        const isActive = tile.dataset.target === panelId;
        tile.classList.toggle("active", isActive);
        tile.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      updateStickyActionBar();
      saveFeaturesSession();
    }

    tiles.forEach((tile) => {
      tile.addEventListener("click", () => setPanel(tile.dataset.target));
    });

    backButtons.forEach((button) => {
      button.addEventListener("click", () => setPanel(null));
    });

    setPanel(state.activePanelId);
  }

  async function renderViewerPage() {
    const viewerState = state.pdfViewer;
    const canvas = byId("featurePdfCanvas");
    const meta = byId("feature-pdf-meta");
    if (!viewerState.doc || !canvas || !meta) return;

    if (viewerState.page < 1) viewerState.page = 1;
    if (viewerState.page > viewerState.doc.numPages) viewerState.page = viewerState.doc.numPages;
    if (viewerState.scale < 0.6) viewerState.scale = 0.6;
    if (viewerState.scale > 2.8) viewerState.scale = 2.8;

    const page = await viewerState.doc.getPage(viewerState.page);
    const viewport = page.getViewport({ scale: viewerState.scale });
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (viewerState.renderTask && typeof viewerState.renderTask.cancel === "function") {
      try {
        viewerState.renderTask.cancel();
      } catch (err) {
      }
    }

    const renderTask = page.render({
      canvasContext: context,
      viewport
    });
    viewerState.renderTask = renderTask;
    await renderTask.promise;

    meta.textContent = `${viewerState.fileName} | Page ${viewerState.page}/${viewerState.doc.numPages} | Zoom ${Math.round(viewerState.scale * 100)}%`;
  }

  function bindPdfViewer() {
    const loadBtn = byId("feature-pdf-load-btn");
    const prevBtn = byId("feature-pdf-prev-btn");
    const nextBtn = byId("feature-pdf-next-btn");
    const zoomOutBtn = byId("feature-pdf-zoom-out-btn");
    const zoomInBtn = byId("feature-pdf-zoom-in-btn");

    async function loadSelectedPdf() {
      const input = byId("feature-pdf-input");
      const file = input && input.files ? input.files[0] : null;

      try {
        setStatus("pdf-viewer-status", "Loading PDF...", "info");
        const doc = await readPdfDocument(file);
        state.pdfViewer.doc = doc;
        state.pdfViewer.fileName = file.name;
        state.pdfViewer.page = 1;
        state.pdfViewer.scale = 1.2;
        await renderViewerPage();
        setStatus("pdf-viewer-status", "PDF loaded successfully.", "success");
      } catch (err) {
        setStatus("pdf-viewer-status", err.message || "Unable to load PDF.", "error");
      }
    }

    if (loadBtn) loadBtn.addEventListener("click", loadSelectedPdf);

    if (prevBtn) {
      prevBtn.addEventListener("click", async () => {
        if (!state.pdfViewer.doc) return;
        state.pdfViewer.page -= 1;
        try {
          await renderViewerPage();
        } catch (err) {
          setStatus("pdf-viewer-status", "Failed to render previous page.", "error");
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        if (!state.pdfViewer.doc) return;
        state.pdfViewer.page += 1;
        try {
          await renderViewerPage();
        } catch (err) {
          setStatus("pdf-viewer-status", "Failed to render next page.", "error");
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", async () => {
        if (!state.pdfViewer.doc) return;
        state.pdfViewer.scale -= 0.2;
        try {
          await renderViewerPage();
        } catch (err) {
          setStatus("pdf-viewer-status", "Failed to update zoom.", "error");
        }
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", async () => {
        if (!state.pdfViewer.doc) return;
        state.pdfViewer.scale += 0.2;
        try {
          await renderViewerPage();
        } catch (err) {
          setStatus("pdf-viewer-status", "Failed to update zoom.", "error");
        }
      });
    }
  }

  async function extractPdfText(file) {
    const doc = await readPdfDocument(file);
    const chunks = [];

    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(" ");
      chunks.push(text);
    }

    return chunks.join(" ").replace(/\s+/g, " ").trim();
  }

  function analyzeText(rawText) {
    const normalized = (rawText || "").replace(/\s+/g, " ").trim();
    const words = normalized.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    const sentences = normalized
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const frequency = {};
    words.forEach((word) => {
      const key = word.toLowerCase();
      if (key.length < 4 || STOP_WORDS.has(key)) return;
      frequency[key] = (frequency[key] || 0) + 1;
    });

    const topKeywords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count]) => ({ term, count }));

    const questionPrompts = topKeywords.slice(0, 5).map((keyword, index) => {
      return `${index + 1}. Explain the concept of "${keyword.term}" and give one example.`;
    });

    return {
      characters: normalized.length,
      words: words.length,
      sentences: sentences.length,
      uniqueWords: new Set(words.map((word) => word.toLowerCase())).size,
      readingMinutes: Math.max(1, Math.ceil(words.length / 200)),
      topKeywords,
      questionPrompts
    };
  }

  function renderAnalyzerResult(data) {
    const result = byId("pdf-analyzer-result");
    if (!result) return;

    const keywordsHtml = data.topKeywords.length
      ? data.topKeywords
        .map((keyword) => `<span class="chip">${escapeHtml(keyword.term)} (${keyword.count})</span>`)
        .join("")
      : "<span class=\"chip\">No strong keywords detected</span>";

    const promptsHtml = data.questionPrompts.length
      ? data.questionPrompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")
      : "<li>Add more text content to generate prompts.</li>";

    result.innerHTML = `
      <div class="analysis-grid">
        <div class="analysis-item">
          <div class="analysis-label">Words</div>
          <div class="analysis-value">${data.words}</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Sentences</div>
          <div class="analysis-value">${data.sentences}</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Unique Words</div>
          <div class="analysis-value">${data.uniqueWords}</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Reading Time</div>
          <div class="analysis-value">${data.readingMinutes} min</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Characters</div>
          <div class="analysis-value">${data.characters}</div>
        </div>
      </div>
      <div style="margin-top: 14px;">
        <strong style="color: var(--text);">Top Keywords</strong>
        <div class="chip-list">${keywordsHtml}</div>
      </div>
      <div style="margin-top: 14px;">
        <strong style="color: var(--text);">Generated Question Prompts</strong>
        <ol style="margin-top: 6px; color: var(--text-muted); padding-left: 18px;">${promptsHtml}</ol>
      </div>
    `;
  }

  function bindPdfAnalyzer() {
    const analyzeBtn = byId("pdf-analyze-btn");
    if (!analyzeBtn) return;

    analyzeBtn.addEventListener("click", async () => {
      const input = byId("pdf-analyzer-input");
      const file = input && input.files ? input.files[0] : null;

      try {
        setStatus("pdf-analyzer-status", "Analyzing PDF text...", "info");
        byId("pdf-analyzer-result").innerHTML = "";
        const text = await extractPdfText(file);
        if (!text) {
          throw new Error("This PDF appears to have no extractable text.");
        }
        const metrics = analyzeText(text);
        renderAnalyzerResult(metrics);
        setStatus("pdf-analyzer-status", "PDF analysis completed.", "success");
      } catch (err) {
        setStatus("pdf-analyzer-status", err.message || "Analysis failed.", "error");
      }
    });
  }

  function getCrosswordInputId(key) {
    return `cw-${key}`;
  }

  function getCurrentUser() {
    try {
      const localUser = localStorage.getItem("user");
      if (localUser) return JSON.parse(localUser);
      const sessionUser = sessionStorage.getItem("user");
      if (sessionUser) return JSON.parse(sessionUser);
    } catch {
    }
    return null;
  }

  function getFlashcardStorageKey() {
    const user = getCurrentUser();
    return user?.id ? `flashcards_${user.id}` : "flashcards_guest";
  }

  function getBackendUrl() {
    return "https://ec-eclassroom-backend.espaderarios.workers.dev";
  }

  function getCrosswordProgressStorageKey() {
    const user = getCurrentUser();
    return user?.id ? `${CROSSWORD_PROGRESS_KEY}::${user.id}` : `${CROSSWORD_PROGRESS_KEY}::guest`;
  }

  function getCrosswordMetadataStorageKey() {
    const user = getCurrentUser();
    return user?.id ? `${CROSSWORD_METADATA_KEY}::${user.id}` : `${CROSSWORD_METADATA_KEY}::guest`;
  }

  function getFeaturesSessionStorageKey() {
    const user = getCurrentUser();
    return user?.id ? `${FEATURES_SESSION_KEY}::${user.id}` : `${FEATURES_SESSION_KEY}::guest`;
  }

  function getFeaturesAchievementsStorageKey() {
    const user = getCurrentUser();
    return user?.id ? `${FEATURES_ACHIEVEMENTS_KEY}::${user.id}` : `${FEATURES_ACHIEVEMENTS_KEY}::guest`;
  }

  function getSampleFlashcardSets() {
    return [
      {
        setId: "sample-biology",
        setName: "Sample Biology",
        subjectName: "Biology",
        cards: [
          { question: "Cell organelle that produces ATP", answer: "Mitochondria" },
          { question: "Process plants use to make food", answer: "Photosynthesis" },
          { question: "Basic unit of life", answer: "Cell" },
          { question: "Molecule carrying genetic code", answer: "DNA" },
          { question: "Structure that contains chlorophyll", answer: "Chloroplast" }
        ]
      },
      {
        setId: "sample-math",
        setName: "Sample Algebra",
        subjectName: "Math",
        cards: [
          { question: "Value where function equals zero", answer: "Root" },
          { question: "Equation of a straight line form", answer: "Slope intercept" },
          { question: "Result of raising number to power", answer: "Exponent" },
          { question: "Number dividing another exactly", answer: "Factor" },
          { question: "Distance around a circle", answer: "Circumference" }
        ]
      }
    ];
  }

  function setDataHealth(status, message, source) {
    state.dataHealth.status = status || "idle";
    state.dataHealth.message = message || "";
    state.dataHealth.source = source || "none";

    const mount = byId("data-health-banner");
    const text = byId("data-health-text");
    if (!mount || !text) return;

    if (!message) {
      mount.hidden = true;
      text.textContent = "";
      return;
    }

    mount.hidden = false;
    text.textContent = message;
    mount.dataset.health = status || "info";
  }

  function loadAchievements() {
    try {
      const raw = localStorage.getItem(getFeaturesAchievementsStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        state.achievements = {
          ...state.achievements,
          ...parsed
        };
      }
    } catch {
    }
  }

  function saveAchievements() {
    try {
      localStorage.setItem(getFeaturesAchievementsStorageKey(), JSON.stringify(state.achievements));
    } catch {
    }
  }

  function saveFeaturesSession() {
    try {
      const crosswordValues = {};
      Object.keys(state.crossword.expectedByKey || {}).forEach((key) => {
        const input = byId(getCrosswordInputId(key));
        crosswordValues[key] = String(input?.value || "").toUpperCase();
      });

      const payload = {
        activePanelId: state.activePanelId,
        crossword: {
          selectedSetId: state.crossword.selectedSetId,
          puzzleId: state.crossword.puzzleId,
          rows: state.crossword.rows,
          cols: state.crossword.cols,
          entries: state.crossword.entries,
          expectedByKey: state.crossword.expectedByKey,
          startNumberByKey: state.crossword.startNumberByKey,
          inputValues: crosswordValues,
          typingDirection: state.crossword.typingDirection,
          startedAt: state.crossword.startedAt
        },
        matching: {
          selectedSetId: state.matching.selectedSetId,
          loadedSetId: state.matching.loadedSetId,
          items: state.matching.items,
          pairs: state.matching.pairs,
          checked: state.matching.checked,
          correctnessByQuestion: state.matching.correctnessByQuestion,
          startedAt: state.matching.startedAt
        },
        scramble: {
          selectedSetId: state.scramble.selectedSetId,
          loadedSetId: state.scramble.loadedSetId,
          terms: state.scramble.terms,
          current: state.scramble.current,
          score: state.scramble.score,
          attempts: state.scramble.attempts,
          streak: state.scramble.streak,
          hintStage: state.scramble.hintStage,
          missedTerms: state.scramble.missedTerms,
          startedAt: state.scramble.startedAt
        }
      };

      localStorage.setItem(getFeaturesSessionStorageKey(), JSON.stringify(payload));
    } catch {
    }
  }

  function loadFeaturesSession() {
    try {
      const raw = localStorage.getItem(getFeaturesSessionStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function normalizeSetSearch(value) {
    return String(value || "").trim().toLowerCase();
  }

  function filterSetsBySearch(sets, searchValue) {
    const q = normalizeSetSearch(searchValue);
    if (!q) return sets.slice();
    return sets.filter((set) => {
      const name = String(set.setName || "").toLowerCase();
      const subject = String(set.subjectName || "").toLowerCase();
      return name.includes(q) || subject.includes(q);
    });
  }

  function renderSetOptions(select, sets, selectedSetId, placeholder) {
    if (!select) return;
    select.innerHTML = [`<option value="">${escapeHtml(placeholder)}</option>`]
      .concat(
        sets.map((set) => `<option value="${escapeHtml(set.setId)}">${escapeHtml(set.setName)} (${set.cards.length} cards)</option>`)
      )
      .join("");
    select.value = selectedSetId || "";
  }

  function bindSetSearchInput(inputId, onSearch) {
    const input = byId(inputId);
    if (!input || input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("input", () => {
      onSearch(String(input.value || ""));
      saveFeaturesSession();
    });
  }

  function updateStickyActionBar() {
    const bar = byId("sticky-action-bar");
    const primary = byId("sticky-primary-btn");
    const secondary = byId("sticky-secondary-btn");
    if (!bar || !primary || !secondary) return;

    const panelId = state.activePanelId;
    if (!panelId) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    primary.hidden = false;
    secondary.hidden = false;

    if (panelId === "crossword-panel") {
      primary.textContent = "Generate";
      secondary.textContent = "Check";
      primary.onclick = () => byId("crossword-generate-btn")?.click();
      secondary.onclick = () => byId("crossword-check-btn")?.click();
      primary.disabled = Boolean(byId("crossword-generate-btn")?.disabled);
      secondary.disabled = Boolean(byId("crossword-check-btn")?.disabled);
      return;
    }

    if (panelId === "match-lines-panel") {
      primary.textContent = "Load Set";
      secondary.textContent = "Check";
      primary.onclick = () => byId("match-load-btn")?.click();
      secondary.onclick = () => byId("match-check-btn")?.click();
      primary.disabled = Boolean(byId("match-load-btn")?.disabled);
      secondary.disabled = Boolean(byId("match-check-btn")?.disabled);
      return;
    }

    if (panelId === "word-scramble-panel") {
      primary.textContent = "Check";
      secondary.textContent = "New Word";
      primary.onclick = () => byId("scramble-check-btn")?.click();
      secondary.onclick = () => byId("scramble-new-btn")?.click();
      primary.disabled = Boolean(byId("scramble-check-btn")?.disabled);
      secondary.disabled = Boolean(byId("scramble-new-btn")?.disabled);
      return;
    }

    bar.hidden = true;
  }

  function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 1) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function updateAchievementViews() {
    setText("crossword-achievement", `Best: ${Math.round((state.achievements.crosswordBestScore || 0) * 100)}% | Best time: ${formatSeconds(state.achievements.crosswordBestTimeSec)}`);
    setText("matching-achievement", `Best: ${Math.round((state.achievements.matchingBestScore || 0) * 100)}% | Best time: ${formatSeconds(state.achievements.matchingBestTimeSec)}`);
    setText("scramble-achievement", `Best streak: ${state.achievements.scrambleBestStreak || 0}`);
  }

  async function refreshAllSetLists() {
    const prevCrossword = state.crossword.selectedSetId;
    const prevMatching = state.matching.selectedSetId;
    const prevScramble = state.scramble.selectedSetId;
    await populateCrosswordSetSelect(prevCrossword);
    await populateMatchingSetSelect(prevMatching);
    await populateScrambleSetSelect(prevScramble);
    updateStickyActionBar();
  }

  function bindRecoveryActions() {
    const retryButtons = Array.from(document.querySelectorAll("[data-retry-sync]"));
    retryButtons.forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        setDataHealth("info", "Retrying sync...", "retry");
        await refreshAllSetLists();
      });
    });

    window.addEventListener("online", () => {
      if (state.dataHealth.status === "offline") {
        setDataHealth("info", "Back online. Tap Retry Sync to refresh your sets.", "online");
      }
    });

    window.addEventListener("offline", () => {
      setDataHealth("offline", "No internet connection. Using local cache or sample mode.", "offline");
    });
  }

  function loadFlashcardDataItemsFromLocal() {
    try {
      const raw = localStorage.getItem(getFlashcardStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function loadFlashcardDataItemsFromBackend() {
    const user = getCurrentUser();
    if (!user?.id || user?.authenticated !== true) {
      state.dataHealth = {
        status: "local",
        message: "Using local cache (sign in to sync your sets).",
        source: "local"
      };
      return [];
    }

    try {
      const endpoint = `${getBackendUrl()}/api/flashcards?userId=${encodeURIComponent(user.id)}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        state.dataHealth = {
          status: "error",
          message: "Sync failed. Server returned an error. Using local cache if available.",
          source: "local"
        };
        return [];
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      localStorage.setItem(getFlashcardStorageKey(), JSON.stringify(items));
      state.dataHealth = {
        status: "online",
        message: "Synced with backend.",
        source: "backend"
      };
      return items;
    } catch {
      state.dataHealth = {
        status: navigator.onLine ? "error" : "offline",
        message: navigator.onLine
          ? "Sync failed. Using local cache if available."
          : "No internet connection. Using local cache.",
        source: "local"
      };
      return [];
    }
  }

  async function loadFlashcardDataItems() {
    const backendItems = await loadFlashcardDataItemsFromBackend();
    if (backendItems.length > 0) {
      return backendItems;
    }
    const localItems = loadFlashcardDataItemsFromLocal();
    if (localItems.length > 0) {
      if (!state.dataHealth.message) {
        state.dataHealth = {
          status: "local",
          message: "Using local cache.",
          source: "local"
        };
      }
      return localItems;
    }

    state.dataHealth = {
      status: navigator.onLine ? "empty" : "offline",
      message: navigator.onLine
        ? "No flashcard sets found. Try sync or sample mode."
        : "No internet and no local cache found. Try again when online or use sample mode.",
      source: "none"
    };
    return [];
  }

  async function loadCrosswordSets() {
    const items = await loadFlashcardDataItems();
    const cards = items.filter((item) => item?.type === "card" && item.set_id);
    const sets = items.filter((item) => item?.type === "set" && item.set_id);
    const map = new Map();

    sets.forEach((set) => {
      map.set(set.set_id, {
        setId: set.set_id,
        setName: set.set_name || "Untitled Set",
        subjectName: set.subject_name || "",
        cards: []
      });
    });

    cards.forEach((card) => {
      if (!map.has(card.set_id)) {
        map.set(card.set_id, {
          setId: card.set_id,
          setName: card.set_name || "Untitled Set",
          subjectName: card.subject_name || "",
          cards: []
        });
      }
      map.get(card.set_id).cards.push(card);
    });

    const realSets = Array.from(map.values())
      .filter((set) => set.cards.length > 0)
      .sort((a, b) => a.setName.localeCompare(b.setName));

    if (realSets.length) {
      state.usingSampleMode = false;
      setDataHealth(state.dataHealth.status, state.dataHealth.message, state.dataHealth.source);
      return realSets;
    }

    const sampleSets = getSampleFlashcardSets();
    state.usingSampleMode = true;
    setDataHealth("sample", "No sets found. Sample mode is active so you can still try each game.", "sample");
    return sampleSets;
  }

  function getCrosswordConfig() {
    const purpose = String(byId("crossword-purpose-select")?.value || "review");
    const difficulty = String(byId("crossword-difficulty-select")?.value || "medium");
    const minWordLength = Math.max(3, Math.min(12, Number(byId("crossword-min-word-length")?.value || 3) || 3));
    const maxWordLength = Math.max(minWordLength, Math.min(30, Number(byId("crossword-max-word-length")?.value || 14) || 14));

    return {
      purpose,
      setId: String(byId("crossword-set-select")?.value || ""),
      wordCount: Math.max(3, Math.min(25, Number(byId("crossword-word-count")?.value || 10) || 10)),
      difficulty,
      gridMode: String(byId("crossword-grid-mode-select")?.value || "auto"),
      gridSize: Math.max(8, Math.min(24, Number(byId("crossword-grid-size")?.value || 12) || 12)),
      keepSpaces: Boolean(byId("crossword-keep-spaces")?.checked),
      allowSymbols: Boolean(byId("crossword-allow-symbols")?.checked),
      minWordLength,
      maxWordLength,
      checkMode: String(byId("crossword-check-mode-select")?.value || "submit")
    };
  }

  function applyPurposeDefaults(purpose) {
    const difficultySelect = byId("crossword-difficulty-select");
    const wordCountInput = byId("crossword-word-count");
    const maxWordInput = byId("crossword-max-word-length");
    const checkModeSelect = byId("crossword-check-mode-select");

    if (!difficultySelect || !wordCountInput || !maxWordInput || !checkModeSelect) return;

    if (purpose === "review") {
      difficultySelect.value = "medium";
      wordCountInput.value = "12";
      maxWordInput.value = "14";
      checkModeSelect.value = "submit";
    } else if (purpose === "terminology") {
      difficultySelect.value = "easy";
      wordCountInput.value = "10";
      maxWordInput.value = "10";
      checkModeSelect.value = "immediate";
    } else if (purpose === "assessment") {
      difficultySelect.value = "hard";
      wordCountInput.value = "15";
      maxWordInput.value = "16";
      checkModeSelect.value = "completion";
    } else if (purpose === "reinforcement") {
      difficultySelect.value = "easy";
      wordCountInput.value = "8";
      maxWordInput.value = "9";
      checkModeSelect.value = "immediate";
    }
  }

  function normalizeCrosswordAnswer(answer, keepSpaces, allowSymbols) {
    let value = String(answer || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    value = value.replace(/[.,?!-]/g, "");
    value = value.replace(/\s+/g, " ").trim().toUpperCase();
    if (!value) return "";
    if (!keepSpaces) {
      value = value.replace(/\s+/g, "");
    }
    value = allowSymbols
      ? value.replace(/[^A-Z0-9\s\-]/g, "")
      : value.replace(/[^A-Z]/g, "");
    return value.replace(/\s+/g, keepSpaces ? " " : "").trim();
  }

  function maxAnswerLengthByDifficulty(difficulty) {
    if (difficulty === "easy") return 6;
    if (difficulty === "hard") return 18;
    return 12;
  }

  function answersLookSimilar(a, b) {
    if (!a || !b || a === b) return false;
    if (a.length < 4 || b.length < 4) return false;
    if (a.includes(b) || b.includes(a)) return true;

    const maxLen = Math.max(a.length, b.length);
    let same = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      if (a[i] === b[i]) same += 1;
    }
    return same / maxLen >= 0.8;
  }

  function buildEntriesFromSet(set, config) {
    const entries = [];
    const warnings = [];
    const seen = new Set();
    let skippedEmpty = 0;
    let skippedTooLong = 0;
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    const difficultyCap = maxAnswerLengthByDifficulty(config.difficulty);
    const maxLen = Math.min(difficultyCap, config.maxWordLength);

    set.cards.forEach((card) => {
      const clue = String(card?.question || "").trim();
      const normalized = normalizeCrosswordAnswer(card?.answer, config.keepSpaces, config.allowSymbols);
      const answer = normalized.replace(/\s+/g, "");

      if (!clue || !answer) {
        skippedEmpty += 1;
        return;
      }

      if (answer.length < config.minWordLength) {
        skippedInvalid += 1;
        return;
      }

      if (!config.allowSymbols && /[^A-Z]/.test(answer)) {
        skippedInvalid += 1;
        return;
      }

      if (answer.length > maxLen) {
        skippedTooLong += 1;
        return;
      }

      if (seen.has(answer)) {
        skippedDuplicate += 1;
        return;
      }

      seen.add(answer);
      if (clue.toUpperCase().includes(answer)) {
        warnings.push(`Clue may reveal its own answer: ${answer}. Consider revising that flashcard question.`);
      }

      entries.push({
        clue,
        answer,
        originalQuestion: clue,
        originalAnswer: String(card?.answer || "").trim()
      });
    });

    if (skippedEmpty) warnings.push(`${skippedEmpty} card(s) had empty question/answer and were skipped.`);
    if (skippedInvalid) warnings.push(`${skippedInvalid} answer(s) had unsupported characters.`);
    if (skippedTooLong) warnings.push(`${skippedTooLong} answer(s) were too long for the chosen difficulty.`);
    if (skippedDuplicate) warnings.push(`${skippedDuplicate} duplicate answer(s) were removed.`);

    const similarPairs = [];
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        if (answersLookSimilar(entries[i].answer, entries[j].answer)) {
          similarPairs.push(`${entries[i].answer}/${entries[j].answer}`);
          if (similarPairs.length >= 3) break;
        }
      }
      if (similarPairs.length >= 3) break;
    }
    if (similarPairs.length) {
      warnings.push(`Some answers are very similar: ${similarPairs.join(", ")}.`);
    }

    if (entries.length < 3) {
      warnings.push("Too few usable flashcards were selected.");
    }

    return {
      entries: entries.sort((a, b) => b.answer.length - a.answer.length).slice(0, config.wordCount),
      warnings
    };
  }

  function makeCellKey(row, col) {
    return `${row}-${col}`;
  }

  function parseCellKey(key) {
    const [row, col] = String(key).split("-").map((part) => Number(part));
    return { row, col };
  }

  function canPlaceWord(board, size, word, row, col, direction) {
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    if (row < 0 || col < 0 || endRow >= size || endCol >= size) return { ok: false, intersections: 0 };

    if (board[makeCellKey(row - dr, col - dc)] || board[makeCellKey(endRow + dr, endCol + dc)]) {
      return { ok: false, intersections: 0 };
    }

    let intersections = 0;
    for (let i = 0; i < word.length; i += 1) {
      const r = row + dr * i;
      const c = col + dc * i;
      const key = makeCellKey(r, c);
      const existing = board[key];
      if (existing && existing !== word[i]) return { ok: false, intersections: 0 };

      if (existing === word[i]) {
        intersections += 1;
      } else if (direction === "across") {
        if (board[makeCellKey(r - 1, c)] || board[makeCellKey(r + 1, c)]) return { ok: false, intersections: 0 };
      } else if (board[makeCellKey(r, c - 1)] || board[makeCellKey(r, c + 1)]) {
        return { ok: false, intersections: 0 };
      }
    }

    return { ok: true, intersections };
  }

  function placeWord(board, word, row, col, direction) {
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "across" ? 1 : 0;
    for (let i = 0; i < word.length; i += 1) {
      board[makeCellKey(row + dr * i, col + dc * i)] = word[i];
    }
  }

  function buildCrosswordLayout(entries, size) {
    const board = {};
    const placed = [];
    const skipped = [];

    entries.forEach((entry, index) => {
      const word = entry.answer;
      const candidates = [];

      if (index === 0) {
        const startRow = Math.floor(size / 2);
        const startCol = Math.max(0, Math.floor((size - word.length) / 2));
        const center = canPlaceWord(board, size, word, startRow, startCol, "across");
        if (center.ok) candidates.push({ row: startRow, col: startCol, direction: "across", intersections: 0 });
      } else {
        const filled = Object.keys(board).map((key) => ({ key, char: board[key], ...parseCellKey(key) }));
        for (let i = 0; i < word.length; i += 1) {
          const letter = word[i];
          filled.forEach((cell) => {
            if (cell.char !== letter) return;

            const across = canPlaceWord(board, size, word, cell.row, cell.col - i, "across");
            if (across.ok) {
              candidates.push({ row: cell.row, col: cell.col - i, direction: "across", intersections: across.intersections });
            }

            const down = canPlaceWord(board, size, word, cell.row - i, cell.col, "down");
            if (down.ok) {
              candidates.push({ row: cell.row - i, col: cell.col, direction: "down", intersections: down.intersections });
            }
          });
        }
      }

      const center = (size - 1) / 2;
      const best = candidates
        .filter((candidate) => index === 0 || candidate.intersections > 0)
        .sort((a, b) => {
          const aCenterDist = Math.abs(a.row - center) + Math.abs(a.col - center);
          const bCenterDist = Math.abs(b.row - center) + Math.abs(b.col - center);
          if (b.intersections !== a.intersections) return b.intersections - a.intersections;
          if (aCenterDist !== bCenterDist) return aCenterDist - bCenterDist;
          return (Math.random() - 0.5);
        })[0];

      if (!best) {
        skipped.push(entry);
        return;
      }

      placeWord(board, word, best.row, best.col, best.direction);
      placed.push({ ...entry, row: best.row, col: best.col, direction: best.direction });
    });

    if (!placed.length) {
      return { rows: 0, cols: 0, entries: [], expectedByKey: {}, startNumberByKey: {}, skipped };
    }

    const coords = Object.keys(board).map(parseCellKey);
    const minRow = Math.min(...coords.map((item) => item.row));
    const maxRow = Math.max(...coords.map((item) => item.row));
    const minCol = Math.min(...coords.map((item) => item.col));
    const maxCol = Math.max(...coords.map((item) => item.col));

    const expectedByKey = {};
    Object.keys(board).forEach((key) => {
      const point = parseCellKey(key);
      expectedByKey[makeCellKey(point.row - minRow, point.col - minCol)] = board[key];
    });

    const normalizedEntries = placed.map((entry) => ({
      ...entry,
      row: entry.row - minRow,
      col: entry.col - minCol
    }));

    const rows = maxRow - minRow + 1;
    const cols = maxCol - minCol + 1;
    const startNumberByKey = {};
    let nextNumber = 1;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const key = makeCellKey(row, col);
        if (!expectedByKey[key]) continue;

        const leftBlocked = !expectedByKey[makeCellKey(row, col - 1)];
        const topBlocked = !expectedByKey[makeCellKey(row - 1, col)];
        const hasAcross = Boolean(expectedByKey[makeCellKey(row, col + 1)]);
        const hasDown = Boolean(expectedByKey[makeCellKey(row + 1, col)]);

        if ((leftBlocked && hasAcross) || (topBlocked && hasDown)) {
          startNumberByKey[key] = nextNumber;
          nextNumber += 1;
        }
      }
    }

    normalizedEntries.forEach((entry) => {
      entry.number = startNumberByKey[makeCellKey(entry.row, entry.col)] || null;
    });

    return {
      rows,
      cols,
      entries: normalizedEntries.filter((entry) => entry.number),
      expectedByKey,
      startNumberByKey,
      skipped
    };
  }

  function renderCrosswordWarnings(warnings) {
    const mount = byId("crossword-warnings");
    if (!mount) return;
    if (!warnings || warnings.length === 0) {
      mount.style.display = "none";
      mount.innerHTML = "";
      return;
    }
    mount.style.display = "block";
    mount.innerHTML = `<strong style="color: var(--text);">Academic review safeguards</strong><ul style="margin: 8px 0 0 18px;">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function getCrosswordEntryId(entry) {
    if (!entry) return "";
    return `${entry.number}-${entry.direction}`;
  }

  function getCrosswordEntryKeys(entry) {
    if (!entry) return [];
    const dr = entry.direction === "down" ? 1 : 0;
    const dc = entry.direction === "across" ? 1 : 0;
    const keys = [];
    for (let i = 0; i < entry.answer.length; i += 1) {
      keys.push(makeCellKey(entry.row + dr * i, entry.col + dc * i));
    }
    return keys;
  }

  function findBestEntryForCell(cellKey, preferredDirection) {
    const entries = (state.crossword.entries || []).filter((entry) => getCrosswordEntryKeys(entry).includes(cellKey));
    if (!entries.length) return null;
    const preferred = entries.find((entry) => entry.direction === preferredDirection);
    if (preferred) return preferred;
    return entries.slice().sort((a, b) => a.number - b.number)[0];
  }

  function highlightCrosswordEntry(entryId) {
    const cells = Array.from(document.querySelectorAll(".cw-cell"));
    cells.forEach((cell) => cell.classList.remove("active-word"));

    const clueButtons = Array.from(document.querySelectorAll(".cw-clue-btn"));
    clueButtons.forEach((button) => button.classList.remove("active"));

    if (!entryId) return;

    const entry = (state.crossword.entries || []).find((item) => getCrosswordEntryId(item) === entryId);
    if (!entry) return;

    getCrosswordEntryKeys(entry).forEach((key) => {
      const input = byId(getCrosswordInputId(key));
      if (input?.parentElement) {
        input.parentElement.classList.add("active-word");
      }
    });

    const clue = document.querySelector(`.cw-clue-btn[data-entry-id="${entryId}"]`);
    if (clue) clue.classList.add("active");
  }

  function focusCrosswordEntry(entryId, focusFirstCell) {
    const entry = (state.crossword.entries || []).find((item) => getCrosswordEntryId(item) === entryId);
    if (!entry) return;
    state.crossword.activeEntryId = entryId;
    setCrosswordTypingDirection(entry.direction);
    highlightCrosswordEntry(entryId);

    if (focusFirstCell) {
      const firstKey = makeCellKey(entry.row, entry.col);
      const input = byId(getCrosswordInputId(firstKey));
      if (input) input.focus();
    }
  }

  function updateCrosswordProgress() {
    const keys = Object.keys(state.crossword.expectedByKey || {});
    const total = keys.length;
    if (!total) {
      setText("crossword-progress", "Progress: 0/0");
      return;
    }

    let correct = 0;
    keys.forEach((key) => {
      const input = byId(getCrosswordInputId(key));
      const value = String(input?.value || "").toUpperCase();
      if (value && value === state.crossword.expectedByKey[key]) {
        correct += 1;
      }
    });

    setText("crossword-progress", `Progress: ${correct}/${total}`);
  }

  function toggleCrosswordReviewMode() {
    const keys = Object.keys(state.crossword.expectedByKey || {});
    if (!keys.length) {
      setStatus("crossword-status", "Generate a crossword first.", "info");
      return;
    }

    state.crossword.reviewOnlyMissed = !state.crossword.reviewOnlyMissed;
    keys.forEach((key) => {
      const input = byId(getCrosswordInputId(key));
      const cell = input?.parentElement;
      if (!input || !cell) return;
      const expected = state.crossword.expectedByKey[key];
      const current = String(input.value || "").toUpperCase();
      const isCorrect = current && current === expected;
      cell.classList.toggle("review-hidden", state.crossword.reviewOnlyMissed && isCorrect);
    });

    setStatus(
      "crossword-status",
      state.crossword.reviewOnlyMissed ? "Review mistakes mode: showing only missed cells." : "Review mode off.",
      "info"
    );
    saveFeaturesSession();
  }

  function setCrosswordActionGating() {
    const hasPuzzle = Object.keys(state.crossword.expectedByKey || {}).length > 0;
    [
      "crossword-check-btn",
      "crossword-reset-btn",
      "crossword-review-btn",
      "crossword-reveal-letter-btn",
      "crossword-reveal-word-btn",
      "crossword-reveal-btn",
      "crossword-answer-key-btn"
    ].forEach((id) => setDisabled(id, !hasPuzzle));
    updateStickyActionBar();
  }

  function renderCrosswordClues() {
    const acrossList = byId("crossword-across-list");
    const downList = byId("crossword-down-list");
    if (!acrossList || !downList) return;

    const across = state.crossword.entries.filter((entry) => entry.direction === "across").sort((a, b) => a.number - b.number);
    const down = state.crossword.entries.filter((entry) => entry.direction === "down").sort((a, b) => a.number - b.number);

    acrossList.innerHTML = across
      .map(
        (entry) => `<li><button type="button" class="cw-clue-btn" data-entry-id="${getCrosswordEntryId(entry)}"><strong>${entry.number}.</strong> ${escapeHtml(entry.clue)}</button></li>`
      )
      .join("");
    downList.innerHTML = down
      .map(
        (entry) => `<li><button type="button" class="cw-clue-btn" data-entry-id="${getCrosswordEntryId(entry)}"><strong>${entry.number}.</strong> ${escapeHtml(entry.clue)}</button></li>`
      )
      .join("");

    Array.from(document.querySelectorAll(".cw-clue-btn")).forEach((button) => {
      button.addEventListener("click", () => {
        const entryId = String(button.dataset.entryId || "");
        if (!entryId) return;
        focusCrosswordEntry(entryId, true);
      });
    });

    highlightCrosswordEntry(state.crossword.activeEntryId);
  }

  function setCrosswordTypingDirection(direction) {
    state.crossword.typingDirection = direction === "down" ? "down" : "across";
    const indicator = byId("crossword-direction");
    if (!indicator) return;
    indicator.textContent = `Typing direction: ${state.crossword.typingDirection === "down" ? "Down ↓" : "Across →"}`;
  }

  function renderCrosswordGrid() {
    const board = byId("crossword-grid-board");
    if (!board) return;

    const { expectedByKey, startNumberByKey } = state.crossword;
    board.style.gridTemplateColumns = `repeat(${Math.max(1, state.crossword.cols || 1)}, var(--cw-cell-size, 36px))`;
    const cells = [];

    for (let row = 0; row < state.crossword.rows; row += 1) {
      for (let col = 0; col < state.crossword.cols; col += 1) {
        const key = `${row}-${col}`;
        if (expectedByKey[key]) {
          const number = startNumberByKey[key];
          cells.push(`
            <div class="cw-cell" data-key="${key}">
              ${number ? `<span class="cw-number">${number}</span>` : ""}
              <input id="${getCrosswordInputId(key)}" class="cw-input" data-key="${key}" maxlength="1" aria-label="Crossword ${row + 1}-${col + 1}">
            </div>
          `);
        } else {
          cells.push('<div class="cw-block" aria-hidden="true"></div>');
        }
      }
    }

    board.innerHTML = cells.join("");
    setCrosswordTypingDirection(state.crossword.typingDirection);

    const keyDirections = {};
    const keyStartDirections = {};
    (state.crossword.entries || []).forEach((entry) => {
      const isAcross = entry.direction === "across";
      const isDown = entry.direction === "down";
      if (!isAcross && !isDown) return;

      const startKey = makeCellKey(entry.row, entry.col);
      if (!keyStartDirections[startKey]) {
        keyStartDirections[startKey] = { across: false, down: false };
      }
      if (isAcross) keyStartDirections[startKey].across = true;
      if (isDown) keyStartDirections[startKey].down = true;

      const dr = isDown ? 1 : 0;
      const dc = isAcross ? 1 : 0;
      for (let i = 0; i < entry.answer.length; i += 1) {
        const key = makeCellKey(entry.row + dr * i, entry.col + dc * i);
        if (!keyDirections[key]) {
          keyDirections[key] = { across: false, down: false };
        }
        if (isAcross) keyDirections[key].across = true;
        if (isDown) keyDirections[key].down = true;
      }
    });

    const resolveDirectionForKey = (key, preferredDirection) => {
      const startDirections = keyStartDirections[key] || { across: false, down: false };
      if (startDirections.down && !startDirections.across) return "down";
      if (startDirections.across && !startDirections.down) return "across";

      const directions = keyDirections[key] || { across: false, down: false };
      if (preferredDirection && directions[preferredDirection]) {
        return preferredDirection;
      }
      if (directions.down && !directions.across) return "down";
      if (directions.across && !directions.down) return "across";

      const point = parseCellKey(key);
      const leftBlocked = !expectedByKey[makeCellKey(point.row, point.col - 1)];
      const topBlocked = !expectedByKey[makeCellKey(point.row - 1, point.col)];
      const hasAcross = Boolean(expectedByKey[makeCellKey(point.row, point.col + 1)]);
      const hasDown = Boolean(expectedByKey[makeCellKey(point.row + 1, point.col)]);
      const isAcrossStart = leftBlocked && hasAcross;
      const isDownStart = topBlocked && hasDown;

      if (isDownStart && !isAcrossStart) return "down";
      if (isAcrossStart && !isDownStart) return "across";
      if (preferredDirection === "down" || preferredDirection === "across") {
        return preferredDirection;
      }
      return "across";
    };

    const getAdjacentKey = (key, direction, step = 1) => {
      const point = parseCellKey(key);
      const dr = direction === "down" ? step : 0;
      const dc = direction === "across" ? step : 0;
      const nextKey = makeCellKey(point.row + dr, point.col + dc);
      return expectedByKey[nextKey] ? nextKey : null;
    };

    const inputs = Array.from(document.querySelectorAll(".cw-input"));
    inputs.forEach((input) => {
      input.addEventListener("focus", () => {
        const key = String(input.dataset.key || "");
        state.crossword.lastFocusedKey = key;
        const resolvedDirection = resolveDirectionForKey(key, state.crossword.typingDirection);
        setCrosswordTypingDirection(resolvedDirection);
        const entry = findBestEntryForCell(key, resolvedDirection);
        if (entry) {
          state.crossword.activeEntryId = getCrosswordEntryId(entry);
          highlightCrosswordEntry(state.crossword.activeEntryId);
        }
      });

      input.addEventListener("click", () => {
        const key = String(input.dataset.key || "");
        const directions = keyDirections[key] || { across: false, down: false };
        const isAmbiguous = directions.across && directions.down;

        const isRepeatedClick = state.crossword.lastClickedKey === key;
        if (isAmbiguous && isRepeatedClick) {
          setCrosswordTypingDirection(state.crossword.typingDirection === "down" ? "across" : "down");
        } else {
          setCrosswordTypingDirection(resolveDirectionForKey(key, state.crossword.typingDirection));
        }

        const entry = findBestEntryForCell(key, state.crossword.typingDirection);
        if (entry) {
          state.crossword.activeEntryId = getCrosswordEntryId(entry);
          highlightCrosswordEntry(state.crossword.activeEntryId);
        }

        state.crossword.lastClickedKey = key;
        state.crossword.lastFocusedKey = key;
      });

      input.addEventListener("input", () => {
        const key = String(input.dataset.key || "");
        const direction = resolveDirectionForKey(key, state.crossword.typingDirection);
        setCrosswordTypingDirection(direction);

        const normalized = input.value.replace(/[^A-Za-z0-9]/g, "").slice(-1).toUpperCase();
        input.value = normalized;
        input.parentElement.classList.remove("correct", "incorrect");
        updateCrosswordProgress();

        const checkMode = String(byId("crossword-check-mode-select")?.value || "submit");
        if (checkMode === "immediate") {
          checkCrossword(false);
        } else if (checkMode === "completion") {
          const allFilled = inputs.every((item) => String(item.value || "").trim().length === 1);
          if (allFilled) {
            checkCrossword(true);
          }
        }

        if (normalized) {
          const nextKey = getAdjacentKey(key, direction, 1);
          if (nextKey) {
            const nextInput = byId(getCrosswordInputId(nextKey));
            if (nextInput) nextInput.focus();
          }
        }

        saveFeaturesSession();
      });

      input.addEventListener("keydown", (event) => {
        const key = String(input.dataset.key || "");
        if (!key) return;

        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          let nextKey = null;
          if (event.key === "ArrowDown") {
            setCrosswordTypingDirection("down");
            nextKey = getAdjacentKey(key, "down", 1);
          } else if (event.key === "ArrowUp") {
            setCrosswordTypingDirection("down");
            nextKey = getAdjacentKey(key, "down", -1);
          } else if (event.key === "ArrowRight") {
            setCrosswordTypingDirection("across");
            nextKey = getAdjacentKey(key, "across", 1);
          } else if (event.key === "ArrowLeft") {
            setCrosswordTypingDirection("across");
            nextKey = getAdjacentKey(key, "across", -1);
          }

          if (nextKey) {
            const nextInput = byId(getCrosswordInputId(nextKey));
            if (nextInput) nextInput.focus();
          }
          return;
        }

        if (event.key === "Backspace" && !input.value) {
          const direction = resolveDirectionForKey(key, state.crossword.typingDirection);
          setCrosswordTypingDirection(direction);
          const previousKey = getAdjacentKey(key, direction, -1);
          if (previousKey) {
            const previousInput = byId(getCrosswordInputId(previousKey));
            if (previousInput) previousInput.focus();
          }
        }
      });
    });

    updateCrosswordProgress();
    highlightCrosswordEntry(state.crossword.activeEntryId);
    updateStickyActionBar();
  }

  function checkCrossword(showStatus = true) {
    const keys = Object.keys(state.crossword.expectedByKey);
    if (!keys.length) {
      setStatus("crossword-status", "Generate a crossword first.", "info");
      return;
    }
    let correct = 0;

    keys.forEach((key) => {
      const expected = state.crossword.expectedByKey[key];
      const input = byId(getCrosswordInputId(key));
      if (!input) return;

      const value = String(input.value || "").toUpperCase();
      const cell = input.parentElement;
      cell.classList.remove("correct", "incorrect");

      if (value && value === expected) {
        correct += 1;
        cell.classList.add("correct");
      } else {
        cell.classList.add("incorrect");
      }
    });

    const total = keys.length;
    saveCrosswordProgress({
      puzzleId: state.crossword.puzzleId,
      setId: state.crossword.selectedSetId,
      score: correct,
      total,
      completed: correct === total
    });

    if (showStatus) {
      if (correct === total) {
        const elapsedSec = state.crossword.startedAt ? (Date.now() - state.crossword.startedAt) / 1000 : null;
        const scoreRatio = total > 0 ? correct / total : 0;
        state.achievements.crosswordBestScore = Math.max(state.achievements.crosswordBestScore || 0, scoreRatio);
        if (elapsedSec && (!state.achievements.crosswordBestTimeSec || elapsedSec < state.achievements.crosswordBestTimeSec)) {
          state.achievements.crosswordBestTimeSec = elapsedSec;
        }
        saveAchievements();
        updateAchievementViews();
        setStatus("crossword-status", `Perfect score: ${correct}/${total}.`, "success");
      } else {
        setStatus("crossword-status", `Current score: ${correct}/${total}. Keep going.`, "info");
      }
    }

    updateCrosswordProgress();
    saveFeaturesSession();
  }

  function resetCrossword() {
    const inputs = Array.from(document.querySelectorAll(".cw-input"));
    inputs.forEach((input) => {
      input.value = "";
      if (input.parentElement) {
        input.parentElement.classList.remove("correct", "incorrect", "review-hidden");
      }
    });
    state.crossword.reviewOnlyMissed = false;
    updateCrosswordProgress();
    setStatus("crossword-status", "Crossword reset.", "info");
    saveFeaturesSession();
  }

  function revealSingleLetter() {
    const keys = Object.keys(state.crossword.expectedByKey);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const expected = state.crossword.expectedByKey[key];
      const input = byId(getCrosswordInputId(key));
      if (!input) continue;

      const current = String(input.value || "").toUpperCase();
      if (current !== expected) {
        input.value = expected;
        if (input.parentElement) {
          input.parentElement.classList.remove("incorrect");
          input.parentElement.classList.add("correct");
        }
        setStatus("crossword-status", "One letter revealed.", "info");
        updateCrosswordProgress();
        saveFeaturesSession();
        return;
      }
    }
    setStatus("crossword-status", "All letters are already correct.", "success");
  }

  function revealSingleWord() {
    if (!window.confirm("Reveal a full word? This can reduce your challenge score.")) {
      return;
    }
    const entries = state.crossword.entries || [];
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const entry = entries[entryIndex];
      const dr = entry.direction === "down" ? 1 : 0;
      const dc = entry.direction === "across" ? 1 : 0;
      let shouldReveal = false;

      for (let i = 0; i < entry.answer.length; i += 1) {
        const key = makeCellKey(entry.row + dr * i, entry.col + dc * i);
        const input = byId(getCrosswordInputId(key));
        const current = String(input?.value || "").toUpperCase();
        if (current !== entry.answer[i]) {
          shouldReveal = true;
          break;
        }
      }

      if (!shouldReveal) continue;

      for (let i = 0; i < entry.answer.length; i += 1) {
        const key = makeCellKey(entry.row + dr * i, entry.col + dc * i);
        const input = byId(getCrosswordInputId(key));
        if (!input) continue;
        input.value = entry.answer[i];
        if (input.parentElement) {
          input.parentElement.classList.remove("incorrect");
          input.parentElement.classList.add("correct");
        }
      }

      setStatus("crossword-status", `Word ${entry.number} revealed.`, "info");
      updateCrosswordProgress();
      saveFeaturesSession();
      return;
    }

    setStatus("crossword-status", "All words are already complete.", "success");
  }

  function revealCrossword() {
    if (!window.confirm("Reveal all answers? This action cannot be undone.")) {
      return;
    }
    const keys = Object.keys(state.crossword.expectedByKey);
    keys.forEach((key) => {
      const input = byId(getCrosswordInputId(key));
      if (!input) return;
      input.value = state.crossword.expectedByKey[key];
      if (input.parentElement) {
        input.parentElement.classList.remove("incorrect");
        input.parentElement.classList.add("correct");
      }
    });
    updateCrosswordProgress();
    setStatus("crossword-status", "Answers revealed.", "success");
    saveFeaturesSession();
  }

  function saveCrosswordProgress(record) {
    if (!record || !record.puzzleId) return;
    try {
      const key = getCrosswordProgressStorageKey();
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      const history = Array.isArray(raw) ? raw : [];
      history.unshift({ ...record, timestamp: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(history.slice(0, 80)));
    } catch {
    }
  }

  function saveCrosswordMetadata(record) {
    if (!record || !record.puzzleId) return;
    try {
      const key = getCrosswordMetadataStorageKey();
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      const rows = Array.isArray(raw) ? raw : [];
      rows.unshift(record);
      localStorage.setItem(key, JSON.stringify(rows.slice(0, 80)));
    } catch {
    }
  }

  function renderAnswerKey() {
    const mount = byId("crossword-answer-key");
    if (!mount) return;

    const showing = mount.style.display === "block";
    if (showing) {
      mount.style.display = "none";
      return;
    }

    const data = state.crossword.answerKey;
    if (!data) {
      mount.innerHTML = "No answer key available yet.";
      mount.style.display = "block";
      return;
    }

    const lines = [];
    for (let row = 0; row < data.rows; row += 1) {
      const chars = [];
      for (let col = 0; col < data.cols; col += 1) {
        chars.push(data.expectedByKey[makeCellKey(row, col)] || "■");
      }
      lines.push(chars.join(" "));
    }

    const mapping = data.entries
      .slice()
      .sort((a, b) => a.number - b.number || a.direction.localeCompare(b.direction))
      .map((entry) => `<li><strong>${entry.number} ${entry.direction}</strong>: ${escapeHtml(entry.answer)} — ${escapeHtml(entry.clue)}</li>`)
      .join("");

    mount.innerHTML = `
      <div><strong style="color: var(--text);">Set:</strong> ${escapeHtml(data.setName || "Unknown")}</div>
      <pre style="margin-top:8px; padding:8px; border-radius:8px; background: var(--card-bg); color: var(--text); overflow:auto;">${escapeHtml(lines.join("\n"))}</pre>
      <ol style="margin: 8px 0 0 18px;">${mapping}</ol>
    `;
    mount.style.display = "block";
  }

  function recommendedGridSize(entries, config) {
    if (config.gridMode === "fixed") return config.gridSize;
    const longest = Math.max(...entries.map((entry) => entry.answer.length));
    return Math.max(8, Math.min(24, longest * 2));
  }

  async function populateCrosswordSetSelect(preferredSetId = state.crossword.selectedSetId) {
    const select = byId("crossword-set-select");
    const generateBtn = byId("crossword-generate-btn");
    const searchInput = byId("crossword-set-search");
    if (!select) return;

    state.crossword.sets = await loadCrosswordSets();
    if (!state.crossword.sets.length) {
      select.innerHTML = "<option value=''>No sets found</option>";
      state.crossword.selectedSetId = null;
      if (generateBtn) generateBtn.disabled = true;
      return;
    }

    const searchValue = String(searchInput?.value || "");
    const filteredSets = filterSetsBySearch(state.crossword.sets, searchValue);
    renderSetOptions(select, filteredSets, preferredSetId, filteredSets.length ? "Select a flashcard set" : "No matching sets");

    const hasPreferred = Boolean(preferredSetId) && state.crossword.sets.some((set) => set.setId === preferredSetId);
    state.crossword.selectedSetId = hasPreferred ? preferredSetId : null;
    select.value = state.crossword.selectedSetId || "";
    if (generateBtn) generateBtn.disabled = !state.crossword.selectedSetId;

    bindSetSearchInput("crossword-set-search", () => {
      populateCrosswordSetSelect(state.crossword.selectedSetId);
    });
  }

  function generateCrossword() {
    const config = getCrosswordConfig();
    const set = state.crossword.sets.find((item) => item.setId === config.setId);
    state.crossword.selectedSetId = config.setId;

    if (!set) {
      renderCrosswordWarnings(["Please select a flashcard set."]);
      setStatus("crossword-status", "No flashcard set selected.", "error");
      return;
    }

    const prepared = buildEntriesFromSet(set, config);
    const warnings = prepared.warnings.slice();
    if (prepared.entries.length < 3) {
      renderCrosswordWarnings(warnings);
      setStatus("crossword-status", "Not enough valid cards to generate a crossword.", "error");
      return;
    }

    const size = recommendedGridSize(prepared.entries, config);
    const layout = buildCrosswordLayout(prepared.entries, size);
    if (layout.skipped.length) {
      warnings.push(`${layout.skipped.length} answer(s) were too hard to place with intersections.`);
    }
    if (layout.entries.length < 3) {
      warnings.push("Too few words fit in the current grid. Try easier settings or a larger fixed grid.");
      renderCrosswordWarnings(warnings);
      setStatus("crossword-status", "Generation failed. Adjust your settings and try again.", "error");
      return;
    }

    state.crossword.expectedByKey = layout.expectedByKey;
    state.crossword.startNumberByKey = layout.startNumberByKey;
    state.crossword.rows = layout.rows;
    state.crossword.cols = layout.cols;
    state.crossword.entries = layout.entries;
    setCrosswordTypingDirection("across");
    state.crossword.lastFocusedKey = null;
    state.crossword.lastClickedKey = null;
    state.crossword.activeEntryId = null;
    state.crossword.reviewOnlyMissed = false;
    state.crossword.startedAt = Date.now();
    state.crossword.puzzleId = `cw_${Date.now()}`;
    state.crossword.answerKey = {
      setId: set.setId,
      setName: set.setName,
      rows: layout.rows,
      cols: layout.cols,
      expectedByKey: { ...layout.expectedByKey },
      entries: layout.entries.map((entry) => ({
        number: entry.number,
        direction: entry.direction,
        clue: entry.clue,
        answer: entry.answer
      }))
    };

    saveCrosswordMetadata({
      puzzleId: state.crossword.puzzleId,
      setId: set.setId,
      setName: set.setName,
      generatedAt: new Date().toISOString(),
      purpose: config.purpose,
      difficulty: config.difficulty,
      gridSize: `${layout.rows}x${layout.cols}`,
      wordsRequested: config.wordCount,
      wordsPlaced: layout.entries.length,
      completionStatus: "generated"
    });

    const keyMount = byId("crossword-answer-key");
    if (keyMount) {
      keyMount.style.display = "none";
      keyMount.innerHTML = "";
    }

    renderCrosswordWarnings(warnings);
    renderCrosswordClues();
    renderCrosswordGrid();
    setCrosswordActionGating();
    setStatus("crossword-status", `Crossword generated: ${layout.entries.length} words on ${layout.rows}x${layout.cols}.`, "success");
    saveFeaturesSession();
  }

  async function bindCrossword() {
    await populateCrosswordSetSelect();
    restoreCrosswordSessionIfAvailable();

    const setSelect = byId("crossword-set-select");
    const setupToggleBtn = byId("crossword-setup-toggle");
    const setupPanel = byId("crossword-setup-panel");
    const generateBtn = byId("crossword-generate-btn");
    const syncBtn = byId("crossword-sync-btn");
    const purposeSelect = byId("crossword-purpose-select");
    const gridModeSelect = byId("crossword-grid-mode-select");
    const gridSizeInput = byId("crossword-grid-size");

    const checkBtn = byId("crossword-check-btn");
    const resetBtn = byId("crossword-reset-btn");
    const revealLetterBtn = byId("crossword-reveal-letter-btn");
    const revealWordBtn = byId("crossword-reveal-word-btn");
    const revealBtn = byId("crossword-reveal-btn");
    const answerKeyBtn = byId("crossword-answer-key-btn");
    const reviewBtn = byId("crossword-review-btn");

    if (setSelect) {
      setSelect.addEventListener("change", () => {
        state.crossword.selectedSetId = setSelect.value;
        if (generateBtn) {
          generateBtn.disabled = !state.crossword.selectedSetId;
        }
        saveFeaturesSession();
        updateStickyActionBar();
      });
    }

    if (purposeSelect) {
      purposeSelect.addEventListener("change", () => {
        applyPurposeDefaults(purposeSelect.value);
      });
    }

    if (gridModeSelect && gridSizeInput) {
      const updateFixedGridInput = () => {
        gridSizeInput.disabled = gridModeSelect.value !== "fixed";
      };
      updateFixedGridInput();
      gridModeSelect.addEventListener("change", updateFixedGridInput);
    }

    if (setupToggleBtn && setupPanel) {
      const syncToggleState = () => {
        setupToggleBtn.setAttribute("aria-expanded", setupPanel.hidden ? "false" : "true");
      };

      setupToggleBtn.addEventListener("click", () => {
        setupPanel.hidden = !setupPanel.hidden;
        syncToggleState();
      });

      syncToggleState();
    }

    if (generateBtn) generateBtn.addEventListener("click", generateCrossword);

    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        setStatus("crossword-status", "Syncing flashcard sets from backend...", "info");
        const previousSetId = state.crossword.selectedSetId;
        await populateCrosswordSetSelect(previousSetId);
        if (state.crossword.sets.length) {
          renderCrosswordWarnings([
            state.crossword.selectedSetId
              ? "Sets updated. Current set selection was kept."
              : "Sets updated. Choose a flashcard set, then click Generate Crossword."
          ]);
          setStatus("crossword-status", `Sync complete. ${state.crossword.sets.length} set(s) available.`, "success");
          if (state.usingSampleMode) {
            setStatus("crossword-status", "Sync complete. Using sample mode because no personal sets were found.", "info");
          }
        } else {
          renderCrosswordWarnings(["No flashcard sets were found for your connected account after sync."]);
          setStatus("crossword-status", "Sync complete, but no sets were found.", "info");
        }
        saveFeaturesSession();
        syncBtn.disabled = false;
      });
    }

    if (checkBtn) checkBtn.addEventListener("click", checkCrossword);
    if (resetBtn) resetBtn.addEventListener("click", resetCrossword);
    if (revealLetterBtn) revealLetterBtn.addEventListener("click", revealSingleLetter);
    if (revealWordBtn) revealWordBtn.addEventListener("click", revealSingleWord);
    if (revealBtn) revealBtn.addEventListener("click", revealCrossword);
    if (answerKeyBtn) answerKeyBtn.addEventListener("click", renderAnswerKey);
    if (reviewBtn) reviewBtn.addEventListener("click", toggleCrosswordReviewMode);

    setCrosswordActionGating();
    updateCrosswordProgress();
    updateStickyActionBar();

    if (!state.crossword.sets.length) {
      renderCrosswordWarnings(["No flashcard sets were found for your connected account. Create/sync flashcards first, then return here."]);
      setStatus("crossword-status", "No flashcard sets found.", "info");
      return;
    }

    renderCrosswordWarnings(["Choose a flashcard set first, then click Generate Crossword."]);
    setStatus(
      "crossword-status",
      state.usingSampleMode ? "Sample mode active. Select a sample set to start." : "Select a flashcard set to start.",
      "info"
    );
  }

  function renderMatchingBoard() {
    const questionMount = byId("match-questions-list");
    const answerMount = byId("match-answers-list");
    if (!questionMount || !answerMount) return;

    const items = state.matching.items || [];
    if (!items.length) {
      questionMount.innerHTML = "<div class=\"tool-hint\">Choose and load a flashcard set first.</div>";
      answerMount.innerHTML = "<div class=\"tool-hint\">Answers will appear after loading a set.</div>";
      const reviewMount = byId("match-review-list");
      if (reviewMount) reviewMount.innerHTML = "";
      drawMatchingLines();
      updateMatchingProgress();
      setMatchingActionGating();
      return;
    }

    const answerOrder = shuffle(items.map((item) => ({ id: item.id, answer: item.answer })));
    questionMount.innerHTML = items
      .map((item) => `<button class="match-item" data-question-id="${item.id}" type="button">${escapeHtml(item.question)}</button>`)
      .join("");
    answerMount.innerHTML = answerOrder
      .map((item) => `<button class="match-item" data-answer-id="${item.id}" type="button">${escapeHtml(item.answer)}</button>`)
      .join("");

    questionMount.querySelectorAll("[data-question-id]").forEach((button) => {
      let holdTimer = null;
      const selectQuestion = () => {
        state.matching.selectedQuestionId = button.dataset.questionId;
        updateMatchingUi();
      };

      button.addEventListener("click", () => {
        selectQuestion();
      });

      button.addEventListener("pointerdown", () => {
        holdTimer = window.setTimeout(() => {
          selectQuestion();
          setStatus("match-status", "Question locked. Tap an answer to connect.", "info");
        }, 320);
      });

      const clearHold = () => {
        if (holdTimer) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      button.addEventListener("pointerup", clearHold);
      button.addEventListener("pointerleave", clearHold);
    });

    answerMount.querySelectorAll("[data-answer-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const answerId = button.dataset.answerId;
        const selectedQuestionId = state.matching.selectedQuestionId;
        if (!selectedQuestionId) {
          setStatus("match-status", "Select a question first.", "info");
          return;
        }

        Object.keys(state.matching.pairs).forEach((questionId) => {
          if (state.matching.pairs[questionId] === answerId) {
            delete state.matching.pairs[questionId];
          }
        });

        state.matching.pairs[selectedQuestionId] = answerId;
        state.matching.selectedQuestionId = null;
        state.matching.checked = false;
        state.matching.correctnessByQuestion = {};
        setStatus("match-status", "Connection created.", "info");
        updateMatchingUi();
        saveFeaturesSession();
      });
    });

    updateMatchingUi();
    setMatchingActionGating();
  }

  function updateMatchingProgress() {
    const total = (state.matching.items || []).length;
    const connected = Object.keys(state.matching.pairs || {}).length;
    setText("match-progress", `Progress: ${connected}/${total}`);
  }

  function renderMatchingFallbackList() {
    const mount = byId("match-fallback-list");
    if (!mount) return;
    if (state.matching.displayMode !== "list") {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    mount.hidden = false;
    const items = state.matching.items || [];
    if (!items.length) {
      mount.innerHTML = "<div class=\"tool-hint\">Load a set to use list mode.</div>";
      return;
    }

    mount.innerHTML = `<ol style=\"margin:0; padding-left:18px;\">${items.map((item) => {
      const answerId = state.matching.pairs[item.id];
      const answerText = (items.find((row) => row.id === answerId)?.answer) || "—";
      return `<li><strong>${escapeHtml(item.question)}</strong><br><span>${escapeHtml(answerText)}</span></li>`;
    }).join("")}</ol>`;
  }

  function renderMatchingReviewList() {
    const mount = byId("match-review-list");
    if (!mount) return;
    if (!state.matching.reviewOnlyWrong) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    const items = state.matching.items || [];
    const mistakes = items.filter((item) => state.matching.correctnessByQuestion[item.id] === false);
    if (!mistakes.length) {
      mount.hidden = false;
      mount.innerHTML = "<div class=\"tool-hint\">No mistakes to review.</div>";
      return;
    }

    mount.hidden = false;
    mount.innerHTML = `<ol style=\"margin:0; padding-left:18px;\">${mistakes.map((item) => {
      const selectedAnswerId = state.matching.pairs[item.id];
      const selectedAnswer = (items.find((row) => row.id === selectedAnswerId)?.answer) || "No answer selected";
      return `<li><strong>${escapeHtml(item.question)}</strong><br>Picked: ${escapeHtml(selectedAnswer)}<br>Correct: ${escapeHtml(item.answer)}</li>`;
    }).join("")}</ol>`;
  }

  function toggleMatchingMode() {
    state.matching.displayMode = state.matching.displayMode === "lines" ? "list" : "lines";
    const svg = byId("match-lines-svg");
    if (svg) {
      svg.style.display = state.matching.displayMode === "lines" ? "block" : "none";
    }
    const toggleBtn = byId("match-toggle-mode-btn");
    if (toggleBtn) {
      toggleBtn.textContent = state.matching.displayMode === "lines" ? "List Mode" : "Line Mode";
    }
    renderMatchingFallbackList();
    saveFeaturesSession();
  }

  function toggleMatchingReviewMode() {
    state.matching.reviewOnlyWrong = !state.matching.reviewOnlyWrong;
    renderMatchingReviewList();
    setStatus("match-status", state.matching.reviewOnlyWrong ? "Review mistakes mode on." : "Review mode off.", "info");
    saveFeaturesSession();
  }

  function setMatchingActionGating() {
    const hasItems = (state.matching.items || []).length > 0;
    setDisabled("match-check-btn", !hasItems);
    setDisabled("match-reset-btn", !hasItems);
    setDisabled("match-review-btn", !hasItems);
    setDisabled("match-toggle-mode-btn", !hasItems);
    updateStickyActionBar();
  }

  function updateMatchingUi() {
    const questionButtons = Array.from(document.querySelectorAll("[data-question-id]"));
    const answerButtons = Array.from(document.querySelectorAll("[data-answer-id]"));
    const mappedAnswerIds = new Set(Object.values(state.matching.pairs));

    questionButtons.forEach((button) => {
      const questionId = button.dataset.questionId;
      button.classList.toggle("selected", state.matching.selectedQuestionId === questionId);
      button.classList.toggle("matched", Boolean(state.matching.pairs[questionId]));
    });

    answerButtons.forEach((button) => {
      const answerId = button.dataset.answerId;
      button.classList.toggle("matched", mappedAnswerIds.has(answerId));
      button.classList.remove("selected");
    });

    drawMatchingLines();
    updateMatchingProgress();
    renderMatchingFallbackList();
    renderMatchingReviewList();
    updateStickyActionBar();
  }

  function drawMatchingLines() {
    const board = byId("matching-board");
    const svg = byId("match-lines-svg");
    if (!board || !svg) return;

    const boardRect = board.getBoundingClientRect();
    svg.setAttribute("width", String(Math.max(0, boardRect.width)));
    svg.setAttribute("height", String(Math.max(0, boardRect.height)));
    svg.innerHTML = "";

    Object.keys(state.matching.pairs).forEach((questionId) => {
      const answerId = state.matching.pairs[questionId];
      const questionEl = board.querySelector(`[data-question-id="${questionId}"]`);
      const answerEl = board.querySelector(`[data-answer-id="${answerId}"]`);
      if (!questionEl || !answerEl) return;

      const qRect = questionEl.getBoundingClientRect();
      const aRect = answerEl.getBoundingClientRect();
      const x1 = qRect.right - boardRect.left;
      const y1 = qRect.top + qRect.height / 2 - boardRect.top;
      const x2 = aRect.left - boardRect.left;
      const y2 = aRect.top + aRect.height / 2 - boardRect.top;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1.toFixed(2));
      line.setAttribute("y1", y1.toFixed(2));
      line.setAttribute("x2", x2.toFixed(2));
      line.setAttribute("y2", y2.toFixed(2));
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-linecap", "round");

      if (state.matching.checked) {
        const correct = state.matching.correctnessByQuestion[questionId] === true;
        line.setAttribute("stroke", correct ? "#16a34a" : "#dc2626");
      } else {
        line.setAttribute("stroke", "#2563eb");
      }

      svg.appendChild(line);
    });
  }

  function checkMatchingAnswers() {
    const items = state.matching.items || [];
    if (!items.length) {
      setStatus("match-status", "Load a flashcard set first.", "info");
      return;
    }

    const correctness = {};
    let correctCount = 0;

    items.forEach((item) => {
      const isCorrect = state.matching.pairs[item.id] === item.id;
      correctness[item.id] = isCorrect;
      if (isCorrect) correctCount += 1;
    });

    state.matching.checked = true;
    state.matching.correctnessByQuestion = correctness;

    const total = items.length;
    if (correctCount === total) {
      const elapsedSec = state.matching.startedAt ? (Date.now() - state.matching.startedAt) / 1000 : null;
      const scoreRatio = total > 0 ? correctCount / total : 0;
      state.achievements.matchingBestScore = Math.max(state.achievements.matchingBestScore || 0, scoreRatio);
      if (elapsedSec && (!state.achievements.matchingBestTimeSec || elapsedSec < state.achievements.matchingBestTimeSec)) {
        state.achievements.matchingBestTimeSec = elapsedSec;
      }
      saveAchievements();
      updateAchievementViews();
      setStatus("match-status", `Perfect match: ${correctCount}/${total}.`, "success");
    } else {
      setStatus("match-status", `Score: ${correctCount}/${total}. Adjust the red lines and try again.`, "info");
    }

    drawMatchingLines();
    renderMatchingReviewList();
    saveFeaturesSession();
  }

  function resetMatchingBoard() {
    state.matching.selectedQuestionId = null;
    state.matching.pairs = {};
    state.matching.checked = false;
    state.matching.correctnessByQuestion = {};
    state.matching.reviewOnlyWrong = false;
    renderMatchingBoard();
    updateMatchingProgress();
    setStatus("match-status", "All matches cleared.", "info");
    saveFeaturesSession();
  }

  function buildMatchingItemsFromSet(set) {
    if (!set || !Array.isArray(set.cards)) return [];

    return set.cards
      .map((card, index) => {
        const question = String(card?.question || "").trim();
        const answer = String(card?.answer || "").trim();
        if (!question || !answer) return null;
        return {
          id: `m_${index}_${Math.random().toString(36).slice(2, 7)}`,
          question,
          answer
        };
      })
      .filter(Boolean);
  }

  async function populateMatchingSetSelect(preferredSetId = state.matching.selectedSetId) {
    const select = byId("match-set-select");
    const loadBtn = byId("match-load-btn");
    const searchInput = byId("match-set-search");
    if (!select) return;

    state.matching.sets = await loadCrosswordSets();
    if (!state.matching.sets.length) {
      select.innerHTML = "<option value=''>No sets found</option>";
      state.matching.selectedSetId = null;
      if (loadBtn) loadBtn.disabled = true;
      return;
    }

    const searchValue = String(searchInput?.value || "");
    const filteredSets = filterSetsBySearch(state.matching.sets, searchValue);
    renderSetOptions(select, filteredSets, preferredSetId, filteredSets.length ? "Select a flashcard set" : "No matching sets");

    const hasPreferred = Boolean(preferredSetId) && state.matching.sets.some((set) => set.setId === preferredSetId);
    state.matching.selectedSetId = hasPreferred ? preferredSetId : null;
    select.value = state.matching.selectedSetId || "";
    if (loadBtn) loadBtn.disabled = !state.matching.selectedSetId;

    bindSetSearchInput("match-set-search", () => {
      populateMatchingSetSelect(state.matching.selectedSetId);
    });
  }

  function loadMatchingFromSelectedSet() {
    const set = state.matching.sets.find((item) => item.setId === state.matching.selectedSetId);
    if (!set) {
      state.matching.items = [];
      state.matching.loadedSetId = null;
      resetMatchingBoard();
      setStatus("match-status", "No flashcard set selected.", "error");
      setMatchingActionGating();
      return;
    }

    const items = buildMatchingItemsFromSet(set);
    state.matching.items = items;
    state.matching.loadedSetId = set.setId;
    state.matching.selectedQuestionId = null;
    state.matching.pairs = {};
    state.matching.checked = false;
    state.matching.correctnessByQuestion = {};
    state.matching.reviewOnlyWrong = false;
    state.matching.startedAt = Date.now();
    renderMatchingBoard();

    if (!items.length) {
      setStatus("match-status", "Selected set has no valid question/answer pairs.", "error");
      setMatchingActionGating();
      return;
    }

    setStatus("match-status", `Loaded ${items.length} cards for matching.`, "success");
    setMatchingActionGating();
    saveFeaturesSession();
  }

  function bindMatching() {
    const setSelect = byId("match-set-select");
    const syncBtn = byId("match-sync-btn");
    const loadBtn = byId("match-load-btn");
    const toggleModeBtn = byId("match-toggle-mode-btn");
    const reviewBtn = byId("match-review-btn");

    const checkBtn = byId("match-check-btn");
    const resetBtn = byId("match-reset-btn");

    populateMatchingSetSelect().then(() => {
      if (!state.matching.sets.length) {
        setStatus("match-status", "No flashcard sets found.", "info");
      } else {
        setStatus(
          "match-status",
          state.usingSampleMode ? "Sample mode active. Select a sample set to load matching items." : "Select a flashcard set to load matching items.",
          "info"
        );
      }
      renderMatchingBoard();
      restoreMatchingSessionIfAvailable();
      setMatchingActionGating();
      updateMatchingProgress();
      updateStickyActionBar();
    });

    if (setSelect) {
      setSelect.addEventListener("change", () => {
        state.matching.selectedSetId = setSelect.value;
        if (loadBtn) loadBtn.disabled = !state.matching.selectedSetId;
        if (state.matching.selectedSetId) {
          loadMatchingFromSelectedSet();
        } else {
          state.matching.items = [];
          state.matching.loadedSetId = null;
          resetMatchingBoard();
          setStatus("match-status", "No flashcard set selected.", "info");
        }
        saveFeaturesSession();
      });
    }

    if (loadBtn) {
      loadBtn.addEventListener("click", loadMatchingFromSelectedSet);
    }

    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        setStatus("match-status", "Syncing flashcard sets from backend...", "info");
        const previousSetId = state.matching.selectedSetId;
        const previousLoadedSetId = state.matching.loadedSetId;
        await populateMatchingSetSelect(previousSetId);
        if (!state.matching.sets.length) {
          setStatus("match-status", "Sync complete, but no sets were found.", "info");
          state.matching.items = [];
          state.matching.loadedSetId = null;
          renderMatchingBoard();
        } else {
          const sameSelection = Boolean(state.matching.selectedSetId) && state.matching.selectedSetId === previousSetId;
          const hasPreservableState =
            sameSelection
            && previousLoadedSetId === state.matching.selectedSetId
            && Array.isArray(state.matching.items)
            && state.matching.items.length > 0;

          if (hasPreservableState) {
            setStatus(
              "match-status",
              `Sync complete. ${state.matching.sets.length} set(s) available. Current matching progress was preserved.`,
              "success"
            );
            updateMatchingUi();
          } else if (state.matching.selectedSetId) {
            loadMatchingFromSelectedSet();
          } else {
            setStatus("match-status", `Sync complete. ${state.matching.sets.length} set(s) available.`, "success");
            renderMatchingBoard();
          }
        }
        setMatchingActionGating();
        saveFeaturesSession();
        syncBtn.disabled = false;
      });
    }

    if (checkBtn) checkBtn.addEventListener("click", checkMatchingAnswers);
    if (resetBtn) resetBtn.addEventListener("click", resetMatchingBoard);
    if (toggleModeBtn) toggleModeBtn.addEventListener("click", toggleMatchingMode);
    if (reviewBtn) reviewBtn.addEventListener("click", toggleMatchingReviewMode);

    window.addEventListener("resize", drawMatchingLines);
  }

  function scrambleWord(word) {
    if (!word || word.length < 2) return word || "";
    const chars = word.split("");
    let shuffled = word;
    let safety = 0;

    while (shuffled === word && safety < 20) {
      safety += 1;
      for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = chars[i];
        chars[i] = chars[j];
        chars[j] = temp;
      }
      shuffled = chars.join("");
    }

    return shuffled;
  }

  function pickNewScrambleTerm() {
    const sourceTerms = state.scramble.terms || [];
    if (!sourceTerms.length) {
      const wordEl = byId("scramble-word");
      const hintEl = byId("scramble-hint");
      if (wordEl) wordEl.textContent = "Load a flashcard set to begin.";
      if (hintEl) hintEl.textContent = "Hint: --";
      state.scramble.current = null;
      state.scramble.hintStage = 0;
      setScrambleActionGating();
      updateScrambleProgress();
      return;
    }

    const candidates = sourceTerms.filter((item) => !state.scramble.current || item.word !== state.scramble.current.word);
    const selectionPool = candidates.length ? candidates : sourceTerms;
    const chosen = selectionPool[Math.floor(Math.random() * selectionPool.length)];
    state.scramble.current = chosen;

    const scrambled = scrambleWord(chosen.word);
    const wordEl = byId("scramble-word");
    const hintEl = byId("scramble-hint");
    const input = byId("scramble-answer-input");
    if (wordEl) wordEl.textContent = scrambled;
    if (hintEl) hintEl.textContent = `Hint: ${chosen.hint}`;
    if (input) input.value = "";
    state.scramble.hintStage = 0;
    setScrambleActionGating();
    updateScrambleProgress();
    saveFeaturesSession();
  }

  function updateScrambleProgress() {
    setText("scramble-progress", `Streak: ${state.scramble.streak || 0}`);
  }

  function renderScrambleReviewList() {
    const mount = byId("scramble-review-list");
    if (!mount) return;
    if (!state.scramble.reviewOnlyMissed) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    const missed = Array.isArray(state.scramble.missedTerms) ? state.scramble.missedTerms : [];
    if (!missed.length) {
      mount.hidden = false;
      mount.innerHTML = "<div class=\"tool-hint\">No missed terms yet.</div>";
      return;
    }

    mount.hidden = false;
    mount.innerHTML = `<ol style=\"margin:0; padding-left:18px;\">${missed.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ol>`;
  }

  function toggleScrambleReviewMode() {
    state.scramble.reviewOnlyMissed = !state.scramble.reviewOnlyMissed;
    renderScrambleReviewList();
    setStatus("scramble-status", state.scramble.reviewOnlyMissed ? "Review mistakes mode on." : "Review mode off.", "info");
    saveFeaturesSession();
  }

  function revealScrambleHintStage() {
    if (!state.scramble.current) {
      setStatus("scramble-status", "Load a set first to use hints.", "info");
      return;
    }

    const word = String(state.scramble.current.word || "");
    const hintEl = byId("scramble-hint");
    state.scramble.hintStage = Math.min(3, (state.scramble.hintStage || 0) + 1);

    if (!hintEl) return;
    if (state.scramble.hintStage === 1) {
      hintEl.textContent = `Hint 1: starts with ${word.slice(0, 1)}.`;
    } else if (state.scramble.hintStage === 2) {
      hintEl.textContent = `Hint 2: ${word.length} letters.`;
    } else {
      const revealCount = Math.min(3, Math.max(2, Math.floor(word.length / 2)));
      hintEl.textContent = `Hint 3: ${word.slice(0, revealCount)}${"_".repeat(Math.max(0, word.length - revealCount))}`;
    }

    saveFeaturesSession();
  }

  function setScrambleActionGating() {
    const hasTerms = (state.scramble.terms || []).length > 0;
    setDisabled("scramble-check-btn", !hasTerms);
    setDisabled("scramble-new-btn", !hasTerms);
    setDisabled("scramble-hint-btn", !hasTerms);
    setDisabled("scramble-review-btn", !hasTerms);
    const input = byId("scramble-answer-input");
    if (input) input.disabled = !hasTerms;
    updateStickyActionBar();
  }

  function checkScrambleAnswer() {
    const input = byId("scramble-answer-input");
    if (!input || !state.scramble.current) {
      setStatus("scramble-status", "Load a flashcard set and press New Word to start.", "info");
      return;
    }

    const answer = String(input.value || "").trim().toUpperCase();
    if (!answer) {
      setStatus("scramble-status", "Type your answer first.", "info");
      return;
    }

    state.scramble.attempts += 1;
    const expected = state.scramble.current.word.toUpperCase();
    if (answer === expected) {
      state.scramble.score += 1;
      state.scramble.streak = (state.scramble.streak || 0) + 1;
      state.achievements.scrambleBestStreak = Math.max(state.achievements.scrambleBestStreak || 0, state.scramble.streak || 0);
      saveAchievements();
      updateAchievementViews();
      setStatus(
        "scramble-status",
        `Correct. Score ${state.scramble.score}/${state.scramble.attempts}. Click New Word for another term.`,
        "success"
      );
      input.value = "";
    } else {
      state.scramble.streak = 0;
      const missed = new Set(state.scramble.missedTerms || []);
      missed.add(state.scramble.current.word);
      state.scramble.missedTerms = Array.from(missed).slice(0, 80);
      setStatus(
        "scramble-status",
        `Not quite. Score ${state.scramble.score}/${state.scramble.attempts}. Try again.`,
        "error"
      );
    }
    updateScrambleProgress();
    renderScrambleReviewList();
    saveFeaturesSession();
  }

  function buildScrambleTermsFromSet(set) {
    if (!set || !Array.isArray(set.cards)) return [];

    const seen = new Set();
    const terms = [];
    set.cards.forEach((card) => {
      const rawAnswer = String(card?.answer || "").trim();
      const rawQuestion = String(card?.question || "").trim();
      if (!rawAnswer) return;

      const normalizedWord = rawAnswer
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .trim();

      if (normalizedWord.length < 3) return;
      if (seen.has(normalizedWord)) return;
      seen.add(normalizedWord);

      terms.push({
        word: normalizedWord,
        hint: rawQuestion || rawAnswer
      });
    });

    return terms;
  }

  async function populateScrambleSetSelect(preferredSetId = state.scramble.selectedSetId) {
    const select = byId("scramble-set-select");
    const loadBtn = byId("scramble-load-btn");
    const searchInput = byId("scramble-set-search");
    if (!select) return;

    state.scramble.sets = await loadCrosswordSets();
    if (!state.scramble.sets.length) {
      select.innerHTML = "<option value=''>No sets found</option>";
      state.scramble.selectedSetId = null;
      if (loadBtn) loadBtn.disabled = true;
      return;
    }

    const searchValue = String(searchInput?.value || "");
    const filteredSets = filterSetsBySearch(state.scramble.sets, searchValue);
    renderSetOptions(select, filteredSets, preferredSetId, filteredSets.length ? "Select a flashcard set" : "No matching sets");

    const hasPreferred = Boolean(preferredSetId) && state.scramble.sets.some((set) => set.setId === preferredSetId);
    state.scramble.selectedSetId = hasPreferred ? preferredSetId : null;
    select.value = state.scramble.selectedSetId || "";
    if (loadBtn) loadBtn.disabled = !state.scramble.selectedSetId;

    bindSetSearchInput("scramble-set-search", () => {
      populateScrambleSetSelect(state.scramble.selectedSetId);
    });
  }

  function restoreCrosswordSessionIfAvailable() {
    const snapshot = state.sessionSnapshot?.crossword;
    if (!snapshot) return;

    if (snapshot.selectedSetId && state.crossword.sets.some((set) => set.setId === snapshot.selectedSetId)) {
      state.crossword.selectedSetId = snapshot.selectedSetId;
      const select = byId("crossword-set-select");
      if (select) select.value = snapshot.selectedSetId;
      const generateBtn = byId("crossword-generate-btn");
      if (generateBtn) generateBtn.disabled = false;
    }

    const hasPuzzle = snapshot.expectedByKey && Object.keys(snapshot.expectedByKey).length > 0;
    if (!hasPuzzle) return;

    state.crossword.puzzleId = snapshot.puzzleId || state.crossword.puzzleId;
    state.crossword.rows = Number(snapshot.rows || 0);
    state.crossword.cols = Number(snapshot.cols || 0);
    state.crossword.entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    state.crossword.expectedByKey = snapshot.expectedByKey || {};
    state.crossword.startNumberByKey = snapshot.startNumberByKey || {};
    state.crossword.typingDirection = snapshot.typingDirection || "across";
    state.crossword.startedAt = snapshot.startedAt || Date.now();
    state.crossword.reviewOnlyMissed = false;

    renderCrosswordClues();
    renderCrosswordGrid();
    const values = snapshot.inputValues || {};
    Object.keys(values).forEach((key) => {
      const input = byId(getCrosswordInputId(key));
      if (input) input.value = String(values[key] || "").slice(0, 1).toUpperCase();
    });
    updateCrosswordProgress();
    setCrosswordActionGating();
    setStatus("crossword-status", "Resumed your last crossword session.", "info");
  }

  function restoreMatchingSessionIfAvailable() {
    const snapshot = state.sessionSnapshot?.matching;
    if (!snapshot) return;

    if (snapshot.selectedSetId && state.matching.sets.some((set) => set.setId === snapshot.selectedSetId)) {
      state.matching.selectedSetId = snapshot.selectedSetId;
      const select = byId("match-set-select");
      if (select) select.value = snapshot.selectedSetId;
      const loadBtn = byId("match-load-btn");
      if (loadBtn) loadBtn.disabled = false;
    }

    if (!Array.isArray(snapshot.items) || !snapshot.items.length) return;
    state.matching.loadedSetId = snapshot.loadedSetId || null;
    state.matching.items = snapshot.items;
    state.matching.pairs = snapshot.pairs || {};
    state.matching.checked = snapshot.checked === true;
    state.matching.correctnessByQuestion = snapshot.correctnessByQuestion || {};
    state.matching.startedAt = snapshot.startedAt || Date.now();
    renderMatchingBoard();
    updateMatchingUi();
    setStatus("match-status", "Resumed your last matching session.", "info");
  }

  function restoreScrambleSessionIfAvailable() {
    const snapshot = state.sessionSnapshot?.scramble;
    if (!snapshot) return;

    if (snapshot.selectedSetId && state.scramble.sets.some((set) => set.setId === snapshot.selectedSetId)) {
      state.scramble.selectedSetId = snapshot.selectedSetId;
      const select = byId("scramble-set-select");
      if (select) select.value = snapshot.selectedSetId;
      const loadBtn = byId("scramble-load-btn");
      if (loadBtn) loadBtn.disabled = false;
    }

    if (!Array.isArray(snapshot.terms) || !snapshot.terms.length) return;
    state.scramble.loadedSetId = snapshot.loadedSetId || null;
    state.scramble.terms = snapshot.terms;
    state.scramble.current = snapshot.current || null;
    state.scramble.score = Number(snapshot.score || 0);
    state.scramble.attempts = Number(snapshot.attempts || 0);
    state.scramble.streak = Number(snapshot.streak || 0);
    state.scramble.hintStage = Number(snapshot.hintStage || 0);
    state.scramble.missedTerms = Array.isArray(snapshot.missedTerms) ? snapshot.missedTerms : [];
    state.scramble.startedAt = snapshot.startedAt || Date.now();

    if (state.scramble.current) {
      const wordEl = byId("scramble-word");
      if (wordEl) wordEl.textContent = scrambleWord(state.scramble.current.word);
      setText("scramble-hint", `Hint: ${state.scramble.current.hint}`);
    } else {
      pickNewScrambleTerm();
    }

    updateScrambleProgress();
    renderScrambleReviewList();
    setScrambleActionGating();
    setStatus("scramble-status", "Resumed your last scramble session.", "info");
  }

  function loadScrambleFromSelectedSet() {
    const set = state.scramble.sets.find((item) => item.setId === state.scramble.selectedSetId);
    if (!set) {
      state.scramble.terms = [];
      state.scramble.loadedSetId = null;
      state.scramble.current = null;
      state.scramble.score = 0;
      state.scramble.attempts = 0;
      state.scramble.streak = 0;
      state.scramble.missedTerms = [];
      state.scramble.reviewOnlyMissed = false;
      pickNewScrambleTerm();
      setStatus("scramble-status", "No flashcard set selected.", "error");
      return;
    }

    const terms = buildScrambleTermsFromSet(set);
    state.scramble.terms = terms;
  state.scramble.loadedSetId = set.setId;
    state.scramble.current = null;
    state.scramble.score = 0;
    state.scramble.attempts = 0;
    state.scramble.streak = 0;
    state.scramble.missedTerms = [];
    state.scramble.reviewOnlyMissed = false;
    state.scramble.startedAt = Date.now();
    pickNewScrambleTerm();

    if (!terms.length) {
      setStatus("scramble-status", "Selected set has no valid terms for scramble.", "error");
      return;
    }

    setStatus("scramble-status", `Loaded ${terms.length} term(s). Unscramble and submit your answer.`, "success");
    setScrambleActionGating();
    updateScrambleProgress();
    renderScrambleReviewList();
    saveFeaturesSession();
  }

  function bindWordScramble() {
    const checkBtn = byId("scramble-check-btn");
    const newBtn = byId("scramble-new-btn");
    const hintBtn = byId("scramble-hint-btn");
    const reviewBtn = byId("scramble-review-btn");
    const input = byId("scramble-answer-input");
    const setSelect = byId("scramble-set-select");
    const syncBtn = byId("scramble-sync-btn");
    const loadBtn = byId("scramble-load-btn");

    populateScrambleSetSelect().then(() => {
      if (!state.scramble.sets.length) {
        setStatus("scramble-status", "No flashcard sets found.", "info");
      } else {
        setStatus(
          "scramble-status",
          state.usingSampleMode ? "Sample mode active. Select a sample set to load terms." : "Select a flashcard set to load scramble terms.",
          "info"
        );
      }
      pickNewScrambleTerm();
      restoreScrambleSessionIfAvailable();
      setScrambleActionGating();
      updateScrambleProgress();
      renderScrambleReviewList();
      updateStickyActionBar();
    });

    if (setSelect) {
      setSelect.addEventListener("change", () => {
        state.scramble.selectedSetId = setSelect.value;
        if (loadBtn) loadBtn.disabled = !state.scramble.selectedSetId;
        if (state.scramble.selectedSetId) {
          loadScrambleFromSelectedSet();
        } else {
          state.scramble.terms = [];
          state.scramble.loadedSetId = null;
          state.scramble.current = null;
          state.scramble.score = 0;
          state.scramble.attempts = 0;
          state.scramble.streak = 0;
          pickNewScrambleTerm();
          setStatus("scramble-status", "No flashcard set selected.", "info");
        }
        saveFeaturesSession();
      });
    }

    if (loadBtn) {
      loadBtn.addEventListener("click", loadScrambleFromSelectedSet);
    }

    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        setStatus("scramble-status", "Syncing flashcard sets from backend...", "info");
        const previousSetId = state.scramble.selectedSetId;
        const previousLoadedSetId = state.scramble.loadedSetId;
        await populateScrambleSetSelect(previousSetId);
        if (!state.scramble.sets.length) {
          setStatus("scramble-status", "Sync complete, but no sets were found.", "info");
          state.scramble.terms = [];
          state.scramble.loadedSetId = null;
          state.scramble.current = null;
          pickNewScrambleTerm();
        } else {
          const sameSelection = Boolean(state.scramble.selectedSetId) && state.scramble.selectedSetId === previousSetId;
          const hasPreservableState =
            sameSelection
            && previousLoadedSetId === state.scramble.selectedSetId
            && Array.isArray(state.scramble.terms)
            && state.scramble.terms.length > 0
            && Boolean(state.scramble.current);

          if (hasPreservableState) {
            setStatus(
              "scramble-status",
              `Sync complete. ${state.scramble.sets.length} set(s) available. Current scramble progress was preserved.`,
              "success"
            );
            updateScrambleProgress();
          } else if (state.scramble.selectedSetId) {
            loadScrambleFromSelectedSet();
          } else {
            setStatus("scramble-status", `Sync complete. ${state.scramble.sets.length} set(s) available.`, "success");
            pickNewScrambleTerm();
          }
        }
        setScrambleActionGating();
        updateScrambleProgress();
        saveFeaturesSession();
        syncBtn.disabled = false;
      });
    }

    if (checkBtn) checkBtn.addEventListener("click", checkScrambleAnswer);
    if (newBtn) newBtn.addEventListener("click", pickNewScrambleTerm);
    if (hintBtn) hintBtn.addEventListener("click", revealScrambleHintStage);
    if (reviewBtn) reviewBtn.addEventListener("click", toggleScrambleReviewMode);
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          checkScrambleAnswer();
        }
      });
    }

    if (!state.scramble.current && (!state.scramble.terms || !state.scramble.terms.length)) {
      pickNewScrambleTerm();
    }
    setScrambleActionGating();
    updateScrambleProgress();
    renderScrambleReviewList();
    updateStickyActionBar();
  }

  function buildTab(tab) {
    const active = tab.active === true;

    return `
      <button onclick="window.location.href='${tab.href}'" aria-label="${tab.aria}" class="nav-tab ${active ? "active" : ""}" style="
        flex:1;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:4px;
        padding:10px 6px;
        font-size:12px;
        color:${active ? "var(--primary)" : "var(--text)"};
        font-weight:${active ? 600 : 500};
        min-height:64px;
        border-radius:16px;
        margin:0 2px;
        ${active ? "background:rgba(191,219,254,0.45); position:relative;" : ""}
      ">
        <div class="icon-container" style="
          width:36px;
          height:36px;
          border-radius:12px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:${active ? "rgba(191, 219, 254, 0.75)" : "rgba(30, 58, 138, 0.06)"};
        ">
          <img src="icons/${tab.icon}.svg" alt="${tab.label} icon" loading="lazy" width="24" height="24" class="app-icon nav-icon" style="--icon-size:24px;">
        </div>
        <span style="margin-top:2px;">${tab.label}</span>
        ${active ? '<div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:24px; height:3px; background:linear-gradient(90deg, var(--primary), var(--primary)); border-radius:2px;"></div>' : ""}
      </button>
    `;
  }

  function renderBottomNav() {
    const mount = byId("featuresBottomNav");
    if (!mount) return;

    const tabs = [
      { label: "Browse", icon: "browse", href: "index.html?view=browse", aria: "Browse flashcards", active: false },
      { label: "Home", icon: "home", href: "index.html?view=home", aria: "Go to home", active: false },
      { label: "Profile", icon: "profile", href: "index.html?view=profile", aria: "View profile", active: false },
      { label: "More", icon: "features", href: "features.html", aria: "Open more academic features", active: true }
    ];

    mount.innerHTML = `
      <nav class="bottom-nav glass-effect" role="navigation" aria-label="Main navigation" style="
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        border-top: 1px solid rgba(30, 58, 138, 0.12);
        box-shadow: 0 -6px 24px rgba(17, 24, 39, 0.1);
        padding: 10px 16px;
        font-family: var(--font-family);
        max-width: 640px;
        margin: 0 auto;
      ">
        ${tabs.map(buildTab).join("")}
      </nav>
    `;
  }

  function initialize() {
    loadAchievements();
    updateAchievementViews();
    state.sessionSnapshot = loadFeaturesSession();
    if (state.sessionSnapshot?.activePanelId) {
      state.activePanelId = state.sessionSnapshot.activePanelId;
    }

    renderBottomNav();
    bindRecoveryActions();
    setupFeaturePanels();
    bindCrossword();
    bindMatching();
    bindWordScramble();
    updateStickyActionBar();

    window.addEventListener("beforeunload", saveFeaturesSession);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
