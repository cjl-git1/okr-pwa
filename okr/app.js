/* OKR PWA — vanilla JS, offline-first, localStorage-backed. */

/* ---------- Storage ---------- */
const STORAGE_KEY = "okr-state-v1";
const SCHEMA_VERSION = 1;

const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  periods: [],
  objectives: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return clone(DEFAULT_STATE);
    // minimal migration (v1 is current)
    if (!parsed.version || parsed.version < SCHEMA_VERSION) {
      return Object.assign(clone(DEFAULT_STATE), parsed);
    }
    return parsed;
  } catch (e) {
    console.warn("loadState failed", e);
    return clone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("saveState failed", e);
    toast("保存失败，请检查存储空间");
  }
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- State ---------- */
let state = loadState();
let expanded = new Set(JSON.parse(localStorage.getItem("okr-expanded") || "[]"));

function persistExpanded() {
  localStorage.setItem("okr-expanded", JSON.stringify([...expanded]));
}

function activePeriodId() {
  const p = state.periods.find(p => p.isActive);
  return p ? p.id : null;
}

function activePeriodName() {
  const p = state.periods.find(p => p.isActive);
  return p ? p.name : "—";
}

/* ---------- Progress math ---------- */
function krPct(kr) {
  const b = Number(kr.baseline) || 0;
  const t = Number(kr.target) || 0;
  const c = Number(kr.current) || 0;
  if (t === b) return c >= t && t !== 0 ? 100 : 0;
  const p = (c - b) / (t - b);
  return Math.max(0, Math.min(1, p)) * 100;
}

function objPct(obj) {
  const krs = obj.keyResults || [];
  if (krs.length === 0) return 0;
  const sum = krs.reduce((a, kr) => a + krPct(kr), 0);
  return sum / krs.length;
}

/* ---------- Rendering ---------- */
const $main = () => document.getElementById("main");
const $periodLabel = () => document.getElementById("current-period-label");
const $modalRoot = () => document.getElementById("modal-root");

function render() {
  renderPeriodLabel();
  renderBody();
  persistExpanded();
}

function renderPeriodLabel() {
  $periodLabel().textContent = activePeriodName();
}

function renderBody() {
  const pid = activePeriodId();
  const root = $main();

  if (state.periods.length === 0) {
    root.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${iconSvg("cal")}</div>
        <div class="empty-title">还没有周期</div>
        <div class="empty-sub">先建一个季度周期（比如 2026 Q4），再往里加目标 O 和关键结果 KR。</div>
        <div class="empty-cta" id="empty-cta">新建周期</div>
      </div>
    `;
    root.querySelector("#empty-cta").onclick = openPeriodModal;
    return;
  }

  const objs = state.objectives
    .filter(o => o.periodId === pid && !o.archived)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const archived = state.objectives
    .filter(o => o.periodId === pid && o.archived);

  if (objs.length === 0 && archived.length === 0) {
    root.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${iconSvg("target")}</div>
        <div class="empty-title">这个周期还没有目标</div>
        <div class="empty-sub">点右下角 <b>+</b> 开始写下你的第一个 O（Objective）。</div>
      </div>
    `;
    return;
  }

  let html = "";
  if (objs.length > 0) {
    html += `<div class="section-label">进行中 · ${objs.length}</div><div class="obj-list">${objs.map(renderObjCard).join("")}</div>`;
  }
  if (archived.length > 0) {
    html += `<div class="section-label">已归档 · ${archived.length}</div><div class="obj-list">${archived.map(renderObjCard).join("")}</div>`;
  }
  root.innerHTML = html;
  bindObjEvents(root);
}

