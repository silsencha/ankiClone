(function () {
  const STORAGE_KEY = "wordcatalog:cards";
  let cards = [];
  let queue = [];
  let current = null;
  let answerShown = false;
  let loaded = false;

  const el = (id) => document.getElementById(id);
  const now = () => Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  function newCard(front, back) {
    return {
      id: "c" + Date.now() + Math.random().toString(36).slice(2, 8),
      front: front.trim(),
      back: back.trim(),
      ease: 2.5,
      interval: 0,
      reps: 0,
      due: now(),
      created: now(),
    };
  }

  async function loadCards() {
    try {
      const res = await window.storage.get(STORAGE_KEY, false);
      cards = res && res.value ? JSON.parse(res.value) : [];
    } catch (e) {
      cards = [];
    }
    loaded = true;
  }

  async function saveCards() {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(cards), false);
    } catch (e) {
      console.error("Could not save cards", e);
    }
  }

  function buildQueue() {
    const t = now();
    queue = cards.filter((c) => c.due <= t).sort((a, b) => a.due - b.due);
  }

  function dueCountToday() {
    return cards.filter((c) => c.due <= now()).length;
  }

  function refreshDueStamp() {
    el("dueCount").textContent = dueCountToday();
  }

  function renderStudy() {
    refreshDueStamp();
    buildQueue();
    const area = el("studyArea");
    if (cards.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <div class="big">Catalog is empty</div>
        No cards yet. Go to “Add Word” to file your first one.
      </div>`;
      current = null;
      return;
    }
    if (queue.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <div class="big">All caught up</div>
        Nothing due right now. Come back later, or add more words.
      </div>`;
      current = null;
      return;
    }
    current = queue[0];
    answerShown = false;
    area.innerHTML = `
      <div class="stage">
        <div class="index-card" id="indexCard">
          <div class="card-eyebrow">Card ${cards.length - queue.length + 1} of ${cards.length} filed &middot; ${dueCountToday()} due</div>
          <div class="card-face">${escapeHtml(current.front)}</div>
          <div class="card-back" id="cardBack">${escapeHtml(current.back)}</div>
        </div>
        <div class="tap-hint" id="tapHint">tap the card to reveal the answer</div>
      </div>
      <div class="rate-row">
        <button class="rate-btn rate-again" data-r="again" disabled>Again<small>&lt;1m</small></button>
        <button class="rate-btn rate-hard" data-r="hard" disabled>Hard<small>soon</small></button>
        <button class="rate-btn rate-good" data-r="good" disabled>Good<small>1d+</small></button>
        <button class="rate-btn rate-easy" data-r="easy" disabled>Easy<small>4d+</small></button>
      </div>
    `;
    el("indexCard").addEventListener("click", revealAnswer);
    area
      .querySelectorAll(".rate-btn")
      .forEach((b) => b.addEventListener("click", () => rate(b.dataset.r)));
  }

  function revealAnswer() {
    if (answerShown) return;
    answerShown = true;
    el("cardBack").classList.add("shown");
    el("tapHint").textContent = "choose how well you knew it";
    document.querySelectorAll(".rate-btn").forEach((b) => (b.disabled = false));
  }

  function rate(r) {
    if (!current) return;
    const c = current;
    if (r === "again") {
      c.reps = 0;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.interval = 0;
      c.due = now() + 60 * 1000; // back in ~1 minute, will resurface this session/soon
    } else if (r === "hard") {
      c.ease = Math.max(1.3, c.ease - 0.15);
      c.interval = c.reps === 0 ? 1 : Math.max(1, Math.round(c.interval * 1.2));
      c.reps += 1;
      c.due = now() + c.interval * DAY;
    } else if (r === "good") {
      if (c.reps === 0) c.interval = 1;
      else if (c.reps === 1) c.interval = 6;
      else c.interval = Math.round(c.interval * c.ease);
      c.reps += 1;
      c.due = now() + c.interval * DAY;
    } else if (r === "easy") {
      c.interval =
        c.reps === 0 ? 4 : Math.round((c.interval || 1) * c.ease * 1.3) + 1;
      c.ease = c.ease + 0.15;
      c.reps += 1;
      c.due = now() + c.interval * DAY;
    }
    saveCards();
    renderStudy();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- Add form ----
  el("addBtn").addEventListener("click", async () => {
    const front = el("frontInput").value.trim();
    const back = el("backInput").value.trim();
    const msg = el("formMsg");
    if (!front || !back) {
      msg.style.color = "var(--red)";
      msg.textContent = "Both the word and its meaning are needed.";
      return;
    }
    el("addBtn").disabled = true;
    cards.push(newCard(front, back));
    await saveCards();
    el("frontInput").value = "";
    el("backInput").value = "";
    msg.style.color = "var(--green)";
    msg.textContent = "Filed. Ready to study whenever it comes due.";
    el("addBtn").disabled = false;
    el("frontInput").focus();
    refreshDueStamp();
  });
  el("frontInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el("backInput").focus();
    }
  });

  // ---- Manage ----
  function renderManage(filter) {
    const list = el("manageList");
    const term = (filter || "").toLowerCase();
    const shown = cards
      .filter(
        (c) =>
          !term ||
          c.front.toLowerCase().includes(term) ||
          c.back.toLowerCase().includes(term),
      )
      .sort((a, b) => b.created - a.created);
    el("manageCount").textContent =
      `${cards.length} card${cards.length === 1 ? "" : "s"} in the catalog`;
    if (shown.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="big">Nothing here</div>${cards.length ? "No cards match your search." : "Add your first word to get started."}</div>`;
      return;
    }
    list.innerHTML = shown
      .map((c) => {
        const status =
          c.due <= now()
            ? "due now"
            : "due " + new Date(c.due).toLocaleDateString();
        return `<li class="manage-item" data-id="${c.id}">
        <div class="mi-text">
          <div class="mi-front">${escapeHtml(c.front)}</div>
          <div class="mi-back">${escapeHtml(c.back)}</div>
          <div class="mi-meta">${status} &middot; reviewed ${c.reps} time${c.reps === 1 ? "" : "s"}</div>
        </div>
        <button class="mi-del" data-id="${c.id}">Remove</button>
      </li>`;
      })
      .join("");
    list.querySelectorAll(".mi-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        cards = cards.filter((c) => c.id !== btn.dataset.id);
        await saveCards();
        renderManage(el("searchInput").value);
        refreshDueStamp();
      });
    });
  }
  el("searchInput").addEventListener("input", (e) =>
    renderManage(e.target.value),
  );

  // ---- Tabs ----
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      ["study", "add", "manage"].forEach((name) => {
        el("panel-" + name).hidden = name !== tab.dataset.tab;
      });
      if (tab.dataset.tab === "study") renderStudy();
      if (tab.dataset.tab === "manage") renderManage(el("searchInput").value);
    });
  });

  // ---- Init ----
  (async function init() {
    await loadCards();
    renderStudy();
    renderManage("");
  })();
})();
