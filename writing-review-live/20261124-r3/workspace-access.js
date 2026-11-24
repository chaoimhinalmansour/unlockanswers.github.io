"use strict";

(function () {
  const session = window.UnlockSession;
  const access = window.UnlockWritingAccess;
  const grantUrl = new URL("teacher-grant.json", document.currentScript.src);
  const teacherGrantContext = new TextEncoder().encode("unlock-writing/teacher-workspace/v1");
  const allowedFingerprints = new Set(["5127848aa9b38cffa5f2f962a16e040833c7f1d28f2817259c8736009e7e021b", "39c1cd80292d00a058d616fea8a878dfd79414509b7815f50c60a281fb993b1c", "5dcf107cd2cd519b3ad0a029a536dcd8fb7d0b9b12f071836c6cb7891782b5d2"]);
  const aliasOf = person => person?.name.match(/（([^）]+)）$/)?.[1];

  function forget() {
    try { sessionStorage.removeItem(session.writingKey); } catch {}
  }

  function matches(ticket, active) {
    const viewer = ticket?.viewer;
    return Boolean(active && viewer?.role === active.role &&
      (active.role === "teacher" || (viewer.name && aliasOf(session.student(active)) === viewer.name)));
  }

  function currentTicket() {
    const active = session.current();
    if (active?.role === "teacher" && matches(active.teacherWriting, active)) return active.teacherWriting;
    try {
      const raw = sessionStorage.getItem(session.writingKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved?.sessionId && saved.sessionId === active?.id && matches(saved.ticket, active)) {
        return saved.ticket;
      }
    } catch {}
    forget();
    return null;
  }

  async function openTeacherGrant(password) {
    const response = await fetch(grantUrl, { mode: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("teacher-writing-unavailable");
    const envelope = await response.json();
    if (envelope.version !== 1) throw new Error("teacher-writing-unavailable");
    const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
    const salt = decode(envelope.salt);
    const iv = decode(envelope.iv);
    const ciphertext = decode(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) {
      throw new Error("teacher-writing-unavailable");
    }
    const passwordKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password.trim()), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
      passwordKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: teacherGrantContext }, key, ciphertext
    );
    const ticket = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clear));
    if (ticket?.viewer?.role !== "teacher" || !ticket.catalog || !ticket.people?.length) {
      throw new Error("teacher-writing-unavailable");
    }
    return ticket;
  }

  function teacherSignInUrl(target) {
    const url = session.signInUrl("teacher", target);
    url.searchParams.set("entry", "20261124-teacher-workspace");
    return url;
  }

  function takeLoginCode() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (!fragment.has("review-login")) return null;
    const code = fragment.get("review-login");
    history.replaceState(history.state, "", location.pathname + location.search);
    return code;
  }

  async function reviewCodeFor(value) {
    const matched = /^UNLOCK1-[A-Za-z0-9_-]{43}\.(WR1-[A-Za-z0-9_-]{43})$/.exec(value);
    if (!matched) throw new Error("invalid-writing-code");
    const proof = new TextEncoder().encode("unlock-workspace/entry/v1:" + value);
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", proof));
    const fingerprint = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    if (!allowedFingerprints.has(fingerprint)) throw new Error("invalid-writing-code");
    return matched[1];
  }

  async function signIn(code, signal) {
    const reviewCode = await reviewCodeFor(code);
    const ticket = await access.authorize(reviewCode, signal);
    if (signal?.aborted) throw new DOMException("Login cancelled", "AbortError");
    const role = ticket.viewer.role;
    const person = role === "student" ? (window.UNLOCK_STUDENTS || []).find(
      entry => aliasOf(entry) === ticket.viewer.name
    ) : undefined;
    if (role === "student" && !person) throw new Error("invalid-writing-code");
    if (!session.signIn(role, person, role === "teacher" ? ticket : undefined)) {
      throw new Error("session-storage-unavailable");
    }
    if (role === "teacher") return;
    const active = session.current();
    if (!matches(ticket, active)) throw new Error("session-storage-unavailable");
    try {
      sessionStorage.setItem(session.writingKey, JSON.stringify({ sessionId: active.id, ticket }));
    } catch {
      throw new Error("session-storage-unavailable");
    }
  }

  session.watch(currentTicket);
  window.UnlockWritingWorkspace = {
    currentTicket, forget, matches, takeLoginCode, signIn, openTeacherGrant, teacherSignInUrl
  };
})();
