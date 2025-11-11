// public/static/js/main.js
(async function () {
  const state = window.__LearnPALM__ || {};
  const $lang = document.getElementById("select-language");
  const $langMobile = document.getElementById("select-language-moe");
  const $sec  = document.getElementById("select-section");
  const $type = document.getElementById("select-type");
  const $diff = document.getElementById("select-difficulty");
  const $skill = document.getElementById("select-skill");

  const $btnPrev = document.getElementById("btn-prev");
  const $btnNext = document.getElementById("btn-next");
  const $btnRandom = document.getElementById("btn-random");
  const $questionNav = document.getElementById("question-nav");
  const $questionCounter = document.getElementById("question-counter");

  let availableQuestions = [];
  let currentQuestionIndex = 0;

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

  function getQuestionLanguage() {
    const isEnglishQuestions = localStorage.getItem('englishQuestions') === 'true';
    const currentLang = state.lang || 'en';
    return isEnglishQuestions ? 'en' : currentLang;
  }

  function getExplanationLanguage() {
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
    if (!sectionVal) { 
      state.lesson_type = ""; 
      return; 
    }

    const list = TYPE_OPTIONS[sectionVal] || [];
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

  function displayQuestion(index) {
    if (!availableQuestions.length) return;
    
    currentQuestionIndex = index;
    const problem = availableQuestions[currentQuestionIndex];
    
    const prompt   = document.getElementById("practice-prompt");
    const choices  = document.getElementById("practice-choices");
    const submit   = document.getElementById("btn-submit");
    const explWrap = document.getElementById("practice-expl");
    const explText = document.getElementById("expl-text");

    choices.innerHTML = "";
    explWrap.classList.add("hidden");
    submit.disabled = true;

    const questionLang = getQuestionLanguage();
    const explanationLang = getExplanationLanguage();

    if (prompt) {
      prompt.textContent = (problem.prompt && problem.prompt[questionLang]) || "";
    }

    // Update the input box and counter text separately
    const questionInput = document.getElementById("question-number-input");
    if (questionInput) {
      questionInput.value = currentQuestionIndex + 1;
    }
    $questionCounter.textContent = `of ${availableQuestions.length}`;
    
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

    for (const c of problem.choices) {
      if (typeof c === "string") {
        choices.appendChild(makeRow(c, c));
      } else {
        choices.appendChild(makeRow(c[questionLang] || c.en, c.key));
      }
    }

    submit.onclick = async () => {
      try {
        const resp = await fetch("/.netlify/functions/gradeAnswer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: problem.id, answer: selected })
        });
        const r = await resp.json();

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
          } else if (input.value == selected && !r.correct) {
            l.classList.add("ring-2", "ring-red-400");
          }
        });
      } catch(err) {
        console.error('Error grading:', err);
      }
    };
  }

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

    const questionLang = getQuestionLanguage();
    const explanationLang = getExplanationLanguage();

    const params = new URLSearchParams({
      section: $sec.value,
      type:    $type.value,
      lang:    state.lang || "en",
      questionLang: questionLang,
      explanationLang: explanationLang
    });

    if ($diff.value) params.append('difficulty', $diff.value);
    if ($skill && $skill.value) params.append('skill', $skill.value);

    try {
      const res = await fetch(`/.netlify/functions/getProblems?${params.toString()}`);
      
      if (!res.ok) {
        if (prompt) prompt.textContent = "Error loading questions.";
        if (choices) choices.innerHTML = "";
        if (explWrap) explWrap.classList.add("hidden");
        if (submit) submit.disabled = true;
        $questionNav.classList.add("hidden");
        return;
      }
      
      const data = await res.json();
      availableQuestions = data.problems || [];

      if (!availableQuestions.length) { 
        if (prompt) prompt.textContent = "No questions available for this selection.";
        if (choices) choices.innerHTML = "";
        if (explWrap) explWrap.classList.add("hidden");
        if (submit) submit.disabled = true;
        $questionNav.classList.add("hidden");
        return; 
      }

      if (availableQuestions.length > 1) {
        $questionNav.classList.remove("hidden");
      } else {
        $questionNav.classList.add("hidden");
      }

      currentQuestionIndex = 0;
      displayQuestion(0);
      
    } catch (error) {
      console.error('Error fetching problems:', error);
      if (prompt) prompt.textContent = "Error loading question. Please try again.";
      if (choices) choices.innerHTML = "";
      if (explWrap) explWrap.classList.add("hidden");
      if (submit) submit.disabled = true;
      $questionNav.classList.add("hidden");
    }
  };

  $btnPrev.addEventListener("click", () => {
    if (currentQuestionIndex > 0) displayQuestion(currentQuestionIndex - 1);
  });

  $btnNext.addEventListener("click", () => {
    if (currentQuestionIndex < availableQuestions.length - 1) displayQuestion(currentQuestionIndex + 1);
  });

  $btnRandom.addEventListener("click", () => {
    if (availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      displayQuestion(randomIndex);
    }
  });

  const onLanguageChange = async () => {
    state.lang = $lang?.value || $langMobile?.value || "en";
    if ($lang && $lang.value !== state.lang) $lang.value = state.lang;
    if ($langMobile && $langMobile.value !== state.lang) $langMobile.value = state.lang;
    if (availableQuestions.length > 0) await window.loadProblems();
  };
  
  if ($lang) $lang.addEventListener("change", onLanguageChange);
  if ($langMobile) $langMobile.addEventListener("change", onLanguageChange);

  const onSectionChange = async () => {
    state.section = $sec.value;
    state.lesson_type = "";
    await loadTypes();
    await window.loadProblems();
  };
  $sec.addEventListener("change", onSectionChange);

  const onTypeChange = async () => {
    state.lesson_type = $type.value;
    await window.loadProblems();
  };
  $type.addEventListener("change", onTypeChange);

  const onDifficultyChange = async () => {
    state.difficulty = $diff.value;
    await window.loadProblems();
  };
  $diff.addEventListener("change", onDifficultyChange);

  const onSkillChange = async () => {
    state.skill = $skill.value;
    await window.loadProblems();
  };
  if ($skill) $skill.addEventListener("change", onSkillChange);

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

  // Expose functions globally for the question input handler
  window.displayQuestion = displayQuestion;
  window.getAvailableQuestionsCount = () => availableQuestions.length;
  window.getCurrentQuestionIndex = () => currentQuestionIndex;
})();