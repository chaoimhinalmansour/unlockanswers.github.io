"use strict";

(function () {
  const session = window.UnlockSession;
  const { setLabel } = window.UnlockStudentUI;
  const active = session.requireSession();
  if (!active) return;
  const student = session.student(active);
  if (active.role === "student" && !student) {
    session.signOut("student", location.href);
    return;
  }
  const key = "unlock-writing-review-v1";
  const expected = "1f81fc017f9006f147330dd5e9072b98074791e9e759d3fbddfc16cab073950d";
  const form = document.getElementById("writing-password-form");
  const input = document.getElementById("writing-password");
  const submit = form.querySelector("button");
  const notice = document.getElementById("writing-entry-message");
  const entry = document.getElementById("writing-entry");
  document.getElementById("review-account-name").textContent = student?.name || "教师";
  document.getElementById("review-account").hidden = false;
  document.getElementById("review-sign-out").addEventListener("click", () => session.signOut());
  let opening = false;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function openReview() {
    opening = true;
    submit.disabled = true;
    setLabel(notice, "Opening Writing Review", "正在打开写作复盘。");
    try {
      if (!window.studentPlatformSamples) await loadScript("writing-samples.js?v=assessment-3");
      if (!window.UnlockWritingEnglish) await loadScript("writing-review-en.js?v=20261120-student-ui");
      await loadScript("writing-review.js?v=20261120-student-ui");
      if (session.current()?.id !== active.id) return;
      entry.hidden = true;
      document.getElementById("writing-review-content").hidden = false;
      notice.textContent = "";
      try { sessionStorage.setItem(key, active.id); } catch {}
      window.dispatchEvent(new Event("resize"));
      document.getElementById("writing-review-title").focus();
    } catch {
      entry.hidden = false;
      setLabel(notice, "Writing Review could not open. Try again.", "复盘内容暂时打不开，请重试。");
      opening = false;
      submit.disabled = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (opening || submit.disabled) return;
    submit.disabled = true;
    notice.textContent = "";
    try {
      if (!await session.matchesPassword(input.value, expected)) {
        setLabel(notice, "Incorrect password. Try again.", "密码不正确，请重新输入。");
        input.select();
        return;
      }
      input.value = "";
      await openReview();
    } catch {
      setLabel(notice, "Open the website or local preview and try again.", "请通过网站或本机预览地址打开后重试。");
    } finally {
      if (!opening) submit.disabled = false;
    }
  });

  let allowed = false;
  try { allowed = sessionStorage.getItem(key) === active.id; } catch {}
  if (allowed) openReview();
  else entry.hidden = false;
})();
