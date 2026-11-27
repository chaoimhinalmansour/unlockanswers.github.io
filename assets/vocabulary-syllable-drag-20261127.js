"use strict";

(() => {
  const boards = new WeakMap();
  const controls = "[data-syllable-slot], [data-syllable-option]";

  function retain(syllables, answer) {
    return syllables.parts.map((part, position) =>
      syllables.options[answer?.[position]] === part ? answer[position] : null);
  }

  function restoreOrder(syllables, draft, fixed, last, done) {
    if (done) return syllables.parts.map((_, position) => last?.[position] ?? null);

    const order = fixed.slice();
    const placed = new Set(order);
    for (let position = 0; position < order.length; position++) {
      const tile = draft?.[position];
      if (order[position] !== null || !Number.isInteger(tile) ||
          syllables.options[tile] === undefined || placed.has(tile)) continue;
      order[position] = tile;
      placed.add(tile);
    }

    // A legacy draft can fill the remaining gaps when its earlier correct positions are restored.
    const lastEditable = fixed.lastIndexOf(null);
    if (lastEditable !== -1 && order.every(tile => tile !== null)) order[lastEditable] = null;
    return order;
  }

  function row(className, label, key, count) {
    const group = document.createElement("div");
    group.className = className;
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    const buttons = Array.from({ length: count }, (_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.lang = "en-GB";
      button.dataset[key] = String(index);
      group.append(button);
      return button;
    });
    return { group, buttons };
  }

  function mount(board, syllables) {
    const { parts, options } = syllables;
    const tray = row("vocab-syllable-tray", "按顺序摆放音节", "syllableSlot", parts.length);
    const pool = row("vocab-syllable-pool", "候选音节", "syllableOption", options.length);
    const preview = document.createElement("span");
    preview.className = "vocab-syllable-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.hidden = true;
    const status = document.createElement("p");
    status.className = "vocab-a11y";
    status.setAttribute("role", "status");

    board.classList.add("vocab-syllable-board");
    board.style.setProperty("--syllable-tile-ch", Math.max(...options.map(option => Array.from(option).length)));
    board.replaceChildren(tray.group, pool.group, preview, status);

    let order, enabled, change;
    let pointer, keyboard;
    let highlighted;

    function source(control) {
      if (!control || control.disabled) return null;
      if (control.dataset.syllableOption !== undefined) {
        return { tile: Number(control.dataset.syllableOption), from: null, control };
      }
      const from = Number(control.dataset.syllableSlot);
      return order[from] === null ? null : { tile: order[from], from, control };
    }

    function targetAt(event, piece) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const slot = hit?.closest("[data-syllable-slot]");
      if (slot && tray.group.contains(slot) && !slot.disabled) return slot;
      return piece.from !== null && pool.group.contains(hit) ? pool.group : null;
    }

    function highlight(target) {
      if (highlighted === target) return;
      highlighted?.removeAttribute("data-drop-target");
      highlighted = target;
      highlighted?.setAttribute("data-drop-target", "true");
    }

    function place(piece, target) {
      if (!enabled || !target) return;
      const next = order.slice();
      if (target === pool.group) {
        if (piece.from === null) return;
        next[piece.from] = null;
      } else {
        const position = Number(target.dataset.syllableSlot);
        if (target.disabled || position === piece.from) return;
        if (piece.from !== null) next[piece.from] = next[position];
        next[position] = piece.tile;
      }
      change(next);
    }

    function clearPointer() {
      if (!pointer) return;
      const { id, piece } = pointer;
      pointer = null;
      preview.hidden = true;
      highlight(null);
      piece.control.removeAttribute("data-dragging");
      if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
    }

    function clearKeyboard() {
      if (!keyboard) return;
      keyboard.control.removeAttribute("data-picked-up");
      keyboard = null;
      status.textContent = "";
    }

    board.addEventListener("pointerdown", event => {
      if (!enabled || pointer || event.button !== 0) return;
      const piece = source(event.target.closest(controls));
      if (!piece) return;
      clearKeyboard();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, piece, moved: false };
      board.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    board.addEventListener("pointermove", event => {
      if (pointer?.id !== event.pointerId) return;
      if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
      if (!pointer.moved) {
        pointer.moved = true;
        pointer.piece.control.dataset.dragging = "true";
        preview.textContent = options[pointer.piece.tile];
        preview.hidden = false;
      }
      const rect = board.getBoundingClientRect();
      preview.style.left = (event.clientX - rect.left) + "px";
      preview.style.top = (event.clientY - rect.top) + "px";
      highlight(targetAt(event, pointer.piece));
    });

    board.addEventListener("pointerup", event => {
      if (pointer?.id !== event.pointerId) return;
      const { piece, moved } = pointer;
      const target = moved ? targetAt(event, piece) : null;
      clearPointer();
      place(piece, target);
    });

    for (const type of ["pointercancel", "lostpointercapture"]) {
      board.addEventListener(type, event => {
        if (pointer?.id === event.pointerId) clearPointer();
      });
    }

    board.addEventListener("keydown", event => {
      const control = event.target.closest(controls);
      if (!enabled || pointer || !control || event.repeat) return;
      if (event.key === "Escape" && keyboard) {
        const original = keyboard.control;
        clearKeyboard();
        original.focus();
        event.preventDefault();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") &&
          control.dataset.syllableSlot !== undefined) {
        const piece = source(control);
        if (!piece) return;
        clearKeyboard();
        place(piece, pool.group);
        event.preventDefault();
        return;
      }
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (keyboard && control.dataset.syllableSlot !== undefined) {
        const piece = keyboard;
        clearKeyboard();
        place(piece, control);
        return;
      }
      const piece = source(control);
      if (!piece) return;
      clearKeyboard();
      keyboard = piece;
      control.dataset.pickedUp = "true";
      status.textContent = "已拿起 " + options[piece.tile] + "。移到目标位置，按空格或回车放下。";
      const available = tray.buttons.find((slot, index) => !slot.disabled && order[index] === null);
      (available || tray.buttons.find(slot => !slot.disabled && slot !== control))?.focus();
    });

    return ({ draft, last, done, readonly, onChange }) => {
      clearPointer();
      clearKeyboard();
      const fixed = retain(syllables, last);
      order = restoreOrder(syllables, draft, fixed, last, done);
      enabled = !done && !readonly;
      change = onChange;

      for (const [position, slot] of tray.buttons.entries()) {
        const tile = order[position];
        const filled = tile !== null;
        const correct = fixed[position] !== null;
        const wrong = !correct && last?.[position] != null && (done || !filled);
        const result = correct ? "correct" : wrong ? "wrong" : "";
        const value = filled ? options[tile] : "";
        slot.disabled = !enabled || correct;
        slot.dataset.filled = String(filled);
        slot.dataset.result = result;
        slot.textContent = value;
        slot.setAttribute("aria-label", "第 " + (position + 1) + " 格，" +
          (value || "待放音节") + (correct ? "，位置正确" : wrong ? "，待订正" : ""));
      }

      for (const [index, option] of pool.buttons.entries()) {
        const used = order.includes(index);
        option.disabled = !enabled || used;
        option.dataset.used = String(used);
        option.textContent = options[index];
      }
    };
  }

  function render(board, config) {
    if (!boards.has(board)) boards.set(board, mount(board, config.syllables));
    boards.get(board)(config);
  }

  window.UnlockSyllableDrag = { retain, render };
})();
