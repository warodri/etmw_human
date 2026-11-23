const learnForm = document.querySelector("#learn-form");
const sentenceInput = document.querySelector("#sentence");
const characterCount = document.querySelector("#character-count");
const learnButton = document.querySelector("#learn-button");
const clearButton = document.querySelector("#clear-button");
const learnError = document.querySelector("#learn-error");
const learnResult = document.querySelector("#learn-result");
const learningInput = document.querySelector("#learning-input");
const learningTokens = document.querySelector("#learning-tokens");
const learningNotes = document.querySelector("#learning-notes");
const ruleCount = document.querySelector("#rule-count");
const refreshRulesButton = document.querySelector("#refresh-rules");
const surpriseButton = document.querySelector("#surprise-button");
const generateEmpty = document.querySelector("#generate-empty");
const generateWorkspace = document.querySelector("#generate-workspace");
const ruleSelect = document.querySelector("#rule-select");
const ruleMeta = document.querySelector("#rule-meta");
const generationPattern = document.querySelector("#generation-pattern");
const ruleExamples = document.querySelector("#rule-examples");
const generationFields = document.querySelector("#generation-fields");
const generationSeed = document.querySelector("#generation-seed");
const generateButton = document.querySelector("#generate-button");
const generateRandomButton = document.querySelector("#generate-random-button");
const generationError = document.querySelector("#generation-error");
const generationOutput = document.querySelector("#generation-output");
const generationSentence = document.querySelector("#generation-sentence");
const generationChoices = document.querySelector("#generation-choices");
const refreshStateButton = document.querySelector("#refresh-state");
const resetLearningButton = document.querySelector("#reset-learning");
const stateRuleCount = document.querySelector("#state-rule-count");
const stateKnowledgeCount = document.querySelector("#state-knowledge-count");
const stateRelationshipCount = document.querySelector("#state-relationship-count");
const stateRulesMeta = document.querySelector("#state-rules-meta");
const stateKnowledgeMeta = document.querySelector("#state-knowledge-meta");
const stateRules = document.querySelector("#state-rules");
const stateKnowledge = document.querySelector("#state-knowledge");
const stateNotice = document.querySelector("#state-notice");
const stateError = document.querySelector("#state-error");
const simpleGenerateButton = document.querySelector("#simple-generate-button");
const simpleGenerateError = document.querySelector("#simple-generate-error");
const simpleGenerateOutput = document.querySelector("#simple-generate-output");
const simpleGenerateSentence = document.querySelector("#simple-generate-sentence");
const simpleGenerateChoices = document.querySelector("#simple-generate-choices");
const simpleGeneratePattern = document.querySelector("#simple-generate-pattern");
const simpleGenerateRule = document.querySelector("#simple-generate-rule");
const statusPill = document.querySelector("#api-status");
const statusText = document.querySelector("#api-status-text");
const sampleButtons = document.querySelectorAll(".sample");

let rules = [];
let arrays = null;
let arraysPromise = null;
let selectedRule = null;
let learningBusy = false;
let generationBusy = false;
let simpleGenerateBusy = false;
let renderVersion = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function toneForArray(name) {
  const value = name.toLowerCase();

  if (value === "system") {
    return "system";
  }
  if (value === "name") {
    return "name";
  }
  if (value.includes("pronoun")) {
    return "pronoun";
  }
  if (value.includes("verb") || value.includes("modal")) {
    return "verb";
  }
  if (value.includes("noun")) {
    return "noun";
  }
  if (
    value.includes("number") ||
    value.includes("ordinal") ||
    value.includes("cardinal")
  ) {
    return "number";
  }
  if (value.includes("adjective") || value.includes("adverb")) {
    return "modifier";
  }
  if (
    value.includes("article") ||
    value.includes("determiner") ||
    value.includes("quantifier") ||
    value.includes("predeterminer") ||
    value.includes("distributive")
  ) {
    return "determiner";
  }
  if (value.includes("preposition") || value.includes("conjunction")) {
    return "connector";
  }

  return "misc";
}

function updateCharacterCount() {
  characterCount.textContent = `${sentenceInput.value.length} / 2000`;
}

