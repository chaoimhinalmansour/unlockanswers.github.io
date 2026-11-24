"use strict";

(function () {
  const root = new URL("../20261124-r1/data/", document.currentScript.src);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  function invalid() {
    return new Error("invalid-writing-code");
  }

  function keyBytes(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw invalid();
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(standard), ch => ch.charCodeAt(0));
    if (bytes.length !== 32 || btoa(String.fromCharCode(...bytes)).replace(/=+$/, "") !== standard) throw invalid();
    return bytes;
  }

  async function ticketPath(secret) {
    const domain = encoder.encode("unlock-writing/ticket/v1");
    const input = new Uint8Array(domain.length + secret.length);
    input.set(domain);
    input.set(secret, domain.length);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
    return "tickets/" + Array.from(digest, value => value.toString(16).padStart(2, "0")).join("") + ".bin";
  }

  async function readSealed(path, secret, signal, isTicket) {
    const response = await fetch(new URL(path, root), { mode: "same-origin", signal, cache: "no-store" });
    if (!response.ok) {
      if (isTicket && response.status === 404) throw invalid();
      throw new Error("writing-file-unavailable");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 29) throw new Error("writing-file-unavailable");
    const key = await crypto.subtle.importKey("raw", secret, "AES-GCM", false, ["decrypt"]);
    let cleartext;
    try {
      cleartext = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: bytes.subarray(0, 12),
        additionalData: encoder.encode("unlock-writing/record/v1/" + path),
        tagLength: 128
      }, key, bytes.subarray(12));
    } catch (error) {
      if (isTicket) throw invalid();
      throw error;
    }
    return JSON.parse(decoder.decode(cleartext));
  }

  function readBundle(reference, signal) {
    if (!/^[a-f0-9]{32}\.bin$/.test(reference?.file || "")) throw new Error("invalid-writing-bundle");
    return readSealed("bundles/" + reference.file, keyBytes(reference.key), signal, false);
  }

  async function open(value, signal) {
    const code = value.trim();
    if (!code.startsWith("WR1-")) throw invalid();
    const secret = keyBytes(code.slice(4));
    const ticket = await readSealed(await ticketPath(secret), secret, signal, true);
    const { role, name } = ticket.viewer || {};
    if (role !== "teacher" && role !== "student") throw invalid();
    const people = new Map(ticket.people.map(entry => [entry.name, entry.bundle]));
    if (role === "student" && (people.size !== 1 || !people.has(name))) throw invalid();
    const { topics } = await readBundle(ticket.catalog, signal);
    const byId = new Map(topics.map(topic => [topic.id, topic]));
    const caches = new Map();

    async function select(id, student, nextSignal) {
      const person = role === "teacher" ? student : name;
      const topic = byId.get(id);
      if (!topic || !people.has(person) || (role === "student" && student && student !== name)) {
        throw new Error("writing-view-unavailable");
      }
      if (!caches.has(person)) {
        const bundle = await readBundle(people.get(person), nextSignal);
        if (bundle.name !== person) throw new Error("invalid-writing-bundle");
        caches.set(person, bundle.reviews);
      }
      const records = caches.get(person);
      if (!Object.hasOwn(records, id)) throw new Error("writing-view-unavailable");
      return { topic, review: records[id] };
    }

    return {
      name: role === "teacher" ? "教师" : name,
      viewing: role,
      students: role === "teacher" ? [...people.keys()] : [],
      topics,
      select
    };
  }

  window.UnlockWritingAccess = { open };
})();
