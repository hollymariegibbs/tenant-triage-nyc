// ============================================
// ADDRESS LOOKUP + HPD VIOLATIONS COMPONENT
// Shared across all scenario pages.
//
// Usage:
//   1. Include the lookup HTML block (see scenario pages)
//   2. Include lookup.css styles
//   3. <script src="../lookup.js"></script>
//   4. Call: initLookup({ filterKeywords: ['mold', 'mildew', ...] })
// ============================================

// Configuration
const GEOSEARCH_URL = 'https://geosearch.planninglabs.nyc/v2/autocomplete';
const SOCRATA_VIOLATIONS_URL = 'https://data.cityofnewyork.us/resource/wvxf-dwi5.json';
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

// DOM references (set in init)
let lookupInput, lookupSuggestionsBox, lookupStatusEl, lookupResultsEl, lookupFallbackEl;

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

  lookupInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    lookupResultsEl.classList.remove('visible');
    lookupStatusEl.textContent = '';
    lookupStatusEl.classList.remove('error');
    lookupFallbackEl.style.display = 'none';

    if (query.length < 3) {
      lookupSuggestionsBox.classList.remove('visible');
      return;
    }

    clearTimeout(lookupDebounceTimer);
    lookupDebounceTimer = setTimeout(function() {
      fetchGeoSearch(query)
        .then(function(data) {
          renderLookupSuggestions(data.features || []);
        })
        .catch(function() {
          lookupSuggestionsBox.classList.remove('visible');
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
      lookupSuggestionsBox.classList.remove('visible');
    }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.lookup-input-wrap')) {
      lookupSuggestionsBox.classList.remove('visible');
    }
  });
}

// ============================================
// GEOSEARCH
// ============================================
async function fetchGeoSearch(query) {
  const url = GEOSEARCH_URL + '?text=' + encodeURIComponent(query) + '&size=' + MAX_SUGGESTIONS;
  const response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return await response.json();
}