function updateRuleCount(label) {
  ruleCount.textContent =
    label ??
    `${rules.length} ${rules.length === 1 ? "rule" : "rules"} stored`;
}

function showLearnError(message) {
  learnError.textContent = message;
  learnError.hidden = false;
}

function hideLearnError() {
  learnError.textContent = "";
  learnError.hidden = true;
}

function setLearningBusy(nextBusy) {
  learningBusy = nextBusy;
  learnButton.disabled = nextBusy;
  learnButton.textContent = nextBusy ? "Learning…" : "Learn sentence";
  learnForm.setAttribute("aria-busy", String(nextBusy));
}

function renderErrorPayload(payload, status) {
  const detail = payload?.error?.details?.[0]?.message;
  return detail || payload?.error?.message || `Request failed with status ${status}`;
}

function renderPattern(container, pattern) {
  container.replaceChildren();

  pattern.forEach((category, index) => {
    container.append(
      element(
        "span",
        `array-chip tone-${toneForArray(category)}`,
        category
      )
    );

    if (index < pattern.length - 1) {
      container.append(element("span", "pattern-arrow", "→"));
    }
  });
}

function appendLearningNotice(type, message) {
  learningNotes.append(element("p", `notice notice-${type}`, message));
}

function renderLearningResult(data) {
  learningInput.textContent = data.input;
  learningTokens.replaceChildren();
  learningNotes.replaceChildren();

  data.tokens.forEach((token) => {
    const unknown = token.possibleCategories.length === 0;
    const card = element(
      "article",
      `learning-token${unknown ? " is-unknown" : ""}`
    );
    card.append(element("span", "learning-word", token.text));

    const chips = element("div", "array-chips");

    if (unknown) {
      chips.append(element("span", "array-chip tone-misc", "unknown"));
    } else {
      token.possibleCategories.forEach((category) => {
        chips.append(
          element(
            "span",
            `array-chip tone-${toneForArray(category)}`,
            category
          )
        );
      });
    }

    card.append(chips);
    learningTokens.append(card);
  });

  if (data.unknownTokens.length > 0) {
    appendLearningNotice(
      "warning",
      `Unknown words: ${data.unknownTokens.join(", ")}. No array membership was invented, so no rule was learned for this input.`
    );
  }

  if (data.truncated) {
    appendLearningNotice(
      "warning",
      "The pattern safety cap was reached; only the first observed sequences were stored."
    );
  }

  if (data.learned.length > 0) {
    appendLearningNotice(
      "success",
      `New rules stored: ${data.learned.map((rule) => rule.id).join(", ")}.`
    );
  }

  if (data.existingRuleIds.length > 0) {
    appendLearningNotice(
      "info",
      `Updated existing rules: ${data.existingRuleIds.join(", ")}.`
    );
  }

  if (
    data.learned.length === 0 &&
    data.existingRuleIds.length === 0 &&
    data.unknownTokens.length === 0
  ) {
    appendLearningNotice("info", "No sequence was stored for this observation.");
  }

  learnResult.hidden = false;
  learnResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function submitLearn(event) {
  event.preventDefault();

  if (learningBusy) {
    return;
  }

  const sentence = sentenceInput.value;

  if (sentence.trim().length === 0) {
    hideLearnError();
    showLearnError("Enter an English sentence before learning a sequence.");
    sentenceInput.focus();
    return;
  }

  hideLearnError();
  setLearningBusy(true);

  try {
    const response = await fetch("/api/v1/learning/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence })
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(renderErrorPayload(payload, response.status));
    }

    if (!payload?.data) {
      throw new Error("The server returned an unexpected learning response.");
    }

    renderLearningResult(payload.data);

    const preferredRuleId =
      payload.data.learned[0]?.id ?? payload.data.existingRuleIds[0];
    await loadRules(preferredRuleId);
    await loadLearningState();
  } catch (error) {
    showLearnError(
      error instanceof Error
        ? error.message
        : "The sentence could not be learned."
    );
  } finally {
    setLearningBusy(false);
  }
}

function renderRuleExamples(rule) {
  ruleExamples.replaceChildren();

  rule.examples.slice(0, 2).forEach((example) => {
    ruleExamples.append(element("span", "rule-example", `“${example}”`));
  });

  if (rule.examples.length > 2) {
    ruleExamples.append(
      element("span", "rule-example rule-more", `+${rule.examples.length - 2} more`)
    );
  }
}

async function loadArrays() {
  if (arrays) {
    return arrays;
  }

  if (!arraysPromise) {
    arraysPromise = fetch("/api/v1/learning/vocabulary")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Vocabulary request failed with status ${response.status}`
          );
        }

        const payload = await response.json();

        if (!payload?.data?.arrays) {
          throw new Error(
            "The server returned an unexpected vocabulary response."
          );
        }

        arrays = payload.data.arrays;
        return arrays;
      })
      .catch((error) => {
        arraysPromise = null;
        throw error;
      });
  }

  return arraysPromise;
}

function hideGenerationError() {
  generationError.textContent = "";
  generationError.hidden = true;
}

function showGenerationError(message) {
  generationOutput.hidden = true;
  generationError.textContent = message;
  generationError.hidden = false;
}

function setGenerationBusy(nextBusy) {
  generationBusy = nextBusy;
  generateButton.disabled = nextBusy;
  generateRandomButton.disabled = nextBusy;
  generateButton.textContent = nextBusy
    ? "Generating…"
    : "Generate sentence";
}

function renderGenerationFields(rule, arraysByName) {
  generationFields.replaceChildren();

  rule.pattern.forEach((category, index) => {
    const words = arraysByName.get(category)?.words ?? [];
    const field = element("label", "generation-field");
    field.append(element("span", "generation-field-name", category));
    field.append(
      element(
        "span",
        "field-position",
        `${String(index + 1).padStart(2, "0")} · ${words.length} ${
          words.length === 1 ? "word" : "words"
        }`
      )
    );

    const select = element("select");
    select.dataset.position = String(index);
    select.setAttribute(
      "aria-label",
      `Word for position ${index + 1}, ${category}`
    );

    const randomOption = element("option", null, "Random");
    randomOption.value = "";
    select.append(randomOption);

    if (words.length === 0) {
      const emptyOption = element("option", null, "No words available");
      emptyOption.value = "";
      select.append(emptyOption);
      select.disabled = true;
    } else {
      words.forEach((word) => {
        const option = element("option", null, word);
        option.value = word;
        select.append(option);
      });
    }

    field.append(select);
    generationFields.append(field);
  });
}

function renderGenerationResult(data) {
  generationSentence.textContent = data.sentence;
  generationChoices.replaceChildren();

  data.chosenWords.forEach((word, index) => {
    const chip = element("span", "word-chip", word);
    chip.title = data.pattern[index] || "";
    generationChoices.append(chip);
  });

  generationOutput.hidden = false;
  generationOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function selectRule(ruleId, autoGenerate = false) {
  const rule = rules.find((entry) => entry.id === ruleId);

  if (!rule) {
    return;
  }

  selectedRule = rule;
  ruleSelect.value = rule.id;
  renderVersion += 1;
  const version = renderVersion;

  hideGenerationError();
  generationOutput.hidden = true;
  generationSentence.textContent = "";
  generationChoices.replaceChildren();
  renderPattern(generationPattern, rule.pattern);
  renderRuleExamples(rule);
  ruleMeta.textContent = `${rule.count} ${
    rule.count === 1 ? "observation" : "observations"
  }`;

  generationFields.replaceChildren(
    element("p", "notice", "Loading vocabulary choices…")
  );

  try {
    const vocabulary = await loadArrays();

    if (version !== renderVersion || selectedRule !== rule) {
      return;
    }

    const arraysByName = new Map(
      vocabulary.map((entry) => [entry.name, entry])
    );
    renderGenerationFields(rule, arraysByName);

    if (autoGenerate) {
      await generateSentence(true);
    }
  } catch (error) {
    if (version === renderVersion) {
      generationFields.replaceChildren();
      showGenerationError(
        error instanceof Error
          ? error.message
          : "Vocabulary choices could not be loaded."
      );
    }
  }
}

async function generateSentence(forceRandom) {
  if (!selectedRule || generationBusy) {
    return;
  }

  const selects = Array.from(
    generationFields.querySelectorAll("select")
  );

  if (selects.length === 0) {
    showGenerationError("Wait for the vocabulary choices to load.");
    return;
  }

  if (forceRandom) {
    selects.forEach((select) => {
      select.value = "";
    });
  }

  const values = selects.map((select) => select.value);
  const anySelected = values.some((value) => value.length > 0);
  const allSelected = values.every((value) => value.length > 0);

  if (anySelected && !allSelected) {
    showGenerationError(
      "Choose a word for every position or leave every position on Random."
    );
    return;
  }

  let seed;

  if (generationSeed.value.trim().length > 0) {
    seed = Number(generationSeed.value);

    if (!Number.isInteger(seed)) {
      showGenerationError("The seed must be an integer.");
      return;
    }
  }

  hideGenerationError();
  setGenerationBusy(true);

  try {
    const body = { ruleId: selectedRule.id };

    if (seed !== undefined) {
      body.seed = seed;
    }

    if (anySelected && allSelected) {
      body.words = values;
    }

    const response = await fetch("/api/v1/learning/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(renderErrorPayload(payload, response.status));
    }

    if (!payload?.data) {
      throw new Error("The server returned an unexpected generation response.");
    }

    renderGenerationResult(payload.data);
  } catch (error) {
    showGenerationError(
      error instanceof Error
        ? error.message
        : "The sentence could not be generated."
    );
  } finally {
    setGenerationBusy(false);
  }
}

async function loadRules(preferredRuleId) {
  updateRuleCount("Loading rules");

  try {
    const response = await fetch("/api/v1/learning/rules");

    if (!response.ok) {
      throw new Error(`Rules request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload?.data?.rules) {
      throw new Error("The server returned an unexpected rules response.");
    }

    rules = payload.data.rules;
    updateRuleCount();
    generateEmpty.hidden = rules.length > 0;
    generateWorkspace.hidden = rules.length === 0;
    surpriseButton.disabled = rules.length === 0;

    if (rules.length === 0) {
      selectedRule = null;
      ruleSelect.replaceChildren();
      return;
    }

    ruleSelect.replaceChildren();

    rules.forEach((rule) => {
      const option = element(
        "option",
        null,
        `${rule.id} · ${rule.pattern.join(" → ")}`
      );
      option.value = rule.id;
      ruleSelect.append(option);
    });

    const knownSelectedId = selectedRule
      ? rules.find((rule) => rule.id === selectedRule.id)?.id
      : undefined;
    const selectedId =
      (preferredRuleId &&
        rules.find((rule) => rule.id === preferredRuleId)?.id) ||
      knownSelectedId ||
      rules[0].id;

    await selectRule(selectedId);
  } catch (error) {
    rules = [];
    selectedRule = null;
    updateRuleCount("Rules unavailable");
    generateEmpty.hidden = false;
    generateWorkspace.hidden = true;
    surpriseButton.disabled = true;
    showLearnError(
      error instanceof Error
        ? error.message
        : "Learned rules could not be loaded."
    );
  }
}

