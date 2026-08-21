// ============================================
// ADDRESS LOOKUP + HPD VIOLATIONS COMPONENT
// Shared across all scenario pages.
//
// The address search, the Socrata request, and every bit of translation out
// of HPD's code-speak live in @howellandgibbs/hpd-lookup, which was extracted
// from this file and then audited against the live dataset. What is left here
// is only the Tenant Triage interface on top of it: rendering, the scenario
// keyword filter, and the "your case" pins.
//
// The package is vendored as a single ESM bundle rather than installed, so the
// site keeps its no-build-step, no-runtime-dependency setup.
// See scripts/update-hpd-lookup.sh to refresh it.
//
// Usage:
//   1. Include the lookup HTML block (see scenario pages)
//   2. Include lookup.css styles
//   3. <script type="module" src="../lookup.js"></script>
//   4. Call: initLookup({ filterKeywords: ['mold', 'mildew', ...] })
//      from a <script type="module"> so it runs after this module loads.
// ============================================

import {
  searchAddresses,
  lookupByBBL,
  toSentenceCase,
  isHpdLookupError,
} from './vendor/hpd-lookup-1.0.0.js';

// Configuration
// Socrata works unauthenticated; an app token only raises the rate limit.
const SOCRATA_APP_TOKEN = null;
const MAX_SUGGESTIONS = 5;
const INITIAL_VIOLATIONS_DISPLAY = 10;
const VIOLATIONS_PER_PAGE = 20;
const SOCRATA_FETCH_LIMIT = 1000;
const DEBOUNCE_MS = 250;

// State
let lookupHighlightedIndex = -1;
let lookupCurrentSuggestions = [];
let lookupDebounceTimer = null;
let allViolations = [];
let filteredViolations = [];
let displayedCount = 0;
let filterKeywords = [];
let filterActive = true;
let currentBuilding = null;

// DOM references (set in init)
let lookupInput, lookupSuggestionsBox, lookupStatusEl, lookupResultsEl, lookupFallbackEl, lookupAnnounceEl;

// ============================================
// INIT
// ============================================
function initLookup(options) {
  filterKeywords = (options && options.filterKeywords) || [];

  lookupInput = document.getElementById('lookup-input');
  lookupSuggestionsBox = document.getElementById('lookup-suggestions');
  lookupStatusEl = document.getElementById('lookup-status');
  lookupResultsEl = document.getElementById('lookup-results');
  lookupFallbackEl = document.getElementById('lookup-fallback');

  if (!lookupInput) return;

  // Combobox semantics — announced by screen readers as an autocomplete
  lookupInput.setAttribute('role', 'combobox');
  lookupInput.setAttribute('aria-autocomplete', 'list');
  lookupInput.setAttribute('aria-expanded', 'false');
  lookupInput.setAttribute('aria-controls', 'lookup-suggestions');
  if (!lookupInput.getAttribute('aria-label')) {
    lookupInput.setAttribute('aria-label', 'Your NYC address');
  }
  lookupSuggestionsBox.setAttribute('role', 'listbox');
  lookupSuggestionsBox.setAttribute('aria-label', 'Address suggestions');
  lookupStatusEl.setAttribute('role', 'status');
  lookupStatusEl.setAttribute('aria-live', 'polite');

  // Visually-hidden live region for announcements that have no visible
  // status counterpart (suggestion counts, result counts)
  lookupAnnounceEl = document.createElement('div');
  lookupAnnounceEl.setAttribute('role', 'status');
  lookupAnnounceEl.setAttribute('aria-live', 'polite');
  lookupAnnounceEl.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
  lookupInput.closest('.lookup-input-wrap').appendChild(lookupAnnounceEl);

  lookupInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    lookupResultsEl.classList.remove('visible');
    lookupStatusEl.textContent = '';
    lookupStatusEl.classList.remove('error');
    lookupFallbackEl.style.display = 'none';

    if (query.length < 3) {
      closeLookupSuggestions();
      return;
    }

    clearTimeout(lookupDebounceTimer);
    lookupDebounceTimer = setTimeout(function() {
      searchAddresses(query, {
        maxSuggestions: MAX_SUGGESTIONS,
        appToken: SOCRATA_APP_TOKEN || undefined,
      })
        .then(renderLookupSuggestions)
        .catch(function() {
          closeLookupSuggestions();
          lookupStatusEl.textContent = 'Address lookup service is temporarily unavailable.';
          lookupStatusEl.classList.add('error');
          lookupFallbackEl.style.display = 'block';
        });
    }, DEBOUNCE_MS);
  });

  lookupInput.addEventListener('keydown', function(e) {
    const items = lookupSuggestionsBox.querySelectorAll('.lookup-suggestion');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = Math.min(lookupHighlightedIndex + 1, items.length - 1);
      setLookupHighlight(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = Math.max(lookupHighlightedIndex - 1, 0);
      setLookupHighlight(prev);
    } else if (e.key === 'Enter') {
      if (lookupHighlightedIndex >= 0) {
        e.preventDefault();
        selectLookupSuggestion(lookupHighlightedIndex);
      }
    } else if (e.key === 'Escape') {
      closeLookupSuggestions();
    }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.lookup-input-wrap')) {
      closeLookupSuggestions();
    }
  });
}

