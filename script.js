let cards = [];
let currentIndex = 0;
let flipped = false;
let view = "study";
let editingId = null;
let loaded = false;

const STORAGE_KEY = "cards";
const PROGRESS_KEY = "progress";

function uid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  return (str || "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m],
  );
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

async function loadCards() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    cards = res ? JSON.parse(res.value) : seedCards();
    if (!res) {
      await saveCards();
    }
  } catch (e) {
    cards = seedCards();
  }

  try {
    const prog = await window.storage.get(PROGRESS_KEY, false);
    if (prog) {
      const p = JSON.parse(prog.value);
      if (typeof p.currentIndex === "number") currentIndex = p.currentIndex;
      if (typeof p.view === "string") view = p.view;
    }
  } catch (e) {
    /* no saved progress yet, defaults are fine */
  }

  if (currentIndex >= cards.length) currentIndex = 0;
  loaded = true;
}

async function saveProgress() {
  try {
    await window.storage.set(
      PROGRESS_KEY,
      JSON.stringify({ currentIndex, view }),
      false,
    );
  } catch (e) {
    /* progress is a nice-to-have; fail silently */
  }
}

function seedCards() {
  return [];
}

async function saveCards() {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(cards), false);
  } catch (e) {
    showToast("Couldn't save. Try again.");
  }
}

function setView(v) {
  view = v;
  editingId = null;
  document.getElementById("tabStudy").classList.toggle("active", v === "study");
  document
    .getElementById("tabManage")
    .classList.toggle("active", v === "manage");
  render();
  saveProgress();
}

function render() {
  const main = document.getElementById("main");
  const chip = document.getElementById("countChip");
  chip.textContent = cards.length
    ? `${cards.length} card${cards.length === 1 ? "" : "s"}`
    : "";

  if (!loaded) {
    main.innerHTML = `<div class="empty-state"><p>Loading your cards…</p></div>`;
    return;
  }

  if (view === "study") {
    renderStudy(main);
  } else {
    renderManage(main);
  }
}