async function surprise() {
  if (rules.length === 0) {
    showGenerationError("Add a sentence to learn at least one rule first.");
    return;
  }

  const rule = rules[Math.floor(Math.random() * rules.length)];
  await selectRule(rule.id, true);
}

function hideStateError() {
  stateError.textContent = "";
  stateError.hidden = true;
}

function showStateError(message) {
  stateError.textContent = message;
  stateError.hidden = false;
}

function hideStateNotice() {
  stateNotice.textContent = "";
  stateNotice.hidden = true;
}

function showStateNotice(message) {
  stateNotice.textContent = message;
  stateNotice.hidden = false;
}

function renderStateRules(rulesToRender) {
  stateRules.replaceChildren();
  stateRulesMeta.textContent = `${rulesToRender.length} ${
    rulesToRender.length === 1 ? "rule" : "rules"
  }`;

  if (rulesToRender.length === 0) {
    stateRules.append(
      element(
        "div",
        "state-empty",
        "No sentence rules yet. Add a sentence to begin."
      )
    );
    return;
  }

  for (const rule of rulesToRender) {
    const item = element("div", "state-rule");
    const head = element("div", "state-rule-head");
    head.append(
      element("span", "state-rule-id", rule.id),
      element(
        "span",
        "state-rule-meta",
        `${rule.count} ${rule.count === 1 ? "observation" : "observations"}`
      )
    );
    item.append(head);

    const pattern = element("div", "state-rule-pattern");
    renderPattern(pattern, rule.pattern);
    item.append(pattern);

    if (rule.examples.length > 0) {
      const example = element(
        "p",
        "state-rule-example",
        `“${rule.examples[0]}”`
      );
      example.title = rule.examples.join("\n");
      item.append(example);
    }

    stateRules.append(item);
  }
}

