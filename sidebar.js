/*
 * Scroll-spy for .toc-sidebar containing [data-toc-target] links.
 * Highlights the link for whichever target element is currently
 * in the upper part of the viewport, via the "active" class.
 *
 * How to wire it up:
 *   - Include sidebar.css + this script
 *   - Structure: <aside class="toc-sidebar"><nav><a data-toc-target="id"></a></nav></aside>
 *   - Each target in the article needs a matching id
 *
 * Multiple .toc-sidebar elements on a page are supported; each is
 * handled independently.
 */

(function () {
  var sidebars = document.querySelectorAll('.toc-sidebar');
  if (!sidebars.length) return;

  sidebars.forEach(function (sidebar) {
    var links = sidebar.querySelectorAll('a[data-toc-target]');
    if (!links.length) return;

    var linkById = {};
    links.forEach(function (a) {
      linkById[a.getAttribute('data-toc-target')] = a;
    });

    var targets = [];
    Object.keys(linkById).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) targets.push(el);
    });
    if (!targets.length) return;

    function clearActive() {
      links.forEach(function (a) { a.classList.remove('active'); });
    }

    var activeId = null;

    var observer = new IntersectionObserver(function () {
      // Of all currently-visible targets, pick the last one whose top
      // has passed ~30% of the viewport height. That feels like
      // "what you're reading right now" rather than what's about to
      // scroll in or out.
      var visible = targets
        .map(function (t) {
          var rect = t.getBoundingClientRect();
          return { id: t.id, top: rect.top, bottom: rect.bottom };
        })
        .filter(function (r) { return r.bottom > 0 && r.top < window.innerHeight; });

      if (!visible.length) return;

      var activeZone = window.innerHeight * 0.3;
      var candidates = visible.filter(function (r) { return r.top <= activeZone; });
      var pick = (candidates.length ? candidates[candidates.length - 1] : visible[0]);

      if (pick.id !== activeId) {
        activeId = pick.id;
        clearActive();
        var link = linkById[activeId];
        if (link) link.classList.add('active');
      }
    }, {
      rootMargin: '0px 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    targets.forEach(function (t) { observer.observe(t); });
  });
})();
