"use strict";

(function () {
  const site = new URL("../", document.currentScript.src);
  const sessionKey = "unlock.session.v1";
  const roles = ["student", "teacher"];
  const pages = new Map([
    ["practice/index.html", ["student"]],
    ["classroom/index.html", ["student"]],
    ["practice/teaching.html", ["teacher"]],
    ["feedback/index.html", ["teacher"]],
    ["courseware/index.html", ["teacher"]],
    ["writing-review.html", roles]
  ]);
  const storage = (() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      try {
        const area = window[name];
        area.getItem(sessionKey);
        return area;
      } catch {}
    }
    return null;
  })();

  function current() {
    try {
      const value = JSON.parse(storage?.getItem(sessionKey) || "null");
      return value && roles.includes(value.role) && typeof value.id === "string" && value.id &&
        (value.role !== "student" || typeof value.student === "string" && value.student)
        ? value : null;
    } catch {
      return null;
    }
  }

  function update(value) {
    try {
      if (!storage) return false;
      storage.setItem(sessionKey, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function student(session) {
    return session?.role === "student"
      ? (window.UNLOCK_STUDENTS || []).find(person => (person.storageName ?? person.name) === session.student)
      : undefined;
  }

  function destination(target, role) {
    if (!target) return null;
    try {
      const url = new URL(target, site);
      if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) return null;
      const file = url.pathname.slice(site.pathname.length);
      const canonical = file === "practice/" ? "practice/index.html"
        : file === "classroom/" ? "classroom/index.html"
          : file === "feedback/" ? "feedback/index.html" : file;
      const coursewareUnit = /^courseware\/units\/B(?:0[1-4]-(?:LS|RW)-U0[1-8]|05-(?:LS|RW)-U(?:0[1-9]|10))\.html$/.test(canonical);
      const permitted = pages.get(canonical) ?? (coursewareUnit ? ["teacher"] : null);
      return permitted && (!role || permitted.includes(role)) ? url : null;
    } catch {
      return null;
    }
  }

  function signInUrl(role, target) {
    const url = new URL("index.html", site);
    if (roles.includes(role)) url.searchParams.set("role", role);
    const next = destination(target, role);
    if (next) url.searchParams.set("next", next.pathname + next.search + next.hash);
    return url;
  }

  function watch(listener) {
    window.addEventListener("storage", event => {
      if (event.key === sessionKey || event.key === null) listener();
    });
    window.addEventListener("pageshow", event => {
      if (event.persisted) listener();
    });
  }

  function requireSession(role) {
    const matches = value => value && (!role || value.role === role);
    const active = current();
    if (!matches(active)) {
      location.replace(signInUrl(role, location.href));
      return null;
    }
    watch(() => {
      const latest = current();
      if (!matches(latest)) location.replace(signInUrl(role, location.href));
      else if (latest.id !== active.id) location.reload();
    });
    return active;
  }

  function signIn(role, person) {
    const id = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
    return update({ id, role, student: person ? person.storageName ?? person.name : undefined });
  }

  function signOut(role, target) {
    if (update(null)) location.replace(signInUrl(role, target));
    else window.alert("当前浏览器无法退出登录，请重试。");
  }

  async function matchesPassword(password, expected) {
    const input = new TextEncoder().encode(password.trim());
    const digest = await crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("") === expected;
  }

  window.UnlockSession = { current, student, destination, signInUrl, requireSession, signIn, signOut, watch, matchesPassword };
})();