// ============================================
// SUGGESTIONS
// ============================================
function announceLookup(message) {
  if (lookupAnnounceEl) lookupAnnounceEl.textContent = message;
}

function closeLookupSuggestions() {
  lookupSuggestionsBox.classList.remove('visible');
  lookupInput.setAttribute('aria-expanded', 'false');
  lookupInput.removeAttribute('aria-activedescendant');
}

function renderLookupSuggestions(buildings) {
  lookupSuggestionsBox.innerHTML = '';
  lookupCurrentSuggestions = [];
  lookupHighlightedIndex = -1;
  lookupInput.removeAttribute('aria-activedescendant');

  if (!buildings || buildings.length === 0) {
    closeLookupSuggestions();
    announceLookup('No matching addresses found.');
    return;
  }

  // searchAddresses already drops candidates with no BBL, which are the ones
  // nothing downstream could have used anyway.
  buildings.forEach(function(building) {
    const label = building.label || 'Unknown address';
    const borough = building.borough || '';

    lookupCurrentSuggestions.push(building);

    const el = document.createElement('div');
    el.className = 'lookup-suggestion';
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.id = 'lookup-option-' + (lookupCurrentSuggestions.length - 1);
    el.dataset.index = lookupCurrentSuggestions.length - 1;
    el.innerHTML =
      '<span class="lookup-suggestion-address">' + escapeHTMLLookup(label) + '</span>' +
      (borough ? '<span class="lookup-suggestion-borough">' + escapeHTMLLookup(borough) + '</span>' : '');

    el.addEventListener('click', function() {
      selectLookupSuggestion(parseInt(el.dataset.index));
    });
    el.addEventListener('mouseenter', function() {
      setLookupHighlight(parseInt(el.dataset.index));
    });

    lookupSuggestionsBox.appendChild(el);
  });

  if (lookupCurrentSuggestions.length > 0) {
    lookupSuggestionsBox.classList.add('visible');
    lookupInput.setAttribute('aria-expanded', 'true');
    announceLookup(lookupCurrentSuggestions.length + ' address suggestion' +
      (lookupCurrentSuggestions.length === 1 ? '' : 's') +
      '. Use up and down arrow keys to review, Enter to select.');
  } else {
    closeLookupSuggestions();
  }
}

function setLookupHighlight(index) {
  var items = lookupSuggestionsBox.querySelectorAll('.lookup-suggestion');
  items.forEach(function(item, i) {
    item.classList.toggle('highlighted', i === index);
    item.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });
  lookupHighlightedIndex = index;
  if (index >= 0 && items[index]) {
    lookupInput.setAttribute('aria-activedescendant', items[index].id);
  } else {
    lookupInput.removeAttribute('aria-activedescendant');
  }
}

function selectLookupSuggestion(index) {
  if (index < 0 || index >= lookupCurrentSuggestions.length) return;
  var selected = lookupCurrentSuggestions[index];
  lookupInput.value = selected.label;
  closeLookupSuggestions();
  fetchViolations(selected);
}

