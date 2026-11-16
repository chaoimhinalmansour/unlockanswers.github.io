"use strict";

(function () {
  const key = "unlock-writing-review-v1";
  const expected = "1f81fc017f9006f147330dd5e9072b98074791e9e759d3fbddfc16cab073950d";
  const form = document.getElementById("writing-password-form");
  const input = document.getElementById("writing-password");
  const submit = form.querySelector("button");
  const notice = document.getElementById("writing-entry-message");
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
    notice.textContent = "正在打开写作复盘。";
    try {
      if (!window.studentPlatformSamples) await loadScript("writing-samples.js?v=assessment-3");
      await loadScript("writing-review.js?v=assessment-3");
      document.getElementById("writing-entry").hidden = true;
      document.getElementById("writing-review-content").hidden = false;
      notice.textContent = "";
      try { sessionStorage.setItem(key, "1"); } catch {}
      window.dispatchEvent(new Event("resize"));
      document.getElementById("writing-review-title").focus();
    } catch {
      notice.textContent = "复盘内容暂时打不开，请重试。";
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
      const bytes = new TextEncoder().encode(input.value.trim());
      const value = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== expected) {
        notice.textContent = "密码不正确，请重新输入。";
        input.select();
        return;
      }
      input.value = "";
      await openReview();
    } catch {
      notice.textContent = "请通过网站或本机预览地址打开后重试。";
    } finally {
      if (!opening) submit.disabled = false;
    }
  });

  try { if (sessionStorage.getItem(key) === "1") openReview(); } catch {}
})();
