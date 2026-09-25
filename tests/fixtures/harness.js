// Test harness: counts clicks on [data-track] elements (works through open
// shadow roots and cross-origin iframes via postMessage to the parent).
(function () {
  window.__clicks = {};
  function record(name) {
    window.__clicks[name] = (window.__clicks[name] || 0) + 1;
    if (window.parent !== window) window.parent.postMessage({ idgacTest: name }, "*");
  }
  document.addEventListener("click", function (e) {
    const hit = e.composedPath().find((n) => n && n.dataset && n.dataset.track);
    if (hit) record(hit.dataset.track);
  }, true);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.idgacTest) record("frame:" + e.data.idgacTest);
  });
})();
