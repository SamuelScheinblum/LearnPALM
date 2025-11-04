(async function () {
  const state = window.__LearnPALM__ || {};
  const $lang = document.getElementById("select-language");
  const $langMobile = document.getElementById("select-language-moe");
  const $sec  = document.getElementById("select-section");
  const $type = document.getElementById("select-type");
  const $diff = document.getElementById("select-difficulty");
  const $skill = document.getElementById("select-skill");

  // Navigation button references
  const $btnPrev = document.getElementById("btn-prev");
  const $btnNext = document.getElementById("btn-next");
  const $btnRandom = document.getElementById("btn-random");
  const $questionNav = document.getElementById("question-nav");
  const $questionCounter = document.getElementById("question-counter");

  // Store all available questions and current index
  let availableQuestions = [];
  let currentQuestionIndex = 0;

  // 4 subsections per category - UPDATED to match file naming
  const TYPE_OPTIONS = {
    "RW": [
      { id: "information-ideas",     label: "Information and Ideas" },
      { id: "craft-structure",       label: "Craft and Structure" },
      { id: "expression-ideas",      label: "Expression of Ideas" },
      { id: "standard-english",      label: "Standard English Conventions" }
    ],
    "Math": [
      { id: "algebra",               label: "Algebra" },
      { id: "advanced-math",         label: "Advanced Math" },
      { id: "psda",                  label: "Problem-Solving and Data Analysis" },
      { id: "geometry-trigonometry", label: "Geometry and Trigonometry" }
    ]
  };

  // NEW: Helper functions to get appropriate languages
  function getQuestionLanguage() {
    const isEnglishQuestions = localStorage.getItem('englishQuestions') === 'true';
    const currentLang = state.lang || 'en';
    
    // If English Questions mode is ON, always use English for questions
    return isEnglishQuestions ? 'en' : currentLang;
  }

  function getExplanationLanguage() {
    // Always use the current interface language for explanations
    return state.lang || 'en';
  }

  function ensureBlank(selectEl, label) {
    if (!selectEl) return;
    if (!selectEl.options.length || selectEl.options[0].value !== "") {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = `${label} — select`;
      selectEl.insertBefore(opt, selectEl.firstChild);
    } else {
      selectEl.options[0].textContent = `${label} — select`;
    }
  }

  async function loadTypes() {
    $type.innerHTML = "";
    ensureBlank($type, "Type");

    const sectionVal = ($sec.value || "").trim();
    console.log("📝 Section selected:", sectionVal);
    
    if (!sectionVal) { 
      state.lesson_type = ""; 
      return; 
    }

    const list = TYPE_OPTIONS[sectionVal] || [];
    console.log("📋 Available types:", list);
    
    if (list.length === 0) {
      console.warn("⚠️ No options found for section:", sectionVal);
      console.log("🔑 Available keys:", Object.keys(TYPE_OPTIONS));
    }

    for (const opt of list) {
      const o = document.createElement("option");
      o.value = opt.id;
      o.textContent = opt.label;
      $type.appendChild(o);
    }

    if (state.lesson_type && list.some(o => o.id === state.lesson_type)) {
      $type.value = state.lesson_type;
    } else {
      $type.value = "";
      state.lesson_type = "";
    }
  }

  // Display a specific question by index
  function displayQuestion(index) {
    if (!availableQuestions.length) return;
    
    currentQuestionIndex = index;
    const problem = availableQuestions[currentQuestionIndex];
    
    const prompt   = document.getElementById("practice-prompt");
    const choices  = document.getElementById("practice-choices");
    const submit   = document.getElementById("btn-submit");
    const explWrap = document.getElementById("practice-expl");
    const explText = document.getElementById("expl-text");

    // Reset UI
    choices.innerHTML = "";
    explWrap.classList.add("hidden");
    submit.disabled = true;

    // Get appropriate language for questions
    const questionLang = getQuestionLanguage();
    const explanationLang = getExplanationLanguage();

    console.log('📝 Displaying question in:', questionLang);
    console.log('💡 Explanation will be in:', explanationLang);

    // Update prompt with appropriate language
    if (prompt) {
      prompt.textContent = (problem.prompt && problem.prompt[questionLang]) || "";
    }

    // Update counter
    $questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${availableQuestions.length}`;

    // Update navigation buttons
    $btnPrev.disabled = (currentQuestionIndex === 0);
    $btnNext.disabled = (currentQuestionIndex === availableQuestions.length - 1);

    let selected = null;
    const makeRow = (label, val) => {
      const row = document.createElement("label");
      row.className = "flex items-center gap-2 rounded-xl border p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition";
      const input = document.createElement("input");
      input.type = "radio"; 
      input.name = "q"; 
      input.value = val; 
      input.className = "h-4 w-4";
      input.addEventListener("change", () => { 
        selected = val; 
        submit.disabled = false; 
      });
      const span = document.createElement("span");
      span.textContent = label;
      row.appendChild(input); 
      row.appendChild(span);
      return row;
    };

    // Display choices in appropriate language
    for (const c of problem.choices) {
      if (typeof c === "string") {
        choices.appendChild(makeRow(c, c));
      } else {
        // Use questionLang for choices
        choices.appendChild(makeRow(c[questionLang] || c.en, c.key));
      }
    }

    submit.onclick = async () => {
      // UPDATED: Changed from /api/grade to /.netlify/functions/gradeAnswer
      const r = await (await fetch("/.netlify/functions/gradeAnswer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: problem.id, answer: selected })
      })).json();

      // Use explanationLang for explanation
      explText.textContent = (problem.explanation && problem.explanation[explanationLang]) || "";
      explWrap.classList.remove("hidden");

      choices.querySelectorAll("label").forEach(l => {
        l.classList.remove("ring-2", "ring-red-400", "ring-green-500");
      });
      
      choices.querySelectorAll("label").forEach(l => {
        const input = l.querySelector("input");
        if (!input) return;
        
        if (input.value == problem.answer) {
          l.classList.add("ring-2", "ring-green-500");
        }
        else if (input.value == selected && !r.correct) {
          l.classList.add("ring-2", "ring-red-400");
        }
      });
    };
  }

  // Expose loadProblems globally so settings toggle can call it
  window.loadProblems = async function refreshProblems() {
    const prompt = document.getElementById("practice-prompt");
    const choices = document.getElementById("practice-choices");
    const submit = document.getElementById("btn-submit");
    const explWrap = document.getElementById("practice-expl");

    if (!($sec.value || "").trim() || !($type.value || "").trim()) {
      if (prompt) prompt.textContent = "—";
      if (choices) choices.innerHTML = "";
      if (explWrap) explWrap.classList.add("hidden");
      if (submit) submit.disabled = true;
      $questionNav.classList.add("hidden");
      return;
    }

    // Get appropriate languages based on settings
    const questionLang = getQuestionLanguage();
    const explanationLang = getExplanationLanguage();

    const params = new URLSearchParams({
      section: $sec.value,
      type:    $type.value,
      lang:    state.lang || "en",
      questionLang: questionLang,
      explanationLang: explanationLang
    });

    // Add optional filters
    if ($diff.value) params.append('difficulty', $diff.value);
    if ($skill && $skill.value) params.append('skill', $skill.value);

    console.log('🔄 Fetching questions with params:', Object.fromEntries(params));

    try {
      // UPDATED: Changed from /api/problems to /.netlify/functions/getProblems
      const res = await fetch(`/.netlify/functions/getProblems?${params.toString()}`);
      
      if (!res.ok) {
        console.warn('⚠️ API not available yet:', res.status);
        if (prompt) prompt.textContent = "Practice problems coming soon...";
        if (choices) choices.innerHTML = "";
        if (explWrap) explWrap.classList.add("hidden");
        if (submit) submit.disabled = true;
        $questionNav.classList.add("hidden");
        return;
      }
      
      const data = await res.json();
      availableQuestions = data.problems || [];

      console.log(`✅ Loaded ${availableQuestions.length} questions`);
      console.log(`📝 Questions in: ${data.questionLanguage || questionLang}`);
      console.log(`💡 Explanations in: ${data.explanationLanguage || explanationLang}`);

      if (!availableQuestions.length) { 
        if (prompt) prompt.textContent = "No questions available for this selection.";
        if (choices) choices.innerHTML = "";
        if (explWrap) explWrap.classList.add("hidden");
        if (submit) submit.disabled = true;
        $questionNav.classList.add("hidden");
        return; 
      }

      // Show navigation if more than one question
      if (availableQuestions.length > 1) {
        $questionNav.classList.remove("hidden");
      } else {
        $questionNav.classList.add("hidden");
      }

      // Display first question
      currentQuestionIndex = 0;
      displayQuestion(0);
      
    } catch (error) {
      console.error('❌ Error fetching problems:', error);
      if (prompt) prompt.textContent = "Error loading question. Please try again.";
      if (choices) choices.innerHTML = "";
      if (explWrap) explWrap.classList.add("hidden");
      if (submit) submit.disabled = true;
      $questionNav.classList.add("hidden");
    }
  };

  // Navigation button handlers
  $btnPrev.addEventListener("click", () => {
    if (currentQuestionIndex > 0) {
      displayQuestion(currentQuestionIndex - 1);
    }
  });

  $btnNext.addEventListener("click", () => {
    if (currentQuestionIndex < availableQuestions.length - 1) {
      displayQuestion(currentQuestionIndex + 1);
    }
  });

  $btnRandom.addEventListener("click", () => {
    if (availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      displayQuestion(randomIndex);
    }
  });

  // REMOVED: generateJSON function - this was Flask-specific
  // If you need JSON export later, create a new Netlify Function for it

  // EVENTS
  const onLanguageChange = async () => {
    state.lang = $lang?.value || $langMobile?.value || "en";
    
    if ($lang && $lang.value !== state.lang) $lang.value = state.lang;
    if ($langMobile && $langMobile.value !== state.lang) $langMobile.value = state.lang;
    
    console.log("🌐 Language changed to:", state.lang);
    
    // Reload questions with new language
    if (availableQuestions.length > 0) {
      await window.loadProblems();
    }
  };
  
  if ($lang) $lang.addEventListener("change", onLanguageChange);
  if ($langMobile) $langMobile.addEventListener("change", onLanguageChange);

  const onSectionChange = async () => {
    state.section = $sec.value;
    console.log("📝 Section value:", $sec.value);
    state.lesson_type = "";
    await loadTypes();
    await window.loadProblems();
  };
  $sec.addEventListener("change", onSectionChange);

  const onTypeChange = async () => {
    state.lesson_type = $type.value;
    console.log("📋 Type value:", $type.value);
    await window.loadProblems();
  };
  $type.addEventListener("change", onTypeChange);

  const onDifficultyChange = async () => {
    state.difficulty = $diff.value;
    console.log("🎯 Difficulty value:", $diff.value);
    await window.loadProblems();
  };
  $diff.addEventListener("change", onDifficultyChange);

  const onSkillChange = async () => {
    state.skill = $skill.value;
    console.log("🎓 Skill value:", $skill.value);
    await window.loadProblems();
  };
  if ($skill) $skill.addEventListener("change", onSkillChange);

  // INIT
  state.lang = $lang?.value || $langMobile?.value || "en";
  
  (function ensureBlankInit() {
    if ($sec && (!$sec.options.length || $sec.options[0].value !== "")) {
      const opt = document.createElement("option");
      opt.value = ""; 
      opt.textContent = "Section — select";
      $sec.insertBefore(opt, $sec.firstChild);
    }
    if ($type && (!$type.options.length || $type.options[0].value !== "")) {
      const opt = document.createElement("option");
      opt.value = ""; 
      opt.textContent = "Type — select";
      $type.insertBefore(opt, $type.firstChild);
    }
  })();

  await loadTypes();
  await window.loadProblems();
})();