function renderObjCard(obj) {
  const pct = objPct(obj);
  const isExpanded = expanded.has(obj.id);
  const done = pct >= 100 ? " done" : "";

  const krsHtml = (obj.keyResults || []).map(kr => {
    const pct = krPct(kr);
    const b = Number(kr.baseline) || 0;
    const t = Number(kr.target) || 0;
    const c = Number(kr.current) || 0;
    return `
      <div class="kr-row" data-kr-id="${kr.id}">
        <div class="kr-title-row">
          <div class="kr-title"><input type="text" data-role="kr-title" value="${escapeHtml(kr.title)}" /></div>
          <button class="kr-del" data-role="kr-del" aria-label="删除 KR">✕</button>
        </div>
        <div class="kr-metric-row">
          <div class="kr-value-group">
            <span>${escapeHtml(kr.unit || "")}</span>
            <input type="number" step="any" data-role="kr-base" value="${b}" aria-label="基线">
            <span>→</span>
            <input type="number" step="any" data-role="kr-target" value="${t}" aria-label="目标">
            <span>现在</span>
            <input type="number" step="any" data-role="kr-current" value="${c}" aria-label="当前值">
          </div>
        </div>
        <div class="kr-metric-row">
          <input type="range" class="kr-slider" min="0" max="100" step="1"
                 data-role="kr-slider" value="${Math.round(pct)}"
                 aria-label="KR 进度">
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="obj-card ${isExpanded ? "expanded" : ""} ${obj.archived ? "archived" : ""}" data-obj-id="${obj.id}">
      <div class="obj-header" data-role="toggle">
        <div class="obj-title-row">
          <div class="obj-title">${escapeHtml(obj.title)}</div>
          <svg class="obj-chevron" viewBox="0 0 12 12" width="12" height="12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        ${obj.description ? `<div class="obj-desc">${escapeHtml(obj.description)}</div>` : ""}
      </div>
      <div class="obj-progress-wrap">
        <div class="progress-track"><div class="progress-fill${done}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="progress-label">${Math.round(pct)}%</div>
      </div>
      ${isExpanded ? `
        <div class="kr-list">
          ${krsHtml || `<div class="kr-row" style="color:var(--text-3);font-size:13px">还没有 KR，点下面「添加 KR」</div>`}
          <button class="add-kr-btn" data-role="add-kr">+ 添加 KR</button>
        </div>
        <div class="obj-actions">
          <button class="btn" data-role="edit-obj">编辑</button>
          <button class="btn" data-role="${obj.archived ? "unarchive" : "archive"}">${obj.archived ? "取消归档" : "归档"}</button>
          <button class="btn danger" data-role="del-obj">删除</button>
        </div>
      ` : `
        <div class="obj-actions" style="border-top:none;padding-top:2px">
          <span style="font-size:12px;color:var(--text-3)">${(obj.keyResults||[]).length} 个 KR</span>
        </div>
      `}
    </div>
  `;
}

function bindObjEvents(root) {
  // Objective card interactions
  root.querySelectorAll(".obj-card").forEach(card => {
    const id = card.dataset.objId;

    card.querySelector('[data-role="toggle"]').addEventListener("click", () => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      render();
    });
    card.querySelector('[data-role="edit-obj"]')?.addEventListener("click", () => openObjModal(id));
    card.querySelector('[data-role="del-obj"]')?.addEventListener("click", () => deleteObjective(id));
    card.querySelector('[data-role="archive"]')?.addEventListener("click", () => toggleArchive(id));
    card.querySelector('[data-role="unarchive"]')?.addEventListener("click", () => toggleArchive(id));
    card.querySelector('[data-role="add-kr"]')?.addEventListener("click", () => addKR(id));

    // KR row interactions
    card.querySelectorAll(".kr-row").forEach(row => {
      const krId = row.dataset.krId;
      // use `change` (fires on blur / Enter) so typing doesn't lose focus
      row.querySelector('[data-role="kr-title"]')?.addEventListener("change", e => {
        updateKR(id, krId, "title", e.target.value.trim());
      });
      row.querySelector('[data-role="kr-del"]')?.addEventListener("click", () => deleteKR(id, krId));
      row.querySelector('[data-role="kr-base"]')?.addEventListener("change", e => {
        updateKR(id, krId, "baseline", parseFloat(e.target.value) || 0);
      });
      row.querySelector('[data-role="kr-target"]')?.addEventListener("change", e => {
        updateKR(id, krId, "target", parseFloat(e.target.value) || 0);
      });
      row.querySelector('[data-role="kr-current"]')?.addEventListener("change", e => {
        updateKR(id, krId, "current", parseFloat(e.target.value) || 0);
      });
      row.querySelector('[data-role="kr-slider"]')?.addEventListener("input", e => {
        sliderUpdateKR(id, krId, parseFloat(e.target.value));
      });
    });
  });
}

function iconSvg(kind) {
  const paths = {
    cal: `<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 9h16M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
    target: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  };
  return `<svg viewBox="0 0 24 24" width="40" height="40">${paths[kind] || ""}</svg>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Actions: Objectives ---------- */
function getObj(id) { return state.objectives.find(o => o.id === id); }

function createObjective({ title, description } = {}) {
  const pid = activePeriodId();
  if (!pid) return;
  const obj = {
    id: uid(),
    periodId: pid,
    title: title || "新的目标",
    description: description || "",
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    keyResults: [],
  };
  state.objectives.push(obj);
  expanded.add(obj.id);
  saveState();
  render();
  return obj;
}

function updateObjective(id, patch) {
  const o = getObj(id);
  if (!o) return;
  Object.assign(o, patch, { updatedAt: Date.now() });
  saveState();
  render();
}

function deleteObjective(id) {
  if (!confirm("确定删除这个目标？里面的 KR 会一并删除。")) return;
  state.objectives = state.objectives.filter(o => o.id !== id);
  expanded.delete(id);
  saveState();
  render();
  toast("已删除");
}

function toggleArchive(id) {
  const o = getObj(id);
  if (!o) return;
  o.archived = !o.archived;
  o.updatedAt = Date.now();
  saveState();
  render();
  toast(o.archived ? "已归档" : "已取消归档");
}

function addKR(objectiveId) {
  const o = getObj(objectiveId);
  if (!o) return;
  o.keyResults = o.keyResults || [];
  o.keyResults.push({
    id: uid(),
    title: "新的关键结果",
    baseline: 0,
    target: 100,
    current: 0,
    unit: "",
  });
  o.updatedAt = Date.now();
  expanded.add(objectiveId);
  saveState();
  render();
}

function updateKR(objId, krId, field, value) {
  const o = getObj(objId);
  if (!o) return;
  const kr = (o.keyResults || []).find(k => k.id === krId);
  if (!kr) return;
  kr[field] = value;
  o.updatedAt = Date.now();
  saveState();
  // Re-render only header/progress to keep focus
  render();
}

function deleteKR(objId, krId) {
  const o = getObj(objId);
  if (!o) return;
  o.keyResults = (o.keyResults || []).filter(k => k.id !== krId);
  o.updatedAt = Date.now();
  saveState();
  render();
}

function sliderUpdateKR(objId, krId, pct) {
  const o = getObj(objId);
  if (!o) return;
  const kr = (o.keyResults || []).find(k => k.id === krId);
  if (!kr) return;
  const b = Number(kr.baseline) || 0;
  const t = Number(kr.target) || 0;
  const newC = b + (t - b) * (pct / 100);
  kr.current = Math.round(newC * 100) / 100;
  o.updatedAt = Date.now();
  saveState();
  // Update progress bars only
  render();
}

/* ---------- Periods ---------- */
function createPeriod(name) {
  const p = { id: uid(), name: name || "新周期", isActive: false };
  state.periods.push(p);
  // If it's the first, make it active
  if (state.periods.length === 1) p.isActive = true;
  saveState();
  render();
  return p;
}

function setActivePeriod(id) {
  state.periods.forEach(p => { p.isActive = p.id === id; });
  saveState();
  render();
}

function deletePeriod(id) {
  const objsInPeriod = state.objectives.filter(o => o.periodId === id).length;
  const msg = objsInPeriod
    ? `该周期下有 ${objsInPeriod} 个目标，将一并删除。确定吗？`
    : "确定删除这个周期？";
  if (!confirm(msg)) return;
  state.periods = state.periods.filter(p => p.id !== id);
  state.objectives = state.objectives.filter(o => o.periodId !== id);
  // If active period was deleted, activate the first remaining
  if (!state.periods.find(p => p.isActive) && state.periods.length > 0) {
    state.periods[0].isActive = true;
  }
  saveState();
  render();
  toast("周期已删除");
}

/* ---------- Modals ---------- */
function closeModal() {
  $modalRoot().innerHTML = "";
}

function openObjModal(id) {
  const obj = id ? getObj(id) : null;
  const title = obj ? "编辑目标" : "新建目标";
  const html = `
    <div class="modal-backdrop" data-role="backdrop">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" data-role="close">取消</button>
        </div>
        <label class="field">
          <span>目标（Objective）</span>
          <input type="text" id="m-title" maxlength="120"
                 placeholder="例如：把新人留存做起来"
                 value="${obj ? escapeHtml(obj.title) : ""}">
        </label>
        <label class="field">
          <span>说明（可选）</span>
          <textarea id="m-desc" maxlength="500"
                    placeholder="为什么这个目标重要，希望达成什么效果">${obj ? escapeHtml(obj.description) : ""}</textarea>
        </label>
        <div class="modal-actions">
          <button class="btn secondary" data-role="close">取消</button>
          <button class="btn primary" data-role="save">${obj ? "保存" : "创建"}</button>
        </div>
      </div>
    </div>
  `;
  $modalRoot().innerHTML = html;
  bindModal(obj ? (t, d) => saveObjEdit(id, t, d) : (t, d) => saveObjCreate(t, d));
  setTimeout(() => $modalRoot().querySelector("#m-title")?.focus(), 50);
}

function bindModal(onSave) {
  const root = $modalRoot();
  root.querySelector('[data-role="backdrop"]').addEventListener("click", e => {
    if (e.target.dataset.role === "backdrop") closeModal();
  });
  root.querySelectorAll('[data-role="close"]').forEach(b => b.onclick = closeModal);
  root.querySelector('[data-role="save"]').onclick = () => {
    const title = root.querySelector("#m-title").value.trim();
    const desc = root.querySelector("#m-desc").value.trim();
    if (!title) { toast("请填写目标标题"); return; }
    onSave(title, desc);
    closeModal();
  };
}

function saveObjCreate(title, description) {
  createObjective({ title, description });
  toast("已创建");
}

function saveObjEdit(id, title, description) {
  updateObjective(id, { title, description });
  toast("已保存");
}

function openPeriodModal(id) {
  const p = id ? state.periods.find(x => x.id === id) : null;
  const title = p ? "编辑周期" : "新建周期";
  const html = `
    <div class="modal-backdrop" data-role="backdrop">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" data-role="close">取消</button>
        </div>
        <label class="field">
          <span>周期名称</span>
          <input type="text" id="m-period-name" maxlength="40"
                 placeholder="例如 2026 Q4"
                 value="${p ? escapeHtml(p.name) : ""}">
        </label>
        <div class="modal-actions">
          <button class="btn secondary" data-role="close">取消</button>
          <button class="btn primary" data-role="save">${p ? "保存" : "创建"}</button>
        </div>
      </div>
    </div>
  `;
  $modalRoot().innerHTML = html;
  const root = $modalRoot();
  root.querySelector('[data-role="backdrop"]').addEventListener("click", e => {
    if (e.target.dataset.role === "backdrop") closeModal();
  });
  root.querySelectorAll('[data-role="close"]').forEach(b => b.onclick = closeModal);
  root.querySelector('[data-role="save"]').onclick = () => {
    const name = root.querySelector("#m-period-name").value.trim();
    if (!name) { toast("请填写周期名称"); return; }
    if (p) {
      p.name = name;
      saveState(); render(); toast("已保存");
    } else {
      createPeriod(name); toast("已创建");
    }
    closeModal();
  };
  setTimeout(() => root.querySelector("#m-period-name")?.focus(), 50);
}

function openPeriodPicker() {
  const rows = state.periods.map(p => `
    <button data-pid="${p.id}">
      <span style="display:flex;justify-content:space-between;width:100%">
        <span>${p.isActive ? "● " : ""}${escapeHtml(p.name)}</span>
        <span style="display:flex;gap:12px;align-items:center;color:var(--text-3);font-size:12px">
          <span data-edit="${p.id}">编辑</span>
          <span data-del="${p.id}" style="color:var(--danger)">删除</span>
        </span>
      </span>
    </button>
  `).join("");

  $modalRoot().innerHTML = `
    <div class="modal-backdrop" data-role="backdrop">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <div class="modal-title">切换周期</div>
          <button class="modal-close" data-role="close">关闭</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          ${rows || `<div style="color:var(--text-3);font-size:14px;padding:8px 0">还没有周期</div>`}
        </div>
        <div class="modal-actions">
          <button class="btn secondary" data-role="close">取消</button>
          <button class="btn primary" data-role="new-period">+ 新建周期</button>
        </div>
      </div>
    </div>
  `;
  const root = $modalRoot();
  root.querySelector('[data-role="backdrop"]').addEventListener("click", e => {
    if (e.target.dataset.role === "backdrop") closeModal();
  });
  root.querySelectorAll('[data-role="close"]').forEach(b => b.onclick = closeModal);
  root.querySelector('[data-role="new-period"]').onclick = () => { closeModal(); openPeriodModal(); };
  root.querySelectorAll("button[data-pid]").forEach(b => {
    b.addEventListener("click", e => {
      // Ignore if clicking on edit/del spans
      if (e.target.dataset.edit || e.target.dataset.del) return;
      setActivePeriod(b.dataset.pid);
      closeModal();
      toast(`已切换到 ${activePeriodName()}`);
    });
  });
  root.querySelectorAll("[data-edit]").forEach(el => {
    el.onclick = e => { e.stopPropagation(); closeModal(); openPeriodModal(el.dataset.edit); };
  });
  root.querySelectorAll("[data-del]").forEach(el => {
    el.onclick = e => { e.stopPropagation(); const pid = el.dataset.del; closeModal(); deletePeriod(pid); };
  });
}

/* ---------- Backup ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `okr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("备份已下载");
}

function importJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.periods) || !Array.isArray(parsed.objectives)) {
          throw new Error("格式不正确");
        }
        if (!confirm("恢复会覆盖当前所有数据。继续？")) return;
        state = parsed;
        saveState();
        render();
        toast("已恢复");
      } catch (err) {
        toast("导入失败：" + err.message);
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

function openBackupMenu() {
  const root = $modalRoot();
  root.innerHTML = `
    <div class="menu">
      <button data-act="export">下载备份 (JSON)</button>
      <button data-act="import">恢复备份</button>
      <div class="menu-divider"></div>
      <button data-act="reset" style="color:var(--danger)">清空所有数据</button>
    </div>
  `;
  root.querySelector('[data-act="export"]').onclick = () => { root.innerHTML = ""; exportJSON(); };
  root.querySelector('[data-act="import"]').onclick = () => { root.innerHTML = ""; importJSON(); };
  root.querySelector('[data-act="reset"]').onclick = () => {
    root.innerHTML = "";
    if (!confirm("确定清空所有数据？此操作不可撤销。")) return;
    state = clone(DEFAULT_STATE);
    expanded.clear();
    saveState();
    render();
    toast("已清空");
  };
  document.addEventListener("click", function closeMenu(e) {
    if (!root.contains(e.target) && e.target.id !== "btn-backup") {
      root.innerHTML = "";
      document.removeEventListener("click", closeMenu);
    }
  });
}

/* ---------- Toast ---------- */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

/* ---------- Service worker ---------- */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const statusEl = document.createElement("div");
  statusEl.className = "sw-status no";
  statusEl.id = "sw-status";
  document.body.appendChild(statusEl);
  setTimeout(() => statusEl.remove(), 2500);

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      statusEl.className = "sw-status ok";
    }).catch(() => {
      statusEl.className = "sw-status no";
      statusEl.textContent = " · SW 注册失败";
    });
  });
}

/* ---------- Init ---------- */
function init() {
  render();

  document.getElementById("btn-period").onclick = openPeriodPicker;
  document.getElementById("btn-backup").onclick = (e) => {
    e.stopPropagation();
    const already = $modalRoot().querySelector(".menu");
    if (already) { $modalRoot().innerHTML = ""; return; }
    openBackupMenu();
  };
  document.getElementById("fab").onclick = () => {
    if (state.periods.length === 0) { openPeriodModal(); return; }
    openObjModal();
  };

  // iOS standalone detection to adjust scroll
  if (window.matchMedia("(display-mode: standalone)").matches) {
    document.documentElement.classList.add("standalone");
  }

  registerSW();
}

document.addEventListener("DOMContentLoaded", init);