function renderLookupSuggestions(features) {
  lookupSuggestionsBox.innerHTML = '';
  lookupCurrentSuggestions = [];
  lookupHighlightedIndex = -1;

  if (!features || features.length === 0) {
    lookupSuggestionsBox.classList.remove('visible');
    return;
  }

  features.forEach(function(feature) {
    const props = feature.properties || {};
    const label = props.label || props.name || 'Unknown address';
    const borough = props.borough || '';
    const padData = (props.addendum && props.addendum.pad) || {};
    const bbl = padData.bbl;

    if (!bbl) return;

    lookupCurrentSuggestions.push({
      label: label,
      borough: borough,
      bbl: bbl,
      bin: padData.bin,
      housenumber: props.housenumber,
      street: props.street,
      postalcode: props.postalcode
    });

    const el = document.createElement('div');
    el.className = 'lookup-suggestion';
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
  } else {
    lookupSuggestionsBox.classList.remove('visible');
  }
}

function setLookupHighlight(index) {
  var items = lookupSuggestionsBox.querySelectorAll('.lookup-suggestion');
  items.forEach(function(item, i) {
    item.classList.toggle('highlighted', i === index);
  });
  lookupHighlightedIndex = index;
}

function selectLookupSuggestion(index) {
  if (index < 0 || index >= lookupCurrentSuggestions.length) return;
  var selected = lookupCurrentSuggestions[index];
  lookupInput.value = selected.label;
  lookupSuggestionsBox.classList.remove('visible');
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

  var whereClause = "bbl='" + building.bbl + "'";
  var url = SOCRATA_VIOLATIONS_URL +
    '?$where=' + encodeURIComponent(whereClause) +
    '&$order=' + encodeURIComponent('inspectiondate DESC') +
    '&$limit=' + SOCRATA_FETCH_LIMIT;

  try {
    var headers = {};
    if (SOCRATA_APP_TOKEN) headers['X-App-Token'] = SOCRATA_APP_TOKEN;
    var response = await fetch(url, { headers: headers });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    var data = await response.json();
    renderViolations(building, data);
  } catch (err) {
    lookupStatusEl.textContent = 'Could not fetch violations from HPD data. The HPD data service may be temporarily unavailable.';
    lookupStatusEl.classList.add('error');
    lookupFallbackEl.style.display = 'block';
  }
}

function applyFilter(violations) {
  if (!filterActive || filterKeywords.length === 0) return violations;
  return violations.filter(function(v) {
    var desc = ((v.novdescription || '') + ' ' + (v.novtype || '')).toLowerCase();
    return filterKeywords.some(function(kw) { return desc.indexOf(kw) !== -1; });
  });
}

function renderViolations(building, violations) {
  lookupStatusEl.textContent = '';
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
        if (translateStatus(v.currentstatus).state === 'open') openCount++;
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
  }

  // Update filter toggle
  var toggleEl = document.getElementById('lookup-filter-toggle');
  if (toggleEl && filterKeywords.length > 0) {
    toggleEl.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lookup-filter-btn' + (filterActive ? ' active' : '');
    btn.innerHTML = filterActive
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Showing related violations only'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Showing all violations';
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

  var statusInfo = translateStatus(v.currentstatus);
  li.classList.add('state-' + statusInfo.state);

  var desc = cleanDescription(v.novdescription || v.novtype);

  // Top row
  var top = document.createElement('div');
  top.className = 'lookup-violation-top';

  var statePill = document.createElement('span');
  statePill.className = 'lookup-state-pill state-' + statusInfo.state;
  statePill.innerHTML = '<span class="state-dot" aria-hidden="true"></span>' + escapeHTMLLookup(statusInfo.label);
  top.appendChild(statePill);

  var violationClass = (v.class || '').toUpperCase();
  var classDescriptor = { 'A': 'Non-hazardous', 'B': 'Hazardous', 'C': 'Immediately hazardous', 'I': 'Information' }[violationClass] || '';

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
  date.textContent = v.inspectiondate ? formatDateLookup(v.inspectiondate) : '';
  top.appendChild(date);

  li.appendChild(top);

  var descEl = document.createElement('div');
  descEl.className = 'lookup-violation-desc';
  descEl.textContent = desc.main;
  li.appendChild(descEl);

  if (desc.location) {
    var locEl = document.createElement('div');
    locEl.className = 'lookup-violation-location';
    locEl.textContent = desc.location;
    li.appendChild(locEl);
  }

  return li;
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
}

// ============================================
// STATUS TRANSLATION
// ============================================
const STATUS_MAP = {
  'NOV SENT OUT':                          { label: 'Notice sent to landlord',                state: 'open' },
  'FIRST NOTICE OF VIOLATION SENT':        { label: 'Notice sent to landlord',                state: 'open' },
  'NOTICE OF ISSUANCE SENT TO TENANT':     { label: 'Tenant notified of violation',           state: 'open' },
  'VIOLATION OPEN':                        { label: 'Open \u2014 landlord has not fixed yet', state: 'open' },
  'NOV CERTIFIED':                         { label: 'Landlord claims fixed (not re-inspected)', state: 'open' },
  'CERTIFICATION POSTPONMENT GRANTED':     { label: 'Certification deadline extended',        state: 'open' },
  'FIRST NO ACCESS TO RE-INSPECT VIOLATION': { label: 'HPD inspector could not access apartment', state: 'open' },
  'CIV14 MAILED':                          { label: 'Court action initiated',                 state: 'open' },
  'VIOLATION CLOSED':                      { label: 'Resolved',                                state: 'closed' },
  'CLOSED':                                { label: 'Resolved',                                state: 'closed' },
  'VIOLATION DISMISSED':                   { label: 'Dismissed by HPD',                       state: 'dismissed' },
  'INVALID':                               { label: 'Marked invalid',                         state: 'dismissed' }
};

function translateStatus(rawStatus) {
  if (!rawStatus) return { label: 'Status unknown', state: 'open' };
  var upper = rawStatus.toUpperCase().trim();
  if (STATUS_MAP[upper]) return STATUS_MAP[upper];
  var isClosed = upper.indexOf('CLOS') !== -1;
  var isDismissed = upper.indexOf('DISMISS') !== -1 || upper.indexOf('INVALID') !== -1;
  return {
    label: toSentenceCase(rawStatus),
    state: isDismissed ? 'dismissed' : (isClosed ? 'closed' : 'open')
  };
}

// ============================================
// TEXT UTILITIES
// ============================================
const PRESERVE_UPPERCASE = new Set([
  'HPD', 'DEC', 'NOV', 'NYC', 'NYS', 'DOH', 'DOHMH', 'DEP', 'DOB',
  'FDNY', 'NYCHA', 'IPM', 'DHCR', 'ADA', 'DOL', 'EPA', 'DCWP',
  'HMC', 'MDL', 'ECB', 'OATH', 'TTY', 'EIN', 'SSN', 'LL', 'BIN',
  'BBL', 'AEP', 'SRO', 'USPS', 'PDF', 'LLC', 'PC', 'PA',
  'I', 'II', 'III', 'IV', 'V'
]);

function toSentenceCase(str) {
  if (!str) return '';
  var out = str.toLowerCase();
  out = out.replace(/(^\s*|[.!?]\s+)([a-z])/g, function(_, prefix, ch) {
    return prefix + ch.toUpperCase();
  });
  out = out.replace(/\b([a-z]+)\b/gi, function(match, word) {
    var upper = word.toUpperCase();
    if (PRESERVE_UPPERCASE.has(upper)) return upper;
    return match;
  });
  out = out.replace(/\b(apt|fl|floor|unit|rm|room)\s+(\d+[a-z]?)\b/gi, function(_, prefix, num) {
    var cap = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    return cap + ' ' + num.toUpperCase();
  });
  out = out.replace(/\b(\d+[a-z])\b/g, function(match) {
    return match.toUpperCase();
  });
  return out;
}

const HPD_ACTION_VERBS = new Set([
  'abate', 'adjust', 'apply',
  'caulk', 'certify', 'clean', 'clear', 'close', 'correct',
  'demolish', 'discontinue',
  'eliminate', 'enclose', 'erect', 'establish', 'exterminate',
  'file', 'fix', 'furnish',
  'hang',
  'install',
  'keep',
  'maintain', 'make',
  'obtain',
  'paint', 'patch', 'parge', 'perform', 'plaster', 'plug', 'post',
  'properly', 'provide', 'purge',
  'rearrange', 'rebuild', 'reconstruct', 'refit', 'refinish',
  'rehang', 'remediate', 'remedy', 'remove', 'repair', 'replace',
  'replaster', 'replumb', 'restore', 'resurface', 'rewire',
  'seal', 'secure', 'submit', 'supply',
  'tighten', 'trim',
  'upgrade',
  'ventilate',
  'weatherize', 'wire',
]);

const CITATION_WORDS = new Set([
  'hmc', 'mdl', 'adm', 'admin', 'code', 'rcny', 'nyc', 'nys',
  'and', 'or', 'of', 'the', 'in', 'at', 'to', 'for', 'by',
  'a', 'an', 'no', 'not', 'per', 'law', 'local', 'section',
  'sec', 'sub', 'subdivision', 'article', 'chapter', 'title',
  'pursuant', 'accordance', 'with', 'under', 'also', 'see',
  'dm', 'multiple', 'dwelling',
  'dept', 'department', 'rules', 'regs', 'regulations', 'rule',
]);

function cleanDescription(rawDesc) {
  if (!rawDesc) return { main: 'No description available', location: '' };
  var working = rawDesc.trim();

  var descriptionStart = -1;
  var passedCitationMaterial = false;
  var words = working.split(/\s+/);
  var charPos = 0;

  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var cleaned = word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase();

    if (/[\d§():]/.test(word) || CITATION_WORDS.has(cleaned)) {
      passedCitationMaterial = true;
    }

    if (HPD_ACTION_VERBS.has(cleaned)) {
      descriptionStart = charPos;
      break;
    }

    if (passedCitationMaterial
        && cleaned.length > 1
        && /^[a-zA-Z]+$/.test(cleaned)
        && !CITATION_WORDS.has(cleaned)) {
      descriptionStart = charPos;
      break;
    }

    charPos += word.length;
    if (charPos < working.length) {
      var nextChar = working[charPos];
      if (nextChar === ' ' || nextChar === '\t' || nextChar === '\n') {
        charPos++;
        while (charPos < working.length && (working[charPos] === ' ' || working[charPos] === '\t')) {
          charPos++;
        }
      }
    }
  }

  var description;
  if (descriptionStart > 0) {
    description = working.substring(descriptionStart).trim();
  } else if (descriptionStart === 0) {
    description = working;
  } else {
    description = working;
  }

  description = description.replace(/^[\s:;,\-\.]+/, '');

  var main = description;
  var location = '';

  var fullLocMatch = description.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*?(?:located\s+at\s+.+))$/i);
  if (fullLocMatch) {
    main = description.substring(0, fullLocMatch.index + 1).trim();
    location = fullLocMatch[1].trim();
  } else {
    var simpleLocMatch = description.match(/\.?\s*(located\s+at\s+.+)$/i);
    if (simpleLocMatch) {
      main = description.substring(0, simpleLocMatch.index).trim();
      var danglingRoom = main.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*)$/i);
      if (danglingRoom) {
        var roomText = danglingRoom[1].trim();
        main = main.substring(0, danglingRoom.index + 1).trim();
        location = roomText + ' \u2014 ' + simpleLocMatch[1].trim();
      } else {
        location = simpleLocMatch[1].trim();
      }
    } else {
      var trailingRoom = main.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*)$/i);
      if (trailingRoom && trailingRoom[1].split(/\s+/).length <= 6) {
        location = trailingRoom[1].trim();
        main = main.substring(0, trailingRoom.index + 1).trim();
      }
    }
  }

  main = main.replace(/[\s:;,\-]+$/, '');

  return {
    main: toSentenceCase(main),
    location: location ? toSentenceCase(location) : ''
  };
}

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
