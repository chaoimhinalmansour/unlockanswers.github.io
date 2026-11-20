"use strict";

(function () {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

  function place(node, source) {
    if (preference.matches || !node?.animate || !source?.width) return;
    const target = node.getBoundingClientRect();
    const x = source.left + source.width / 2 - target.left - target.width / 2;
    const y = source.top + source.height / 2 - target.top - target.height / 2;
    node.animate([
      { transform: "translate(" + x + "px, " + y + "px) scale(.97)", opacity: .78 },
      { transform: "translate(0, 1px) scale(1.025)", offset: .82 },
      { transform: "translate(0, 0) scale(1)", opacity: 1 }
    ], { duration: 250, easing: "cubic-bezier(.18,.72,.23,1)" });
  }

  window.UnlockMotion = { place };
})();
