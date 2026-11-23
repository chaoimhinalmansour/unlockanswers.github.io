import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";

const fromHere = path => new URL(path, import.meta.url);
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const preview = process.argv.includes("--preview");
const port = Number(process.env.UNLOCK_WRITING_PORT || 8796);
const localOrigin = "http://127.0.0.1:" + port;
const publicUrl = new URL(preview ? localOrigin : process.env.UNLOCK_WRITING_ORIGIN);
if (!preview && (publicUrl.protocol !== "https:" || publicUrl.pathname !== "/")) {
  throw new Error("UNLOCK_WRITING_ORIGIN must be the HTTPS origin of the private service.");
}
const workspace = new URL(
  process.env.UNLOCK_WRITING_WORKSPACE || "https://chaoimhinalmansour.github.io/unlockanswers.github.io/"
);
if (workspace.protocol !== "https:") throw new Error("Invalid workspace URL.");

const { topics, reviews, students } = await readJson(fromHere("./private/reviews.json"));
const roster = students ?? Object.keys(reviews[topics[0]?.id] || {});
const validName = name => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name) &&
  name.toLowerCase() !== "teacher";
if (!Array.isArray(roster) || !roster.length || !roster.every(validName) ||
    new Set(roster.map(name => name.toLowerCase())).size !== roster.length) {
  throw new Error("The private review bundle must contain distinct student account names.");
}
const identities = new Map([
  ["teacher", { role: "teacher", name: "教师" }],
  ...roster.map(name => [name.toLowerCase(), { role: "student", name }])
]);
const accounts = preview ? {} : await readJson(process.env.UNLOCK_WRITING_ACCOUNT_FILE);
for (const account of preview ? [] : identities.keys()) {
  const profile = accounts[account];
  if (!profile || !/^[a-f0-9]{32}$/i.test(profile.salt) || !/^[a-f0-9]{128}$/i.test(profile.hash)) {
    throw new Error("The private credentials for all writing accounts must contain scrypt salts and hashes.");
  }
}
const byTopic = new Map(topics.map(topic => [topic.id, topic]));
const catalog = topics.map(({ id, date, task, en, title }) => ({ id, date, task, en, title }));
const cookieName = preview ? "unlock-writing-preview" : "__Host-unlock-writing";
const duration = 8 * 60 * 60;
const windowMs = 15 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const previewKey = preview ? randomBytes(18).toString("base64url") : null;
const derive = promisify(scrypt);
const api = "/api/writing-review";
const assets = new Map([
  ["/writing-review.html", "text/html; charset=utf-8"],
  ["/writing-review.css", "text/css; charset=utf-8"],
  ["/writing-review-cases.css", "text/css; charset=utf-8"],
  ["/writing-review.js", "text/javascript; charset=utf-8"],
  ["/assets/theme.css", "text/css; charset=utf-8"],
  ["/assets/student-ui.css", "text/css; charset=utf-8"],
  ["/assets/student-ui.js", "text/javascript; charset=utf-8"],
  ["/assets/fonts/SourceHanSansSC-Regular.ttf", "font/ttf"],
  ["/assets/fonts/SourceHanSansSC-Bold.ttf", "font/ttf"],
  ["/assets/fonts/LICENSE.txt", "text/plain; charset=utf-8"]
]);
const policy = "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'";

function reply(res, status, body, type = "application/json; charset=utf-8", options = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": type,
    "Content-Security-Policy": policy,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...options
  });
  res.end(type.startsWith("application/json") && body !== undefined ? JSON.stringify(body) : body);
}
const deny = (res, status) => reply(res, status, { error: status });

function cookie(req) {
  const pair = (req.headers.cookie || "").split(";").map(v => v.trim())
    .find(value => value.startsWith(cookieName + "="));
  return pair?.slice(cookieName.length + 1);
}
const sessionHeader = (token, maxAge) =>
  cookieName + "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge +
  (preview ? "" : "; Secure");

function session(req) {
  const token = cookie(req);
  const active = sessions.get(token);
  if (!active || active.expires <= Date.now()) {
    if (active) sessions.delete(token);
    return null;
  }
  return active;
}

function openSession(req, identity) {
  const now = Date.now();
  for (const [token, old] of sessions) {
    if (old.expires <= now) sessions.delete(token);
  }
  sessions.delete(cookie(req));
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, { ...identity, expires: now + duration * 1000 });
  return sessionHeader(token, duration);
}

function publicSession(active) {
  return {
    role: active.role, name: active.name, topics: catalog,
    ...(active.role === "teacher" ? { students: roster } : {})
  };
}