// ============================================
// VIOLATIONS
// ============================================
async function fetchViolations(building) {
  lookupStatusEl.textContent = 'Looking up violations\u2026';
  lookupStatusEl.classList.remove('error');
  lookupResultsEl.classList.remove('visible');
  lookupFallbackEl.style.display = 'none';

  try {
    // Comes back parsed and newest-inspection-first: citation stripped,
    // status translated, class severity resolved.
    var result = await lookupByBBL(building.bbl, {
      limit: SOCRATA_FETCH_LIMIT,
      appToken: SOCRATA_APP_TOKEN || undefined,
    });
    renderViolations(building, result.violations);
  } catch (err) {
    lookupStatusEl.textContent = violationErrorMessage(err);
    lookupStatusEl.classList.add('error');
    lookupFallbackEl.style.display = 'block';
  }
}

// Every failure the package raises carries a `code`, so a bad BBL can say
// something more useful than a generic outage message.
function violationErrorMessage(err) {
  if (isHpdLookupError(err) && err.code === 'invalid_input') {
    return 'We could not identify that building. Try picking an address from the suggestions.';
  }
  return 'Could not fetch violations from HPD data. The HPD data service may be temporarily unavailable.';
}

function applyFilter(violations) {
  if (!filterActive || filterKeywords.length === 0) return violations;
  return violations.filter(function(v) {
    // Match the raw HPD text, not the parsed description: the parser strips
    // the citation, and a keyword could legitimately sit anywhere in either.
    var raw = v.raw || {};
    var desc = ((raw.novdescription || '') + ' ' + (raw.novtype || '')).toLowerCase();
    return filterKeywords.some(function(kw) { return desc.indexOf(kw) !== -1; });
  });
}

function renderViolations(building, violations) {
  lookupStatusEl.textContent = '';
  currentBuilding = building;
  allViolations = violations;
  filterActive = filterKeywords.length > 0;
  filteredViolations = applyFilter(violations);
  displayedCount = 0;

  lookupResultsEl.innerHTML = '';

  // Header
  var header = document.createElement('div');
  header.className = 'lookup-results-header';

  var addressLabel = document.createElement('div');
  addressLabel.className = 'lookup-results-address';
  addressLabel.textContent = 'Results for';

  var buildingLabel = document.createElement('div');
  buildingLabel.className = 'lookup-results-building';
  buildingLabel.textContent = toSentenceCase(building.label);

  var summary = document.createElement('div');
  summary.className = 'lookup-results-summary';
  summary.id = 'lookup-summary';

  header.appendChild(addressLabel);
  header.appendChild(buildingLabel);
  header.appendChild(summary);
  lookupResultsEl.appendChild(header);

  // Filter toggle (only if we have filter keywords)
  if (filterKeywords.length > 0) {
    var filterToggle = document.createElement('div');
    filterToggle.className = 'lookup-filter-toggle';
    filterToggle.id = 'lookup-filter-toggle';
    lookupResultsEl.appendChild(filterToggle);
  }

  // Violation list
  var list = document.createElement('ul');
  list.className = 'lookup-violation-list';
  list.id = 'violation-list';
  lookupResultsEl.appendChild(list);

  // Footer
  var footer = document.createElement('div');
  footer.className = 'lookup-results-footer';
  footer.id = 'lookup-results-footer';
  lookupResultsEl.appendChild(footer);

  updateViolationDisplay();
  lookupResultsEl.classList.add('visible');
}

