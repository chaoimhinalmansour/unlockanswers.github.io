"use strict";

(() => {
  const root = new URL(".", document.currentScript.src);
  const active = window.UnlockSession.requireSession("teacher");
  if (!active) return;

  const current = new URL(location.href);
  const view = current.searchParams.get("view") === "classroom" ? "classroom" : "backstage";
  const title = view === "classroom" ? "课堂课件" : "课件后台";
  const catalog = new URL("index.html", root);
  catalog.searchParams.set("view", view);
  const unitBook = /\/units\/B(0[1-5])-/.exec(current.pathname);
  if (unitBook) catalog.hash = "book-" + Number(unitBook[1]);
  window.UnlockCourseware = { classroom: view === "classroom", catalog };
  document.documentElement.dataset.coursewareView = view;

// Matching can be opened directly before a teacher visits the first Word Card.
  // Keep the normal display path, and gate only this activity on its shared card bank.
  function loadVocabulary(unit) {
    const runtime = document.createElement("script");
    runtime.src = new URL("vocabulary-wordcards.js?v=20261129-picture-matching", root);
    runtime.dataset.wordlist = unit;
    const ready = new Promise(resolve => {
      runtime.addEventListener("load", resolve, { once: true });
      runtime.addEventListener("error", resolve, { once: true });
    });
    if (typeof display === "function" && typeof cases !== "undefined") {
      const show = display;
      let revision = 0;
      display = async function(index, page = 0) {
        const request = ++revision;
        if (cases[index]?.flow?.kind === "match") {
          await ready;
          if (request !== revision) return;
          await window.UnlockCourseware.prepareLessonPictureMatching?.();
          if (request !== revision) return;
        }
        return show(index, page);
      };
    }
    document.head.append(runtime);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const heading = document.querySelector("[data-courseware-title]");
    if (heading) {
      heading.textContent = title;
      document.title = title + " | UNLOCK";
      for (const link of document.querySelectorAll('a[href^="units/"]')) {
        const url = new URL(link.href);
        url.searchParams.set("view", view);
        link.href = url.href;
      }
    } else {
      document.title = document.title.replace(/课堂课件$/, title);
      for (const back of document.querySelectorAll("[data-courseware-catalog]")) back.href = catalog.href;
      const unit = /\/units\/(B0[1-5]-(?:LS|RW)-U\d{2})\.html$/.exec(current.pathname)?.[1];
      if (unit) loadVocabulary(unit);
    }
    document.documentElement.removeAttribute("data-courseware-pending");
  }, { once: true });
})();