async function bodyJson(req) {
  let content = "";
  for await (const chunk of req) {
    content += chunk.toString("utf8");
    if (content.length > 8192) return null;
  }
  try { return JSON.parse(content); } catch { return null; }
}

async function signIn(req, res) {
  if (preview) return deny(res, 401);
  const payload = await bodyJson(req);
  if (typeof payload?.account !== "string" || typeof payload.password !== "string" ||
      payload.password.length > 512 || !payload.password) return deny(res, 400);
  const account = payload.account.trim().toLowerCase();
  const identity = identities.get(account);
  const throttleKey = identity ? account : "unrecognized";
  const now = Date.now();
  const last = attempts.get(throttleKey);
  const counter = last && now - last.start < windowMs ? last : { start: now, count: 0 };
  if (counter.count >= 12) return deny(res, 429);
  counter.count++;
  attempts.set(throttleKey, counter);
  const profile = identity ? accounts[account] : accounts.teacher;
  const actual = await derive(payload.password, Buffer.from(profile.salt, "hex"), 64);
  if (!identity || !timingSafeEqual(actual, Buffer.from(profile.hash, "hex"))) return deny(res, 401);
  attempts.delete(throttleKey);
  return reply(res, 200, publicSession(identity), undefined, { "Set-Cookie": openSession(req, identity) });
}

function redirect(res, destination, cookieHeader) {
  return reply(res, 303, undefined, "text/plain; charset=utf-8", {
    Location: destination,
    ...(cookieHeader ? { "Set-Cookie": cookieHeader } : {})
  });
}

async function handle(req, res) {
  if (req.headers.host !== publicUrl.host) return deny(res, 421);
  const url = new URL(req.url, publicUrl);
  const path = url.pathname;
  const get = req.method === "GET";
  if (get && path === "/") return redirect(res, "/writing-review.html");
  if (get && path === "/index.html") return redirect(res, workspace.href);
  if (get && preview && path.startsWith("/preview/" + previewKey + "/")) {
    const identity = identities.get(path.split("/").at(-1));
    if (identity) return redirect(res, "/writing-review.html", openSession(req, identity));
  }
  if (get && assets.has(path)) {
    const type = assets.get(path);
    return reply(res, 200, await readFile(fromHere("./site" + path)), type, {
      "Cache-Control": path.startsWith("/assets/fonts/") ? "private, max-age=3600" : "no-store"
    });
  }
  if (!path.startsWith(api + "/")) return deny(res, 404);

  if (req.method === "POST" && req.headers.origin !== publicUrl.origin) return deny(res, 403);
  if (path === api + "/session" && req.method === "POST") return signIn(req, res);
  if (path === api + "/sign-out" && req.method === "POST") {
    sessions.delete(cookie(req));
    return reply(res, 204, undefined, undefined, { "Set-Cookie": sessionHeader("", 0) });
  }

  const active = session(req);
  if (!active) return deny(res, 401);
  if (!get) return deny(res, 405);
  if (path === api + "/session") return reply(res, 200, publicSession(active));
  if (path === api + "/topic") {
    const topic = byTopic.get(url.searchParams.get("id"));
    if (!topic) return deny(res, 404);
    const requested = url.searchParams.get("student");
    if (active.role === "student" && requested !== null && requested !== active.name) return deny(res, 403);
    const student = active.role === "teacher" ? requested : active.name;
    if (!roster.includes(student)) return deny(res, 404);
    const review = reviews[topic.id][student];
    return reply(res, 200, { topic, student, review });
  }
  const figure = path.match(/^\/api\/writing-review\/figure\/([a-z-]+)\/(\d+)\.(png|svg)$/);
  if (figure) {
    const [, id, number, ext] = figure;
    if (!byTopic.get(id)?.figures.some(item => item.number === Number(number))) return deny(res, 404);
    const type = ext === "png" ? "image/png" : "image/svg+xml";
    return reply(res, 200, await readFile(fromHere("./private/figures/" + id + "/" + number + "." + ext)), type);
  }
  return deny(res, 404);
}

const server = createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error("Writing review request failed: " + (error.code || error.name));
    if (!res.headersSent) deny(res, 500);
    else res.end();
  });
});
server.listen(port, "127.0.0.1", () => {
  console.log("Writing Review: " + publicUrl.origin + "/writing-review.html");
  if (preview) {
    for (const [key, identity] of identities) {
      console.log(identity.name + ": " + localOrigin + "/preview/" + previewKey + "/" + key);
    }
  }
});
