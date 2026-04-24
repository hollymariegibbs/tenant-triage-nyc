/*
 * Site-wide review mode — no-op unless ?review is in the URL.
 *
 * When on:
 *   - Injects a fixed banner at the top of every page
 *   - Counts visible <span class="verify-tag"> elements on the current page
 *     (ignoring tags inside .review-banner, .review-panel, or [data-review-ignore])
 *   - Outlines each tag in red and provides a "Next Verify →" button that
 *     scrolls through them in document order
 *   - Renders a navigation list of every page so reviewer can hop through
 *     the site without re-typing ?review
 *   - Exit button drops ?review from the URL and reloads clean
 *
 * Include on every page as <script src="review.js"> or ../review.js.
 * The script self-injects its own styles — no review.css needed.
 */

(function () {
  let params;
  try { params = new URLSearchParams(location.search); } catch (_) { return; }
  if (!params.has('review')) return;

  // Canonical site map. Each link appends ?review so the reviewer can
  // step through without losing the mode. Update when pages are added.
  const PAGES = [
    { name: 'Home',              path: '/' },
    { name: 'Walk-through',      path: '/walkthrough.html' },
    { name: 'Free help',         path: '/free-help.html' },
    { name: 'About',             path: '/about.html' },
    { name: 'Appliances',        path: '/scenarios/appliances.html' },
    { name: 'Eviction',          path: '/scenarios/eviction-notice.html' },
    { name: 'Heat & hot water',  path: '/scenarios/heat-hot-water.html' },
    { name: 'Lead paint',        path: '/scenarios/lead-paint.html' },
    { name: 'Leaks & plumbing',  path: '/scenarios/leaks-plumbing.html' },
    { name: 'Lease non-renewal', path: '/scenarios/lease-non-renewal.html' },
    { name: 'Mold',              path: '/scenarios/mold.html' },
    { name: 'Pests',             path: '/scenarios/pests.html' },
    { name: 'Retaliation',       path: '/scenarios/retaliation.html' }
  ];

  // Inject styles. Scoped to review UI only; never touches page content
  // beyond outlining .verify-tag spans and reserving top padding on body.
  const style = document.createElement('style');
  style.textContent = [
    '.review-banner {',
      'position: fixed; top: 0; left: 0; right: 0; z-index: 9999;',
      'background: #fff9db;',
      'border-bottom: 2px solid #f5c518;',
      'padding: 0.55rem 0.9rem 0.7rem;',
      'font-family: system-ui, -apple-system, "Segoe UI", sans-serif;',
      'font-size: 0.8125rem;',
      'color: #4a3200;',
      'box-shadow: 0 2px 6px rgba(0,0,0,0.08);',
    '}',
    '.review-banner-top {',
      'display: flex; align-items: center; gap: 0.75rem;',
      'flex-wrap: wrap; max-width: 72rem; margin: 0 auto;',
    '}',
    '.review-banner-label {',
      'font-size: 0.7rem; font-weight: 800;',
      'letter-spacing: 0.12em; text-transform: uppercase;',
      'color: #7a4f00; background: #fff2a8;',
      'padding: 0.2rem 0.5rem;',
      'border: 1px solid #e3d68c;',
    '}',
    '.review-banner-count { font-weight: 700; }',
    '.review-banner-count.zero { color: #2e7d32; }',
    '.review-banner-spacer { flex: 1; }',
    '.review-banner-next, .review-banner-exit {',
      'font: inherit; padding: 0.3rem 0.75rem;',
      'background: #7a4f00; color: #fff9db;',
      'border: none; cursor: pointer; font-weight: 700;',
    '}',
    '.review-banner-next:hover { background: #5c3c00; }',
    '.review-banner-exit {',
      'background: transparent; color: #7a4f00;',
      'font-size: 1.25rem; line-height: 1;',
      'padding: 0.2rem 0.55rem; font-weight: 400;',
    '}',
    '.review-banner-exit:hover { background: #fff2a8; }',
    '.review-banner-nav {',
      'max-width: 72rem; margin: 0.4rem auto 0;',
      'font-size: 0.75rem; line-height: 1.7;',
    '}',
    '.review-banner-nav a {',
      'color: #4a3200;',
      'text-decoration: underline;',
      'text-decoration-color: #c9a75e;',
      'text-underline-offset: 2px;',
      'margin-right: 0.2rem;',
      'padding: 0.1rem 0.15rem;',
    '}',
    '.review-banner-nav a:hover { color: #7a4f00; background: #fff2a8; }',
    '.review-banner-nav a.current {',
      'font-weight: 800; text-decoration: none;',
      'background: #fff2a8;',
    '}',
    'body.review-mode-on { padding-top: 5.75rem; }',
    '.verify-tag.in-review {',
      'outline: 2px solid #c8292e;',
      'outline-offset: 2px;',
    '}',
    '.verify-tag.in-review.flash {',
      'animation: review-flash 1.2s ease-out;',
    '}',
    '@keyframes review-flash {',
      '0%, 100% { box-shadow: 0 0 0 0 rgba(200, 41, 46, 0); }',
      '30% { box-shadow: 0 0 0 12px rgba(200, 41, 46, 0.35); }',
    '}',
    '@media print {',
      '.review-banner { display: none !important; }',
      'body.review-mode-on { padding-top: 0 !important; }',
      '.verify-tag.in-review { outline: none !important; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // Collect visible Verify tags, excluding tags inside the banner itself,
  // the walkthrough's inline review-panel, or anything marked ignore.
  const tags = Array.prototype.slice
    .call(document.querySelectorAll('.verify-tag'))
    .filter(function (el) {
      return !el.closest('.review-banner, .review-panel, [data-review-ignore]');
    });

  const count = tags.length;
  const countText = count === 0
    ? 'No Verify tags on this page'
    : count + ' Verify tag' + (count === 1 ? '' : 's') + ' on this page';
  const countClass = count === 0 ? 'review-banner-count zero' : 'review-banner-count';

  // Normalize current pathname to match PAGES entries
  const currentPath = location.pathname.replace(/\/index\.html$/, '/') || '/';

  const navHtml = PAGES.map(function (p) {
    const isCurrent = currentPath === p.path;
    const href = p.path + '?review';
    return '<a href="' + href + '"' + (isCurrent ? ' class="current"' : '') + '>' + p.name + '</a>';
  }).join(' &middot; ');

  const banner = document.createElement('div');
  banner.className = 'review-banner';
  banner.innerHTML =
    '<div class="review-banner-top">' +
      '<span class="review-banner-label">Review mode</span>' +
      '<span class="' + countClass + '">' + countText + '</span>' +
      '<span class="review-banner-spacer"></span>' +
      (count > 0 ? '<button type="button" class="review-banner-next">Next Verify &rarr;</button>' : '') +
      '<button type="button" class="review-banner-exit" aria-label="Exit review mode" title="Exit review mode">&times;</button>' +
    '</div>' +
    '<nav class="review-banner-nav">' + navHtml + '</nav>';

  document.body.prepend(banner);
  document.body.classList.add('review-mode-on');

  tags.forEach(function (tag) { tag.classList.add('in-review'); });

  // Next Verify: cycle through tags in document order
  let cursor = -1;
  const nextBtn = banner.querySelector('.review-banner-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      cursor = (cursor + 1) % tags.length;
      const tag = tags[cursor];
      tag.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tag.classList.add('flash');
      setTimeout(function () { tag.classList.remove('flash'); }, 1200);
    });
  }

  // Exit: drop ?review from the URL and reload clean
  banner.querySelector('.review-banner-exit').addEventListener('click', function () {
    const url = new URL(location.href);
    url.searchParams.delete('review');
    location.href = url.toString();
  });
})();