function updateViolationDisplay() {
  var active = applyFilter(allViolations);
  filteredViolations = active;
  displayedCount = 0;

  // Update summary
  var summary = document.getElementById('lookup-summary');
  if (summary) {
    if (allViolations.length === 0) {
      summary.textContent = 'Good news \u2014 no violations on record for this building.';
      summary.className = 'lookup-results-summary none';
    } else {
      var openCount = 0;
      active.forEach(function(v) {
        if (v.status.state === 'open') openCount++;
      });

      if (filterActive && filterKeywords.length > 0) {
        summary.textContent = active.length + ' matching violation' + (active.length === 1 ? '' : 's') +
          ' (of ' + allViolations.length + ' total)' +
          (openCount > 0 ? ', ' + openCount + ' currently open.' : ', none currently open.');
        summary.className = 'lookup-results-summary ' + (openCount > 0 ? 'some' : 'none');
      } else {
        if (openCount > 0) {
          summary.textContent = openCount + ' open violation' + (openCount === 1 ? '' : 's') +
            ' on this building (plus ' + (active.length - openCount) + ' resolved or dismissed).';
          summary.className = 'lookup-results-summary some';
        } else {
          summary.textContent = active.length + ' past violation' + (active.length === 1 ? '' : 's') +
            ', all currently resolved or dismissed.';
          summary.className = 'lookup-results-summary none';
        }
      }
    }
    var buildingLabel = currentBuilding && currentBuilding.label ? toSentenceCase(currentBuilding.label) : 'this building';
    announceLookup('Results loaded for ' + buildingLabel + '. ' + summary.textContent);
  }

  // Update filter toggle
  var toggleEl = document.getElementById('lookup-filter-toggle');
  if (toggleEl && filterKeywords.length > 0) {
    toggleEl.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lookup-filter-btn' + (filterActive ? ' active' : '');
    btn.innerHTML = filterActive
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Show all violations, not just related ones'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Show related violations only';
    btn.addEventListener('click', function() {
      filterActive = !filterActive;
      updateViolationDisplay();
    });
    toggleEl.appendChild(btn);

    if (filterActive && active.length === 0 && allViolations.length > 0) {
      var hint = document.createElement('p');
      hint.className = 'lookup-filter-hint';
      hint.textContent = 'No matching violations found. Try viewing all violations to see the full building history.';
      toggleEl.appendChild(hint);
    }
  }

  // Re-render violation list
  var list = document.getElementById('violation-list');
  if (list) {
    list.innerHTML = '';
    if (active.length > 0) {
      appendViolations(INITIAL_VIOLATIONS_DISPLAY);
    }
  }

  renderLookupFooter();
}

function appendViolations(count) {
  var list = document.getElementById('violation-list');
  if (!list) return;
  var active = filteredViolations;
  var end = Math.min(displayedCount + count, active.length);
  for (var i = displayedCount; i < end; i++) {
    list.appendChild(buildViolationCard(active[i]));
  }
  displayedCount = end;
  renderLookupFooter();
}

function buildViolationCard(v) {
  var li = document.createElement('li');
  li.className = 'lookup-violation';

  var statusInfo = v.status;
  li.classList.add('state-' + statusInfo.state);

  // Top row
  var top = document.createElement('div');
  top.className = 'lookup-violation-top';

  var statePill = document.createElement('span');
  statePill.className = 'lookup-state-pill state-' + statusInfo.state;
  statePill.innerHTML = '<span class="state-dot" aria-hidden="true"></span>' + escapeHTMLLookup(statusInfo.label);
  top.appendChild(statePill);

  var violationClass = v.class || '';
  var classDescriptor = v.severity || '';

  if (violationClass) {
    var classPill = document.createElement('span');
    classPill.className = 'lookup-class-pill';
    classPill.innerHTML =
      '<span class="class-letter">Class ' + escapeHTMLLookup(violationClass) + '</span>' +
      (classDescriptor ? '<span class="class-descriptor">: ' + escapeHTMLLookup(classDescriptor) + '</span>' : '');
    top.appendChild(classPill);
  }

  var date = document.createElement('span');
  date.className = 'lookup-violation-date';
  date.textContent = v.inspectionDate ? formatDateLookup(v.inspectionDate) : '';
  top.appendChild(date);

  li.appendChild(top);

  var descEl = document.createElement('div');
  descEl.className = 'lookup-violation-desc';
  descEl.textContent = v.description;
  li.appendChild(descEl);

  if (v.location) {
    var locEl = document.createElement('div');
    locEl.className = 'lookup-violation-location';
    locEl.textContent = v.location;
    li.appendChild(locEl);
  }

  // Bottom row: ID + Pin button
  if (v.id) {
    var bottom = document.createElement('div');
    bottom.className = 'lookup-violation-bottom';

    var idLabel = document.createElement('span');
    idLabel.className = 'lookup-violation-id';
    idLabel.innerHTML = '<span class="id-label">ID</span> <span class="id-value">' + escapeHTMLLookup(v.id) + '</span>';
    bottom.appendChild(idLabel);

    var pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'lookup-pin-btn' + (isPinned(v.id) ? ' is-pinned' : '');
    pinBtn.setAttribute('data-violation-id', v.id);
    pinBtn.setAttribute('aria-pressed', isPinned(v.id) ? 'true' : 'false');
    var iconHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-1.4a4 4 0 0 1-1.17-2.83V8a4.5 4.5 0 0 0-9 0v4.77a4 4 0 0 1-1.17 2.83L5 17z"/></svg>';
    pinBtn.innerHTML = iconHTML + '<span class="pin-btn-text">' + (isPinned(v.id) ? 'Pinned' : 'Pin to your case') + '</span>';
    pinBtn.addEventListener('click', function() {
      if (isPinned(v.id)) {
        unpinViolation(v.id);
      } else {
        pinViolation(v, currentBuilding);
      }
    });
    bottom.appendChild(pinBtn);

    li.appendChild(bottom);
  }

  return li;
}