function renderStudy(main) {
  if (cards.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="stack">🗂️</div>
        <h2>No cards yet</h2>
        <p>Add your first word and its meaning to start studying.</p>
        <button class="cta-btn" onclick="setView('manage')">Add a word</button>
      </div>`;
    return;
  }

  if (currentIndex >= cards.length) currentIndex = 0;
  const card = cards[currentIndex];

  main.innerHTML = `
    <div class="stage">
      <div class="scene">
        <div class="card ${flipped ? "flipped" : ""}" id="cardEl" onclick="flipCard()">
          <div class="face front">
            <span class="tag">No. ${String(currentIndex + 1).padStart(3, "0")}</span>
            <div class="word">${escapeHtml(card.front)}</div>
            <span class="side-label">Word</span>
          </div>
          <div class="face back">
            <span class="tag">No. ${String(currentIndex + 1).padStart(3, "0")}</span>
            <div class="definition">${escapeHtml(card.back)}</div>
            <span class="side-label">Meaning</span>
          </div>
        </div>
      </div>
      <p class="hint">Tap the card to flip</p>
      <div class="controls">
        <button class="icon-btn" aria-label="Previous card" onclick="prevCard()">‹</button>
        <button class="icon-btn primary" onclick="flipCard()">Flip</button>
        <button class="icon-btn" aria-label="Next card" onclick="nextCard()">›</button>
      </div>
    </div>
  `;
}

function flipCard() {
  flipped = !flipped;
  const el = document.getElementById("cardEl");
  if (el) el.classList.toggle("flipped", flipped);
}

function prevCard() {
  flipped = false;
  currentIndex = (currentIndex - 1 + cards.length) % cards.length;
  render();
  saveProgress();
}

function nextCard() {
  flipped = false;
  currentIndex = (currentIndex + 1) % cards.length;
  render();
  saveProgress();
}

function renderManage(main) {
  main.innerHTML = `
    <div class="manage-form">
      <h2>Add a word</h2>
      <div class="field-row">
        <label for="newFront">Word</label>
        <input type="text" id="newFront" placeholder="e.g. Ephemeral" />
      </div>
      <div class="field-row">
        <label for="newBack">Meaning</label>
        <textarea id="newBack" placeholder="e.g. Lasting for a very short time."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn solid" onclick="addCard()">Add card</button>
      </div>
    </div>
    <p class="section-label">Your words</p>
    <div class="word-list" id="wordList"></div>
  `;
  renderWordList();
}

function renderWordList() {
  const list = document.getElementById("wordList");
  if (!list) return;
  if (cards.length === 0) {
    list.innerHTML = `<div class="list-empty">You haven't added any words yet.</div>`;
    return;
  }
  list.innerHTML = cards
    .map(
      (c, i) => `
    <div class="word-row ${editingId === c.id ? "editing" : ""}" data-id="${c.id}">
      <div class="row-view">
        <div class="text-block">
          <p class="front-text">${escapeHtml(c.front)}</p>
          <p class="back-text">${escapeHtml(c.back)}</p>
        </div>
        <div class="row-actions">
          <button aria-label="Edit" onclick="startEdit('${c.id}')">✎</button>
          <button aria-label="Delete" class="delete" onclick="deleteCard('${c.id}')">🗑</button>
        </div>
      </div>
      <div class="row-edit">
        <div class="field-row">
          <label>Word</label>
          <input type="text" value="${escapeHtml(c.front)}" id="edit-front-${c.id}" />
        </div>
        <div class="field-row">
          <label>Meaning</label>
          <textarea id="edit-back-${c.id}">${escapeHtml(c.back)}</textarea>
        </div>
        <div class="form-actions">
          <button class="btn" onclick="cancelEdit()">Cancel</button>
          <button class="btn solid" onclick="saveEdit('${c.id}')">Save</button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

async function addCard() {
  const frontEl = document.getElementById("newFront");
  const backEl = document.getElementById("newBack");
  const front = frontEl.value.trim();
  const back = backEl.value.trim();
  if (!front || !back) {
    showToast("Add both a word and its meaning.");
    return;
  }
  cards.push({ id: uid(), front, back });
  await saveCards();
  frontEl.value = "";
  backEl.value = "";
  showToast("Card added.");
  renderWordList();
  document.getElementById("countChip").textContent =
    `${cards.length} card${cards.length === 1 ? "" : "s"}`;
  frontEl.focus();
}

function startEdit(id) {
  editingId = id;
  renderWordList();
}

function cancelEdit() {
  editingId = null;
  renderWordList();
}

async function saveEdit(id) {
  const front = document.getElementById(`edit-front-${id}`).value.trim();
  const back = document.getElementById(`edit-back-${id}`).value.trim();
  if (!front || !back) {
    showToast("Both fields are required.");
    return;
  }
  const c = cards.find((c) => c.id === id);
  if (c) {
    c.front = front;
    c.back = back;
  }
  await saveCards();
  editingId = null;
  showToast("Card updated.");
  renderWordList();
}

async function deleteCard(id) {
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const wasCurrent = idx === currentIndex;
  cards.splice(idx, 1);
  if (currentIndex >= cards.length)
    currentIndex = Math.max(0, cards.length - 1);
  await saveCards();
  await saveProgress();
  showToast("Card deleted.");
  renderWordList();
  document.getElementById("countChip").textContent = cards.length
    ? `${cards.length} card${cards.length === 1 ? "" : "s"}`
    : "";
}

(async function init() {
  document.getElementById("tabStudy").classList.add("active");
  render();
  await loadCards();
  document
    .getElementById("tabStudy")
    .classList.toggle("active", view === "study");
  document
    .getElementById("tabManage")
    .classList.toggle("active", view === "manage");
  render();
})();
