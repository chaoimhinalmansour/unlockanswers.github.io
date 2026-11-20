"use strict";

(function () {
  const database = "unlock.practice.recordings.v1";
  const clipURLs = new Map();
  let connection;

  function isSpeaking(question) {
    return /\/S_(?:H[123]|STP)\//.test(question.id);
  }

  function openDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("当前浏览器无法保存录音。"));
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("clips", { keyPath: "id" });
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = null; };
          resolve(db);
        };
        request.onerror = () => reject(new Error("当前浏览器无法保存录音。"));
        request.onblocked = () => reject(new Error("请关闭其他练习页面后再试。"));
      }).catch(error => {
        connection = null;
        throw error;
      });
    }
    return connection;
  }

  async function store(blob, durationMs) {
    const db = await openDatabase();
    const id = crypto.randomUUID();
    const clip = { id, mime: blob.type, durationMs, size: blob.size };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("clips", "readwrite");
      tx.objectStore("clips").add({ id, blob });
      tx.oncomplete = resolve;
      tx.onabort = () => reject(new Error("录音保存失败。请检查设备空间后重录。"));
    });
    return clip;
  }

  async function read(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction("clips", "readonly").objectStore("clips").get(id);
      request.onsuccess = () => {
        const value = request.result?.blob;
        if (value instanceof Blob && value.size) resolve(value);
        else reject(new Error("这段录音在当前浏览器中无法读取。"));
      };
      request.onerror = () => reject(new Error("录音读取失败。"));
    });
  }

  function url(id) {
    if (!clipURLs.has(id)) {
      clipURLs.set(id, read(id).then(URL.createObjectURL).catch(error => {
        clipURLs.delete(id);
        throw error;
      }));
    }
    return clipURLs.get(id);
  }

  async function dataURL(id) {
    const blob = await read(id);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("生成随作答单携带的录音失败。"));
      reader.readAsDataURL(blob);
    });
  }

  function timeText(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function clipTime(ms) {
    return ms < 1000 ? "不足 1 秒" : timeText(ms);
  }

  function micError(error) {
    if (["NotAllowedError", "SecurityError"].includes(error.name)) {
      return new Error("请在浏览器里允许访问麦克风，再点击开始录音。");
    }
    if (["NotFoundError", "DevicesNotFoundError"].includes(error.name)) {
      return new Error("没有找到麦克风。请连接麦克风后重试。");
    }
    if (["NotReadableError", "AbortError"].includes(error.name)) {
      return new Error("麦克风暂时无法使用。请检查设备或关闭正在使用麦克风的程序。");
    }
    return new Error("当前浏览器暂时无法使用麦克风。");
  }

  function makeRecorder(stream) {
    const choices = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4",
      "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    if (typeof MediaRecorder.isTypeSupported === "function") {
      for (const mimeType of choices.filter(type => MediaRecorder.isTypeSupported(type))) {
        try {
          return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
        } catch {
          continue;
        }
      }
    }
    return new MediaRecorder(stream);
  }

  async function begin() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
      typeof window.MediaRecorder !== "function") {
      throw new Error("请在支持录音的浏览器中打开 HTTPS 页面或本机预览。");
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 } } });
    } catch (error) {
      throw micError(error);
    }
    const release = () => stream.getTracks().forEach(track => track.stop());
    try {
      await openDatabase();
    } catch (error) {
      release();
      throw error;
    }
    try {
      const recorder = makeRecorder(stream);
      const chunks = [];
      let stoppedAt;
      let cancelled = false;
      let startedAt;
      let fail;

      const result = new Promise((resolve, reject) => {
        fail = reject;
        recorder.addEventListener("dataavailable", event => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener("error", () => {
          release();
          reject(new Error("录音中断，请重录。"));
        }, { once: true });
        recorder.addEventListener("stop", async () => {
          release();
          if (cancelled) { resolve(null); return; }
          const durationMs = Math.round((stoppedAt ?? performance.now()) - startedAt);
          const mime = (recorder.mimeType || chunks[0]?.type || "").split(";")[0].toLowerCase();
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size || !mime.startsWith("audio/") || durationMs < 250) {
            reject(new Error("没录到有效音频，请重录。"));
            return;
          }
          try {
            resolve(await store(blob, durationMs));
          } catch (error) {
            reject(error);
          }
        }, { once: true });
      });

      try {
        recorder.start();
        startedAt = performance.now();
      } catch {
        release();
        fail(new Error("设备无法开始录音。请重新打开练习后再试。"));
      }

      return {
        startedAt,
        result,
        stop() {
          if (recorder.state !== "inactive") {
            stoppedAt = performance.now();
            recorder.stop();
          }
        },
        cancel() {
          cancelled = true;
          if (recorder.state !== "inactive") recorder.stop();
          release();
        }
      };
    } catch {
      release();
      throw new Error("当前浏览器无法启动录音。");
    }
  }

  window.UnlockRecordings = { isSpeaking, begin, timeText, clipTime, url, dataURL, read };
})();
