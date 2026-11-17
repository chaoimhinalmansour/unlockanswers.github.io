"use strict";

(function () {
  const surface = document.getElementById("practice-surface");
  const { escapeHTML: esc } = window.UnlockRules;
  const panes = new Map();
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(refresh) : null;

  function controls(id, label) {
    const target = esc(id);
    const name = esc(label);
    return '<nav class="screen-pages" data-screen-controls="' + target + '" aria-label="' + name + '翻屏" hidden>' +
      '<button type="button" data-screen-step="-1" aria-controls="' + target + '" aria-label="' + name + '上一屏">上一屏</button>' +
      '<output></output>' +
      '<button type="button" data-screen-step="1" aria-controls="' + target + '" aria-label="' + name + '下一屏">下一屏</button></nav>';
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
    nav.querySelector("output").textContent = "第 " + (current + 1) + " 屏，共 " + (last + 1) + " 屏";
    nav.querySelector('[data-screen-step="-1"]').disabled = pane.scrollTop < 1;
    nav.querySelector('[data-screen-step="1"]').disabled = pane.scrollTop >= end - 1;
  }

  function refresh() {
    for (const [pane, nav] of panes) update(pane, nav);
  }

  function connect(root) {
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
    refresh();
  }

  function reveal(node) {
    const pane = node.closest("[data-screen-view]");
    if (!pane || pane === node) return;
    const viewport = pane.getBoundingClientRect();
    const item = node.getBoundingClientRect();
    if (item.bottom > viewport.bottom - 8 || item.top < viewport.top) {
      pane.scrollTop += item.top - viewport.top - 8;
    }
  }

  surface.addEventListener("click", event => {
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

  function fitViewport() {
    const viewport = window.visualViewport;
    const height = Math.floor(viewport?.scale === 1 ? viewport.height : window.innerHeight);
    surface.style.setProperty("--screen-height", height + "px");
    surface.classList.toggle("short-workspace", height < 680);
    surface.classList.toggle("tight-workspace", height < 480);
    refresh();
  }

  window.addEventListener("resize", fitViewport);
  window.visualViewport?.addEventListener("resize", fitViewport);
  fitViewport();

  window.UnlockScreens = { controls, connect, reveal };
})();
