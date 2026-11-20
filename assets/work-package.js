"use strict";

(function () {
  const { Zip, ZipDeflate, ZipPassThrough, strToU8 } = window.fflate;
  const root = new URL("../", location.href);
  const chunkSize = 256 * 1024;

  async function loadFile(file, signal) {
    try {
      let blob;
      if (file.recordingId) {
        blob = await window.UnlockRecordings.read(file.recordingId);
      } else {
        const url = new URL(file.source, root);
        if (!url.href.startsWith(root.href)) throw new Error("Invalid course file");
        const response = await fetch(url, { signal });
        if (!response.ok || response.headers.get("Content-Type")?.startsWith("text/html")) {
          throw new Error("Course file unavailable");
        }
        blob = await response.blob();
      }
      if (!blob.size || (file.size && blob.size !== file.size)) throw new Error("Incomplete file");
      return blob;
    } catch {
      signal.throwIfAborted();
      throw new Error("无法读取" + file.label + "。请在原作答浏览器中重试。");
    }
  }

  async function archive({ data, files }, onProgress, signal) {
    const chunks = [];
    let zipError = null;
    const zip = new Zip((error, chunk) => {
      if (error) zipError = error;
      else if (chunk.length) chunks.push(chunk);
    });

    for (const [filename, text] of [
      ["作答单.html", window.UnlockReport.render(data)],
      ["作答数据.json", JSON.stringify(data, null, 2)]
    ]) {
      const entry = new ZipDeflate(filename, { level: 6 });
      zip.add(entry);
      entry.push(strToU8(text), true);
    }
    for (let index = 0; index < files.length; index += 4) {
      signal.throwIfAborted();
      onProgress(index, files.length);
      const batch = files.slice(index, index + 4);
      const contents = await Promise.all(batch.map(file => loadFile(file, signal)));
      for (const [position, blob] of contents.entries()) {
        const entry = new ZipPassThrough(batch[position].path);
        zip.add(entry);
        for (let start = 0; start < blob.size; start += chunkSize) {
          signal.throwIfAborted();
          const end = Math.min(start + chunkSize, blob.size);
          const bytes = new Uint8Array(await blob.slice(start, end).arrayBuffer());
          entry.push(bytes, end === blob.size);
        }
      }
    }
    signal.throwIfAborted();
    zip.end();
    if (zipError) throw zipError;
    return new Blob(chunks, { type: "application/zip" });
  }

  function filename(data) {
    const label = (data.worksheet.title + " " + data.student.name + " 作答单")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
    return label + ".zip";
  }

  function downloadControl(className) {
    const ui = window.UnlockStudentUI;
    let current;
    let host;

    function clear() {
      if (current?.url) URL.revokeObjectURL(current.url);
      current?.controller?.abort();
      if (host) host.hidden = true;
      current = null;
      host = null;
    }

    function render() {
      const ready = Boolean(current.url);
      const action = document.createElement(ready ? "a" : "button");
      action.className = className;
      action.dataset.packageDownload = "";
      const chinese = current.error ? "重试下载 ZIP" : "下载作业 ZIP";
      if (ui) {
        action.classList.add("ui-action", "ui-primary");
        ui.setLabel(action, current.error ? "Retry Download" : "Download ZIP", chinese);
      } else action.textContent = chinese;
      if (ready) {
        action.href = current.url;
        action.download = current.filename;
      } else {
        action.type = "button";
        action.disabled = Boolean(current.controller);
        action.addEventListener("click", start);
      }
      const status = document.createElement("span");
      status.className = "package-status";
      status.dataset.packageStatus = "";
      status.setAttribute("role", "status");
      if (ui) ui.setLabel(status, current.error ? "Could not prepare the ZIP. Try again." : current.english,
        current.error || current.message);
      else status.textContent = current.error || current.message || "";
      status.hidden = !status.textContent;
      host.replaceChildren(action, status);
      host.hidden = false;
      return action;
    }

    async function start() {
      const job = current;
      job.controller = new AbortController();
      job.error = "";
      job.message = "正在准备作答单";
      job.english = "Preparing your work";
      render();
      try {
        const plan = job.prepare();
        const blob = await archive(plan, (count, total) => {
          if (current !== job) return;
          job.message = "正在打包附件 " + count + " / " + total;
          job.english = "Packing attachments " + count + " / " + total;
          const status = host.querySelector("[data-package-status]");
          if (ui) ui.setLabel(status, job.english, job.message);
          else status.textContent = job.message;
        }, job.controller.signal);
        if (current !== job) return;
        job.filename = filename(plan.data);
        job.url = URL.createObjectURL(blob);
        job.message = "请完整解压后打开作答单";
        job.english = "Extract the ZIP before opening the answer sheet.";
        render().click();
      } catch (error) {
        if (current !== job) return;
        job.controller = null;
        job.error = error.message || "作答单打包失败，请重试。";
        render();
      }
    }

    function show(container, key, prepare) {
      if (current?.key !== key) {
        clear();
        current = { key, prepare };
      } else if (host === container) {
        return;
      }
      host = container;
      render();
    }

    return { show, clear };
  }

  window.UnlockWorkPackage = { downloadControl };
})();