function renderStateKnowledge(entries) {
  stateKnowledge.replaceChildren();
  stateKnowledgeMeta.textContent = `${entries.length} ${
    entries.length === 1 ? "entry" : "entries"
  }`;

  if (entries.length === 0) {
    stateKnowledge.append(
      element(
        "div",
        "state-empty",
        "No word knowledge yet. Teach a connection or learn a matching sentence."
      )
    );
    return;
  }

  for (const entry of entries) {
    const item = element("div", "state-knowledge");
    const head = element("div", "state-knowledge-head");
    head.append(element("span", "state-word", entry.word));
    head.append(
      element(
        "span",
        `array-chip tone-${toneForArray(entry.category)}`,
        entry.category
      )
    );
    item.append(head);

    const relatedList = element("div", "state-related-list");

    if (entry.related.length === 0) {
      relatedList.append(
        element("span", "state-rule-example", "No direct connections.")
      );
    } else {
      for (const related of entry.related) {
        const row = element("div", "state-related-item");
        row.append(element("span", "state-related-arrow", "→"));

        const word = element(
          "span",
          `state-related-word${
            related.category === "system"
              ? " is-system"
              : related.category === "name"
                ? " is-name"
                : ""
          }`,
          related.word
        );
        word.title = `${related.occurrences} observation(s); sources: ${related.sources.join(
          ", "
        )}`;
        row.append(word);
        row.append(
          element(
            "span",
            `array-chip tone-${toneForArray(related.category)}`,
            related.category
          )
        );

        if (related.occurrences > 1) {
          row.append(
            element("span", "state-count", `×${related.occurrences}`)
          );
        }

        relatedList.append(row);
      }
    }

    item.append(relatedList);
    stateKnowledge.append(item);
  }
}