// Build a JustFix Who Owns What deep link for the selected building.
// Uses WOW's BBL-based route, which avoids the address-normalization
// mismatches we'd hit with the /address/<boro>/<housenumber>/<street>
// route (e.g. GeoSearch's "BAY STREET LANDING" not matching WOW's
// internal data). Returns null if we have no BBL to link to.
function buildWhoOwnsWhatUrl(building) {
  if (!building || !building.bbl) return null;
  return 'https://whoownswhat.justfix.org/en/bbl/' + encodeURIComponent(building.bbl);
}

function renderLookupFooter() {
  var footer = document.getElementById('lookup-results-footer');
  if (!footer) return;
  footer.innerHTML = '';

  var remaining = filteredViolations.length - displayedCount;

  if (remaining > 0) {
    var moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'lookup-show-more';
    var nextBatch = Math.min(VIOLATIONS_PER_PAGE, remaining);
    moreBtn.textContent = 'Show ' + nextBatch + ' more (' + remaining + ' remaining)';
    moreBtn.addEventListener('click', function() {
      appendViolations(VIOLATIONS_PER_PAGE);
    });
    footer.appendChild(moreBtn);
  }

  var hpdLink = document.createElement('div');
  hpdLink.className = 'lookup-hpd-link';
  hpdLink.innerHTML = 'Or view the full history on <a href="https://hpdonline.nyc.gov/hpdonline/" target="_blank" rel="noopener">HPDOnline</a>.';
  footer.appendChild(hpdLink);

  var wowUrl = buildWhoOwnsWhatUrl(currentBuilding);
  if (wowUrl) {
    var wowLink = document.createElement('div');
    wowLink.className = 'lookup-hpd-link';
    wowLink.innerHTML = 'See who owns this building on <a href="' +
      escapeHTMLLookup(wowUrl) +
      '" target="_blank" rel="noopener noreferrer">Who Owns What</a>.';
    footer.appendChild(wowLink);
  }
}

// ============================================
// SMALL HELPERS
// ============================================
function formatDateLookup(isoDate) {
  try {
    var d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return isoDate;
  }
}

