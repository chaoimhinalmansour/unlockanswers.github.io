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
      if (unit) {
        const runtime = document.createElement("script");
        runtime.src = new URL("vocabulary-wordcards.js", root);
        runtime.dataset.wordlist = unit;
        document.head.append(runtime);
      }
    }
    document.documentElement.removeAttribute("data-courseware-pending");
  }, { once: true });
})();