async function loadLearningState() {
  hideStateError();
  hideStateNotice();
  stateRuleCount.textContent = "…";
  stateKnowledgeCount.textContent = "…";
  stateRelationshipCount.textContent = "…";

  try {
    const [rulesResponse, knowledgeResponse] = await Promise.all([
      fetch("/api/v1/learning/rules"),
      fetch("/api/v1/knowledge")
    ]);

    if (!rulesResponse.ok) {
      throw new Error(`Rules request failed with status ${rulesResponse.status}`);
    }

    if (!knowledgeResponse.ok) {
      throw new Error(
        `Knowledge request failed with status ${knowledgeResponse.status}`
      );
    }

    const rulesPayload = await rulesResponse.json();
    const knowledgePayload = await knowledgeResponse.json();
    const rulesData = rulesPayload?.data?.rules;
    const entries = knowledgePayload?.data?.entries;

    if (!Array.isArray(rulesData) || !Array.isArray(entries)) {
      throw new Error("The server returned an unexpected learning state.");
    }

    stateRuleCount.textContent = String(rulesData.length);
    stateKnowledgeCount.textContent = String(entries.length);
    stateRelationshipCount.textContent = String(
      entries.reduce(
        (total, entry) =>
          total + (Array.isArray(entry.related) ? entry.related.length : 0),
        0
      )
    );
    renderStateRules(rulesData);
    renderStateKnowledge(entries);
  } catch (error) {
    showStateError(
      error instanceof Error
        ? error.message
        : "The learning state could not be loaded."
    );
  }
}

