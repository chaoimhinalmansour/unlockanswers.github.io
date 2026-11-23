"use strict";

(function () {
  const surface = document.getElementById("practice-surface");
  const { escapeHTML: esc } = window.UnlockRules;
  const ui = window.UnlockStudentUI;
  const panes = new Map();
  let currentNotes = null;
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(refresh) : null;

  function controls(id, label) {
    const target = esc(id);
    const name = esc(label);
    const previous = ui ? ui.label("Previous", "上一屏") : "上一屏";
    const next = ui ? ui.label("Next", "下一屏") : "下一屏";
    return '<nav class="screen-pages" data-screen-controls="' + target + '" aria-label="' + name + '翻屏" hidden>' +
      '<button type="button" data-screen-step="-1" aria-controls="' + target + '" aria-label="' + name + '上一屏">' + previous + '</button>' +
      '<output></output>' +
      '<button type="button" data-screen-step="1" aria-controls="' + target + '" aria-label="' + name + '下一屏">' + next + '</button></nav>';
  }

  function position(pane) {
    const end = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const overlap = Math.min(28, Math.floor(pane.clientHeight / 5));
    const step = Math.max(1, pane.clientHeight - overlap);
    const last = Math.ceil(end / step);
    const current = pane.scrollTop >= end - 1 ? last : Math.min(last, Math.floor((pane.scrollTop + 1) / step));
    return { end, step, current, last };
  }

  function update(pane, nav) {
    // Inline editor controls sit below the editor. Other controls share the pane's box.
    const heightWithNavHidden = pane.clientHeight +
      (pane instanceof HTMLTextAreaElement ? 0 : nav.getBoundingClientRect().height);
    nav.hidden = !pane.clientHeight || pane.scrollHeight <= heightWithNavHidden + 1;
    if (nav.hidden) return;

    const { end, current, last } = position(pane);
    const output = nav.querySelector("output");
    const chinese = "第 " + (current + 1) + " 屏，共 " + (last + 1) + " 屏";
    if (ui) {
      if (output.querySelector(".ui-zh")?.textContent !== chinese) ui.setLabel(output, (current + 1) + " / " + (last + 1), chinese);
    } else output.textContent = chinese;
    nav.querySelector('[data-screen-step="-1"]').disabled = pane.scrollTop < 1;
    nav.querySelector('[data-screen-step="1"]').disabled = pane.scrollTop >= end - 1;
  }

  function refresh() {
    for (const [pane, nav] of panes) update(pane, nav);
  }

  function openNotesIfRoom() {
    const notes = currentNotes;
    if (!notes || notes.dataset.notesManual || notes.contains(document.activeElement)) return;
    if (notes.querySelector("textarea").value.trim()) return;
    const pane = notes.closest("[data-screen-view]");
    const nav = panes.get(pane);
    if (!pane?.clientHeight || !nav) return;

    const scrollTop = pane.scrollTop;
    // Measure the expanded notes against the space available without outer paging controls.
    const available = pane.clientHeight + nav.getBoundingClientRect().height;
    notes.open = true;
    if (pane.scrollHeight > available + 1) notes.open = false;
    if (pane.scrollTop !== scrollTop) pane.scrollTop = scrollTop;
  }

  function connect(root) {
    const previous = currentNotes;
    currentNotes = root.querySelector("[data-notes-fit]");
    if (currentNotes && previous?.dataset.notesManual &&
      currentNotes.dataset.notesFit === previous.dataset.notesFit) {
      currentNotes.open = previous.open;
      currentNotes.dataset.notesManual = "true";
    }
    observer?.disconnect();
    panes.clear();
    for (const nav of root.querySelectorAll("[data-screen-controls]")) {
      const pane = document.getElementById(nav.dataset.screenControls);
      if (!pane) continue;
      panes.set(pane, nav);
      observer?.observe(pane);
      const content = pane.querySelector(":scope > .screen-content");
      if (content) observer?.observe(content);
    }
    openNotesIfRoom();
    refresh();
  }

  function reveal(node) {
    const pane = node.parentElement?.closest("[data-screen-view]");
    if (!pane?.clientHeight) return;
    const viewport = pane.getBoundingClientRect();
    const item = node.getBoundingClientRect();
    if (item.bottom > viewport.bottom - 8 || item.top < viewport.top) {
      pane.scrollTop += item.top - viewport.top - 8;
    }
  }

  surface.addEventListener("click", event => {
    const summary = event.target.closest("[data-notes-fit] > summary");
    if (summary && summary.parentElement === currentNotes) currentNotes.dataset.notesManual = "true";
    const button = event.target.closest("[data-screen-step]");
    if (!button || button.disabled) return;
    const pane = document.getElementById(button.getAttribute("aria-controls"));
    if (!pane || !panes.has(pane)) return;
    const { end, step, current } = position(pane);
    const direction = Number(button.dataset.screenStep);
    // Focus or the caret may have moved partway into a screen.
    const previous = pane.scrollTop > current * step + 2 ? current : current - 1;
    const target = direction === 1 ? current + 1 : previous;
    pane.scrollTop = Math.min(end, Math.max(0, target) * step);
    update(pane, panes.get(pane));
  });

  surface.addEventListener("scroll", event => {
    const nav = panes.get(event.target);
    if (nav) update(event.target, nav);
  }, true);

  surface.addEventListener("input", event => {
    const nav = panes.get(event.target);
    if (nav) update(event.target, nav);
  });

  function fitActiveEditor() {
    const editor = document.activeElement;
    const editable = editor?.matches("textarea[data-answer], input[data-answer]") &&
      (editor instanceof HTMLTextAreaElement || editor.type === "text");
    const compact = surface.classList.contains("tight-workspace") && surface.classList.contains("in-worksheet") &&
      matchMedia("(any-pointer: coarse)").matches && editable && surface.contains(editor);
    surface.classList.toggle("editing-answer", Boolean(compact));
    if (compact) {
      refresh();
      reveal(editor);
    }
  }

  function fitViewport() {
    const viewport = window.visualViewport;
    const height = Math.floor(viewport?.scale === 1 ? viewport.height : window.innerHeight);
    surface.style.setProperty("--screen-height", height + "px");
    surface.classList.toggle("short-workspace", height < 680);
    surface.classList.toggle("tight-workspace", height < 480);
    fitActiveEditor();
    openNotesIfRoom();
    refresh();
  }

  surface.addEventListener("focusin", fitActiveEditor);
  surface.addEventListener("focusout", () => requestAnimationFrame(fitActiveEditor));
  window.addEventListener("resize", fitViewport);
  window.visualViewport?.addEventListener("resize", fitViewport);
  fitViewport();

  window.UnlockScreens = { controls, connect, reveal };
})();