function escapeHTMLLookup(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ============================================
// SAVED VIOLATIONS ("Your case")
// Session-first: pins live in sessionStorage (cleared when the tab
// closes) unless the user opts into "Keep on this device", which
// mirrors the walkthrough's explicit-consent model and moves them to
// localStorage. Renders into any element with class
// .saved-violations-panel.
// ============================================
const PINNED_STORAGE_KEY = 'tt-saved-violations';
const PINNED_KEEP_KEY = 'tt-saved-violations-keep';

function pinsKeptOnDevice() {
  try { return localStorage.getItem(PINNED_KEEP_KEY) === '1'; } catch (e) { return false; }
}

// Pins saved before the session-first change were written to
// localStorage under a "persists across sessions" promise — honor it
// by grandfathering them into the keep-on-device tier.
(function migrateLegacyPins() {
  try {
    if (localStorage.getItem(PINNED_STORAGE_KEY) !== null &&
        localStorage.getItem(PINNED_KEEP_KEY) === null) {
      localStorage.setItem(PINNED_KEEP_KEY, '1');
    }
  } catch (e) { /* storage unavailable */ }
})();

function pinStore() {
  return pinsKeptOnDevice() ? localStorage : sessionStorage;
}

function getPinnedViolations() {
  try {
    var raw = pinStore().getItem(PINNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePinnedViolations(arr) {
  try {
    pinStore().setItem(PINNED_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) { /* storage unavailable */ }
}

function setKeepOnDevice(keep) {
  var pins = getPinnedViolations();
  try {
    if (keep) {
      localStorage.setItem(PINNED_KEEP_KEY, '1');
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pins));
      sessionStorage.removeItem(PINNED_STORAGE_KEY);
    } else {
      localStorage.removeItem(PINNED_KEEP_KEY);
      localStorage.removeItem(PINNED_STORAGE_KEY);
      sessionStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pins));
    }
  } catch (e) { /* storage unavailable */ }
  renderAllPinnedPanels();
}

function isPinned(violationId) {
  if (!violationId) return false;
  return getPinnedViolations().some(function(p) { return String(p.id) === String(violationId); });
}

function pinViolation(v, building) {
  if (!v.id) return;
  var pinned = getPinnedViolations();
  if (pinned.some(function(p) { return String(p.id) === String(v.id); })) return;

  // The stored shape is deliberately flat and unchanged from before the
  // package landed, so pins saved by an older build still render.
  pinned.push({
    id: String(v.id),
    class: v.class || '',
    desc: v.description,
    location: v.location || '',
    date: v.inspectionDate || '',
    statusLabel: v.status.label,
    statusState: v.status.state,
    building: building ? building.label : '',
    bbl: building ? building.bbl : '',
    pinnedAt: new Date().toISOString()
  });
  savePinnedViolations(pinned);
  renderAllPinnedPanels();
  updateAllPinButtons();
}

function unpinViolation(violationId) {
  var pinned = getPinnedViolations();
  var next = pinned.filter(function(p) { return String(p.id) !== String(violationId); });
  savePinnedViolations(next);
  renderAllPinnedPanels();
  updateAllPinButtons();
}

function clearAllPinned() {
  if (!confirm('Clear all pinned violations from your case?')) return;
  savePinnedViolations([]);
  renderAllPinnedPanels();
  updateAllPinButtons();
}

function updateAllPinButtons() {
  document.querySelectorAll('.lookup-pin-btn').forEach(function(btn) {
    var id = btn.getAttribute('data-violation-id');
    var pinned = isPinned(id);
    btn.classList.toggle('is-pinned', pinned);
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    var textEl = btn.querySelector('.pin-btn-text');
    if (textEl) textEl.textContent = pinned ? 'Pinned' : 'Pin to your case';
  });
}

function renderAllPinnedPanels() {
  document.querySelectorAll('.saved-violations-panel').forEach(function(container) {
    renderPinnedPanel(container);
  });
}

function renderPinnedPanel(container) {
  var pinned = getPinnedViolations();
  container.innerHTML = '';

  if (pinned.length === 0) {
    container.classList.add('is-empty');
    container.innerHTML =
      '<span class="saved-label">Your case</span>' +
      '<p class="saved-empty-text">No HPD violations pinned yet. When you find ones related to your problem in a lookup, click <strong>Pin to your case</strong> to save them here for your email, complaint, or court filing. Pins are saved only in this browser &mdash; nothing is sent anywhere &mdash; and clear when you close this tab, unless you turn on <strong>Keep on this device</strong>.</p>';
    return;
  }

  container.classList.remove('is-empty');

  // Group by building so multiple cases stay legible
  var byBuilding = {};
  var buildingOrder = [];
  pinned.forEach(function(p) {
    var key = p.building || 'Unknown building';
    if (!byBuilding[key]) {
      byBuilding[key] = [];
      buildingOrder.push(key);
    }
    byBuilding[key].push(p);
  });

  var html = '<div class="saved-header">' +
    '<span class="saved-label">Your case &mdash; <strong>' + pinned.length + ' violation' + (pinned.length === 1 ? '' : 's') + ' pinned</strong></span>' +
    '<button type="button" class="saved-clear-btn">Clear all</button>' +
  '</div>';

  buildingOrder.forEach(function(buildingLabel) {
    var items = byBuilding[buildingLabel];
    if (buildingOrder.length > 1) {
      html += '<div class="saved-building-label">' + escapeHTMLLookup(toSentenceCase(buildingLabel)) + '</div>';
    }
    html += '<ul class="saved-list">';
    items.forEach(function(p) { html += renderSavedItem(p); });
    html += '</ul>';
  });

  html += '<p class="saved-footer-tip"><strong>Tip:</strong> Use these IDs in your email to your landlord, your timeline, your 311 callback, and any HPD or Housing Court filing.</p>';

  var kept = pinsKeptOnDevice();
  html += '<div class="saved-storage-row">' +
    '<label class="saved-keep-toggle">' +
      '<input type="checkbox" class="saved-keep-checkbox"' + (kept ? ' checked' : '') + '> Keep on this device' +
    '</label>' +
    '<p class="saved-storage-note">' + (kept
      ? 'Saved in this browser until you clear them. On a shared or public computer? Use <strong>Clear all</strong> when you\'re done.'
      : 'Saved only in this tab &mdash; pins clear when you close it. Nothing is sent anywhere.') +
    '</p>' +
  '</div>';

  container.innerHTML = html;

  // Wire up handlers
  var keepToggle = container.querySelector('.saved-keep-checkbox');
  if (keepToggle) {
    keepToggle.addEventListener('change', function() {
      setKeepOnDevice(keepToggle.checked);
    });
  }
  container.querySelectorAll('.saved-unpin-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      unpinViolation(btn.getAttribute('data-violation-id'));
    });
  });
  container.querySelectorAll('.saved-copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      copyToClipboardLookup(btn.getAttribute('data-violation-id'), btn);
    });
  });
  var clearBtn = container.querySelector('.saved-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllPinned);
}