async function resetLearningState() {
  const confirmed = window.confirm(
    "Reset all learned sentence rules and word knowledge? This cannot be undone."
  );

  if (!confirmed) {
    return;
  }

  hideStateError();
  hideStateNotice();
  resetLearningButton.disabled = true;

  try {
    const response = await fetch("/api/v1/learning/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "RESET" })
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(renderErrorPayload(payload, response.status));
    }

    selectedRule = null;
    generateWorkspace.hidden = true;
    generationFields.replaceChildren();
    generationOutput.hidden = true;
    generationSentence.textContent = "";
    generationChoices.replaceChildren();
    learnResult.hidden = true;
    learningInput.textContent = "";
    learningTokens.replaceChildren();
    learningNotes.replaceChildren();
    hideLearnError();

    await Promise.all([loadRules(), loadLearningState()]);
    showStateNotice(
      "All learning cleared. Add a sentence to start again from zero."
    );
  } catch (error) {
    showStateError(
      error instanceof Error
        ? error.message
        : "The learning state could not be reset."
    );
  } finally {
    resetLearningButton.disabled = false;
  }
}

function hideSimpleGenerateError() {
  simpleGenerateError.textContent = "";
  simpleGenerateError.hidden = true;
}

function showSimpleGenerateError(message) {
  simpleGenerateError.textContent = message;
  simpleGenerateError.hidden = false;
}

function setSimpleGenerateBusy(nextBusy) {
  simpleGenerateBusy = nextBusy;
  simpleGenerateButton.disabled = nextBusy;
  simpleGenerateButton.textContent = nextBusy
    ? "Generating…"
    : "Generate a sentence";
}

async function generateSimpleSentence() {
  if (simpleGenerateBusy) {
    return;
  }

  hideSimpleGenerateError();
  simpleGenerateOutput.hidden = true;
  setSimpleGenerateBusy(true);

  try {
    const response = await fetch("/api/v1/learning/generate/random", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(renderErrorPayload(payload, response.status));
    }

    if (!payload?.data) {
      throw new Error("The server returned an unexpected generation response.");
    }

    const data = payload.data;
    simpleGenerateSentence.textContent = data.sentence;
    simpleGenerateChoices.replaceChildren();

    data.chosenWords.forEach((word) => {
      simpleGenerateChoices.append(element("span", "word-chip", word));
    });

    renderPattern(simpleGeneratePattern, data.pattern);
    simpleGenerateRule.textContent = data.ruleId;
    simpleGenerateOutput.hidden = false;
  } catch (error) {
    simpleGenerateOutput.hidden = true;
    showSimpleGenerateError(
      error instanceof Error
        ? error.message
        : "The sentence could not be generated."
    );
  } finally {
    setSimpleGenerateBusy(false);
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("offline");
    }

    statusPill.classList.remove("is-offline");
    statusPill.classList.add("is-online");
    statusText.textContent = "API online";
  } catch {
    statusPill.classList.remove("is-online");
    statusPill.classList.add("is-offline");
    statusText.textContent = "API offline";
  }
}

learnForm.addEventListener("submit", (event) => {
  void submitLearn(event);
});

learnForm.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    learnForm.requestSubmit();
  }
});

sentenceInput.addEventListener("input", updateCharacterCount);

clearButton.addEventListener("click", () => {
  sentenceInput.value = "";
  updateCharacterCount();
  hideLearnError();
  learnResult.hidden = true;
  learningInput.textContent = "";
  learningTokens.replaceChildren();
  learningNotes.replaceChildren();
  sentenceInput.focus();
});

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sentenceInput.value = button.dataset.sentence || "";
    updateCharacterCount();
    sentenceInput.focus();
  });
});

ruleSelect.addEventListener("change", () => {
  void selectRule(ruleSelect.value);
});

refreshRulesButton.addEventListener("click", () => {
  void loadRules(selectedRule?.id);
});

surpriseButton.addEventListener("click", () => {
  void surprise();
});

generateButton.addEventListener("click", () => {
  void generateSentence(false);
});

generateRandomButton.addEventListener("click", () => {
  void generateSentence(true);
});

simpleGenerateButton.addEventListener("click", () => {
  void generateSimpleSentence();
});

refreshStateButton.addEventListener("click", () => {
  void loadLearningState();
});

resetLearningButton.addEventListener("click", () => {
  void resetLearningState();
});

updateCharacterCount();
void checkHealth();
void loadRules();
void loadLearningState();