function renderSavedItem(p) {
  var statePillHTML = '<span class="lookup-state-pill state-' + p.statusState + '"><span class="state-dot" aria-hidden="true"></span>' + escapeHTMLLookup(p.statusLabel) + '</span>';
  var classDescriptor = { 'A': 'Non-hazardous', 'B': 'Hazardous', 'C': 'Immediately hazardous', 'I': 'Information' }[p.class] || '';
  var classPillHTML = p.class
    ? '<span class="lookup-class-pill"><span class="class-letter">Class ' + escapeHTMLLookup(p.class) + '</span>' + (classDescriptor ? '<span class="class-descriptor">: ' + escapeHTMLLookup(classDescriptor) + '</span>' : '') + '</span>'
    : '';
  var dateText = p.date ? formatDateLookup(p.date) : '';
  return '<li class="saved-item">' +
    '<button type="button" class="saved-unpin-btn" data-violation-id="' + escapeHTMLLookup(p.id) + '" aria-label="Remove from your case">&times;</button>' +
    '<div class="saved-item-pills">' + statePillHTML + classPillHTML + (dateText ? '<span class="saved-item-date">' + escapeHTMLLookup(dateText) + '</span>' : '') + '</div>' +
    '<div class="saved-item-id-row">' +
      '<span class="saved-id-label">Violation ID</span>' +
      '<span class="saved-id-value">' + escapeHTMLLookup(p.id) + '</span>' +
      '<button type="button" class="saved-copy-btn" data-violation-id="' + escapeHTMLLookup(p.id) + '">Copy ID</button>' +
    '</div>' +
    '<div class="saved-item-desc">' + escapeHTMLLookup(p.desc) + '</div>' +
    (p.location ? '<div class="saved-item-location">' + escapeHTMLLookup(p.location) + '</div>' : '') +
  '</li>';
}

function copyToClipboardLookup(text, btn) {
  function showSuccess() {
    var orig = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1400);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showSuccess).catch(function() {
      fallbackCopyText(text, showSuccess);
    });
  } else {
    fallbackCopyText(text, showSuccess);
  }
}

function fallbackCopyText(text, onSuccess) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

// Cross-tab sync: if user pins/unpins in another tab, update this one
window.addEventListener('storage', function(e) {
  if (e.key === PINNED_STORAGE_KEY) {
    renderAllPinnedPanels();
    updateAllPinButtons();
  }
});

// Render saved panels on page load (panels exist on every scenario page,
// not just the one where the user did the lookup)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAllPinnedPanels);
} else {
  renderAllPinnedPanels();
}

// ============================================
// MODULE SURFACE
// ============================================
// Pages call initLookup() from an inline <script type="module">, which runs
// after this module has evaluated. The global keeps those call sites as they
// were; the named export is for anything that wants to import it properly.
window.initLookup = initLookup;

export { initLookup };
