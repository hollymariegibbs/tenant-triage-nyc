/*! @howellandgibbs/hpd-lookup v1.1.0 | MIT | https://github.com/howellandgibbs/hpd-lookup
 * Vendored build — do not edit by hand.
 * Regenerate with scripts/update-hpd-lookup.sh
 */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../../../private/var/folders/89/s44jm7n11qbgysjt6j_3t7rm0000gn/T/tmp.D5Xy6kJOMY/package/dist/chunk-P3BCMFRY.js
var HpdLookupError = class extends Error {
  constructor(message, options) {
    super(message, options.cause !== void 0 ? { cause: options.cause } : void 0);
    __publicField(this, "code");
    /** HTTP status, when the failure came from an upstream response. */
    __publicField(this, "status");
    /** The URL we were requesting, with any app token removed. */
    __publicField(this, "url");
    this.name = "HpdLookupError";
    this.code = options.code;
    this.status = options.status;
    this.url = options.url;
  }
};
function isHpdLookupError(value) {
  return value instanceof Error && value.name === "HpdLookupError" && "code" in value;
}
var PRESERVE_UPPERCASE = /* @__PURE__ */ new Set([
  "HPD",
  "DEC",
  "NOV",
  "NYC",
  "NYS",
  "DOH",
  "DOHMH",
  "DEP",
  "DOB",
  "FDNY",
  "NYCHA",
  "IPM",
  "DHCR",
  "ADA",
  "DOL",
  "EPA",
  "DCWP",
  "HMC",
  "MDL",
  "ECB",
  "OATH",
  "TTY",
  "EIN",
  "SSN",
  "LL",
  "BIN",
  "BBL",
  "AEP",
  "SRO",
  "USPS",
  "PDF",
  "LLC",
  "PC",
  "PA",
  "I",
  "II",
  "III",
  "IV",
  "V"
]);
function toSentenceCase(str) {
  if (!str) return "";
  let out = str.toLowerCase();
  out = out.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_m, prefix, ch) => prefix + ch.toUpperCase());
  out = out.replace(/\b([a-z]+)\b/gi, (match) => {
    const upper = match.toUpperCase();
    return PRESERVE_UPPERCASE.has(upper) ? upper : match;
  });
  out = out.replace(
    /\b(apt|fl|floor|unit|rm|room)\s+(\d+[a-z]?)\b/gi,
    (_m, prefix, num) => prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() + " " + num.toUpperCase()
  );
  out = out.replace(/\b(\d+[a-z])\b/g, (match) => match.toUpperCase());
  out = out.replace(
    /(^|[^\w/])([a-z]{2,4}\d+[a-z\d]*)\b/g,
    (_m, prefix, token) => prefix + token.toUpperCase()
  );
  return out;
}
var STATUS_MAP = {
  // Resolved and removed
  "VIOLATION CLOSED": { label: "Resolved \u2014 HPD closed this violation", state: "closed" },
  "VIOLATION DISMISSED": { label: "Dismissed by HPD", state: "dismissed" },
  // Notice stage
  "NOV SENT OUT": { label: "Notice sent to landlord", state: "open" },
  "INFO NOV SENT OUT": { label: "Informational notice sent to landlord", state: "open" },
  "NOTICE OF ISSUANCE SENT TO TENANT": { label: "Tenant notified of violation", state: "open" },
  "DEFECT LETTER ISSUED": { label: "Defect letter issued to landlord", state: "open" },
  "VIOLATION OPEN": { label: "Open \u2014 landlord has not fixed it yet", state: "open" },
  "VIOLATION REOPEN": { label: "Reopened \u2014 the problem came back", state: "open" },
  // Deadline passed
  "NOT COMPLIED WITH": { label: "Landlord missed the deadline to fix it", state: "open" },
  // Landlord certification
  "NOV CERTIFIED ON TIME": { label: "Landlord certified it fixed, on time", state: "open" },
  "NOV CERTIFIED LATE": { label: "Landlord certified it fixed, after the deadline", state: "open" },
  "INVALID CERTIFICATION": { label: "Landlord\u2019s certification was rejected by HPD", state: "open" },
  "FALSE CERTIFICATION": { label: "Landlord certified it fixed, but HPD found it was not", state: "open" },
  "CERTIFICATION POSTPONMENT GRANTED": { label: "Certification deadline extended", state: "open" },
  "CERTIFICATION POSTPONMENT DENIED": { label: "Landlord\u2019s request for more time was denied", state: "open" },
  // Re-inspection
  "VIOLATION WILL BE REINSPECTED": { label: "Awaiting HPD re-inspection", state: "open" },
  "FIRST NO ACCESS TO RE-INSPECT VIOLATION": {
    label: "HPD could not get in to re-inspect (first attempt)",
    state: "open"
  },
  "SECOND NO ACCESS TO RE-INSPECT VIOLATION": {
    label: "HPD could not get in to re-inspect (second attempt)",
    state: "open"
  },
  "COMPLIED IN ACCESS AREA": { label: "Fixed in the area HPD could reach", state: "open" },
  "DOWNGRADE PENDING INSPECTION": { label: "Severity may be lowered, pending inspection", state: "open" },
  // Lead paint
  "LEAD DOCS SUBMITTED, ACCEPTABLE": { label: "Lead paint paperwork accepted by HPD", state: "open" },
  "LEAD DOCS SUBMITTED, NOT ACCEPTABLE": { label: "Lead paint paperwork rejected by HPD", state: "open" },
  // Court
  "CIV14 MAILED": { label: "Court action initiated", state: "open" },
  // Historical codes, retired upstream but still present in older records.
  "FIRST NOTICE OF VIOLATION SENT": { label: "Notice sent to landlord", state: "open" },
  "NOV CERTIFIED": { label: "Landlord certified it fixed (not re-inspected)", state: "open" },
  CLOSED: { label: "Resolved \u2014 HPD closed this violation", state: "closed" },
  INVALID: { label: "Marked invalid", state: "dismissed" }
};
function normalizeStatusKey(rawStatus) {
  return rawStatus.toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
}
function translateStatus(rawStatus) {
  const raw = rawStatus ?? "";
  if (!raw.trim()) {
    return { label: "Status unknown", state: "open", raw, known: false };
  }
  const mapped = STATUS_MAP[normalizeStatusKey(raw)];
  if (mapped) {
    return { label: mapped.label, state: mapped.state, raw, known: true };
  }
  const upper = raw.toUpperCase();
  return {
    label: toSentenceCase(raw),
    state: upper.includes("DISMISS") ? "dismissed" : upper.includes("CLOS") ? "closed" : "open",
    raw,
    known: false
  };
}
var HPD_ACTION_VERBS = /* @__PURE__ */ new Set([
  "abate",
  "adjust",
  "apply",
  "arrange",
  "caulk",
  "certify",
  "clean",
  "clear",
  "close",
  "correct",
  "demolish",
  "discontinue",
  "eliminate",
  "enclose",
  "erect",
  "establish",
  "exterminate",
  "file",
  "fix",
  "furnish",
  "hang",
  "install",
  "keep",
  "maintain",
  "make",
  "obtain",
  "paint",
  "patch",
  "parge",
  "perform",
  "plaster",
  "plug",
  "post",
  "properly",
  "provide",
  "purge",
  "rearrange",
  "rebuild",
  "reconstruct",
  "refit",
  "refinish",
  "rehang",
  "remediate",
  "remedy",
  "remove",
  "repair",
  "replace",
  "replaster",
  "replumb",
  "restore",
  "resurface",
  "rewire",
  "scrape",
  "seal",
  "secure",
  "submit",
  "supply",
  "tighten",
  "trace",
  "trim",
  "upgrade",
  "ventilate",
  "weatherize",
  "wire"
]);
var CITATION_WORDS = /* @__PURE__ */ new Set([
  "hmc",
  "mdl",
  "adm",
  "admin",
  "code",
  "rcny",
  "nyc",
  "nys",
  "and",
  "or",
  "of",
  "the",
  "in",
  "at",
  "to",
  "for",
  "by",
  "a",
  "an",
  "no",
  "not",
  "per",
  "law",
  "local",
  "section",
  "sec",
  "sub",
  "subdivision",
  "article",
  "chapter",
  "title",
  "pursuant",
  "accordance",
  "with",
  "under",
  "also",
  "see",
  "dm",
  "multiple",
  "dwelling",
  "dept",
  "department",
  "rules",
  "regs",
  "regulations",
  "rule"
]);
var CLASS_SEVERITY = {
  A: "Non-hazardous",
  B: "Hazardous",
  C: "Immediately hazardous",
  I: "Information"
};
function cleanDescription(rawDesc) {
  if (!rawDesc) return { main: "No description available", location: "" };
  const working = rawDesc.trim();
  const tokens = [...working.matchAll(/\S+/g)].map((m) => ({ text: m[0], index: m.index }));
  let descriptionStart = -1;
  let passedCitationMaterial = false;
  for (const [i, token] of tokens.entries()) {
    const cleaned = normalizeToken(token.text);
    if (/[\d§():]/.test(token.text) || CITATION_WORDS.has(cleaned)) {
      passedCitationMaterial = true;
    }
    const colon = token.text.lastIndexOf(":");
    if (colon !== -1 && colon < token.text.length - 1) {
      if (HPD_ACTION_VERBS.has(normalizeToken(token.text.slice(colon + 1)))) {
        descriptionStart = token.index + colon + 1;
        break;
      }
    }
    if (HPD_ACTION_VERBS.has(cleaned)) {
      descriptionStart = token.index;
      break;
    }
    if (passedCitationMaterial && cleaned.length > 2 && /^[a-zA-Z]+$/.test(cleaned) && !CITATION_WORDS.has(cleaned) && !citationFollows(tokens, i + 1)) {
      descriptionStart = token.index;
      break;
    }
  }
  let description = descriptionStart > 0 ? working.substring(descriptionStart).trim() : working;
  description = description.replace(/^[\s:;,\-.]+/, "");
  let main = description;
  let location = "";
  const fullLocMatch = description.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*?(?:located\s+at\s+.+))$/i);
  if (fullLocMatch?.index !== void 0 && fullLocMatch[1]) {
    main = description.substring(0, fullLocMatch.index + 1).trim();
    location = fullLocMatch[1].trim();
  } else {
    const simpleLocMatch = description.match(/\.?\s*(located\s+at\s+.+)$/i);
    if (simpleLocMatch?.index !== void 0 && simpleLocMatch[1]) {
      main = description.substring(0, simpleLocMatch.index).trim();
      const danglingRoom = main.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*)$/i);
      if (danglingRoom?.index !== void 0 && danglingRoom[1]) {
        const roomText = danglingRoom[1].trim();
        main = main.substring(0, danglingRoom.index + 1).trim();
        location = roomText + " \u2014 " + simpleLocMatch[1].trim();
      } else {
        location = simpleLocMatch[1].trim();
      }
    } else {
      const trailingRoom = main.match(/\.\s+(in\s+(?:the\s+)?\w[\w\s]*)$/i);
      if (trailingRoom?.index !== void 0 && trailingRoom[1] && trailingRoom[1].split(/\s+/).length <= 6) {
        location = trailingRoom[1].trim();
        main = main.substring(0, trailingRoom.index + 1).trim();
      }
    }
  }
  main = main.replace(/[\s:;,\-]+$/, "");
  return {
    main: toSentenceCase(main),
    location: location ? toSentenceCase(location) : ""
  };
}
function parseViolation(raw) {
  const { main, location } = cleanDescription(raw.novdescription ?? raw.novtype);
  const classLetter = (raw.class ?? "").toUpperCase().trim();
  const violationClass = isViolationClass(classLetter) ? classLetter : null;
  const status = translateStatus(raw.currentstatus);
  const flagged = readViolationStatus(raw.violationstatus);
  const state = status.state === "dismissed" ? "dismissed" : flagged ?? status.state;
  return {
    id: nonEmpty(raw.violationid),
    description: main,
    location,
    status: state === status.state ? status : { ...status, state },
    class: violationClass,
    severity: violationClass ? CLASS_SEVERITY[violationClass] : null,
    rentImpairing: readYesNo(raw.rentimpairing),
    apartment: nonEmpty(raw.apartment),
    inspectionDate: nonEmpty(raw.inspectiondate),
    bbl: nonEmpty(raw.bbl),
    raw
  };
}
function readViolationStatus(value) {
  const upper = value?.trim().toUpperCase();
  if (!upper) return null;
  if (upper.startsWith("CLOSE")) return "closed";
  if (upper.startsWith("OPEN")) return "open";
  return null;
}
function readYesNo(value) {
  const upper = value?.trim().toUpperCase();
  if (upper === "Y" || upper === "YES" || upper === "TRUE") return true;
  if (upper === "N" || upper === "NO" || upper === "FALSE") return false;
  return null;
}
function normalizeToken(token) {
  return token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "").toLowerCase();
}
function citationFollows(tokens, from, lookahead = 3) {
  return tokens.slice(from, from + lookahead).some((t) => t.text.includes("\xA7") || /\d+[-.]\d/.test(t.text));
}
function isViolationClass(value) {
  return value === "A" || value === "B" || value === "C" || value === "I";
}
function nonEmpty(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
var ADDRESS_PRESERVE_UPPERCASE = /* @__PURE__ */ new Set([
  "NY",
  "NYC",
  "NYS",
  "US",
  "USA"
]);
var MINOR_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to"
]);
function isNumericToken(token) {
  return /^[\d/-]+$/.test(token);
}
function formatAddress(label) {
  if (!label) return "";
  const parts = label.split(/(\s+)/);
  let startOfSegment = true;
  let stillLeadingNumbers = true;
  return parts.map((part) => {
    if (part === "" || /^\s+$/.test(part)) return part;
    const core = part.replace(/[,.]+$/, "");
    const trailing = part.slice(core.length);
    const numeric = isNumericToken(core);
    const formatted = formatToken(core, startOfSegment || stillLeadingNumbers) + trailing;
    stillLeadingNumbers = (startOfSegment || stillLeadingNumbers) && numeric;
    startOfSegment = /,$/.test(part);
    if (startOfSegment) stillLeadingNumbers = true;
    return formatted;
  }).join("");
}
function formatToken(core, major) {
  if (!core) return core;
  const upper = core.toUpperCase();
  if (ADDRESS_PRESERVE_UPPERCASE.has(upper)) return upper;
  if (isNumericToken(core)) return core;
  if (/^\d+(st|nd|rd|th)$/i.test(core)) return core.toLowerCase();
  if (!major && MINOR_WORDS.has(core.toLowerCase())) return core.toLowerCase();
  return core.split("-").map(capitalizeWord).join("-");
}
function capitalizeWord(word) {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (/^mc[a-z]{3,}$/.test(lower)) {
    return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
var DEFAULT_TIMEOUT_MS = 15e3;
async function fetchJson(url, options = {}) {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new HpdLookupError(
      "No fetch implementation available. Use Node 18+, or pass `fetch` in options.",
      { code: "invalid_input" }
    );
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs) : null;
  const unlink = linkSignal(options.signal, controller);
  const headers = { Accept: "application/json" };
  if (options.appToken) headers["X-App-Token"] = options.appToken;
  try {
    const response = await doFetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new HpdLookupError(
        `Upstream request failed with HTTP ${response.status}${response.status === 429 ? " (rate limited \u2014 a Socrata app token raises the limit)" : ""}.`,
        { code: "upstream_error", status: response.status, url }
      );
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new HpdLookupError("Upstream returned a response that is not valid JSON.", {
        code: "malformed_response",
        status: response.status,
        url,
        cause
      });
    }
  } catch (cause) {
    if (cause instanceof HpdLookupError) throw cause;
    if (isAbort(cause)) {
      const timedOut = controller.signal.aborted && !options.signal?.aborted;
      throw new HpdLookupError(
        timedOut ? `Request timed out after ${timeoutMs}ms.` : "Request was aborted.",
        { code: "aborted", url, cause }
      );
    }
    throw new HpdLookupError("Could not reach the upstream API.", {
      code: "network_error",
      url,
      cause
    });
  } finally {
    if (timer) clearTimeout(timer);
    unlink();
  }
}
function linkSignal(signal, controller) {
  if (!signal) return () => {
  };
  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => {
    };
  }
  const onAbort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}
function isAbort(value) {
  return value instanceof Error && (value.name === "AbortError" || value.name === "TimeoutError");
}
var GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete";
var DEFAULT_MAX_SUGGESTIONS = 5;
async function searchAddresses(address, options = {}) {
  const query = address?.trim();
  if (!query) {
    throw new HpdLookupError("An address is required.", { code: "invalid_input" });
  }
  const size = options.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
  const url = `${GEOSEARCH_URL}?text=${encodeURIComponent(query)}&size=${encodeURIComponent(String(size))}`;
  const data = await fetchJson(url, options);
  if (!data || !Array.isArray(data.features)) {
    throw new HpdLookupError("GeoSearch returned an unexpected response shape.", {
      code: "malformed_response",
      url
    });
  }
  return data.features.map(toBuilding).filter((b) => b !== null);
}
function toBuilding(feature) {
  const props = feature.properties ?? {};
  const pad = props.addendum?.pad ?? {};
  const bbl = pad.bbl?.trim();
  if (!bbl) return null;
  const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : null;
  const [lon, lat] = coords ?? [];
  const label = props.label ?? props.name ?? "Unknown address";
  return {
    bbl,
    bin: pad.bin?.trim() || null,
    label,
    displayLabel: formatAddress(label),
    borough: props.borough ?? null,
    houseNumber: props.housenumber ?? null,
    street: props.street ?? null,
    postalCode: props.postalcode ?? null,
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lon === "number" ? lon : null
  };
}
var SOCRATA_VIOLATIONS_URL = "https://data.cityofnewyork.us/resource/wvxf-dwi5.json";
var DEFAULT_LIMIT = 1e3;
var MAX_LIMIT = 5e4;
async function lookupByBBL(bbl, options = {}) {
  const cleanBBL = (bbl ?? "").trim();
  if (!/^\d{10}$/.test(cleanBBL)) {
    throw new HpdLookupError(`Expected a 10-digit BBL, received "${bbl}".`, { code: "invalid_input" });
  }
  const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
  const where = [`bbl='${cleanBBL}'`];
  if (options.since) where.push(`inspectiondate >= '${toSocrataDate(options.since)}'`);
  const url = `${SOCRATA_VIOLATIONS_URL}?$where=${encodeURIComponent(where.join(" AND "))}&$order=${encodeURIComponent("inspectiondate DESC")}&$limit=${limit}`;
  const data = await fetchJson(url, options);
  if (!Array.isArray(data)) {
    throw new HpdLookupError("The violations API returned an unexpected response shape.", {
      code: "malformed_response",
      url
    });
  }
  return { bbl: cleanBBL, violations: applyFilters(data.map(parseViolation), options) };
}
async function lookupByAddress(address, options = {}) {
  const buildings = await searchAddresses(address, options);
  const building = buildings[0];
  if (!building) {
    throw new HpdLookupError(`No NYC building matched "${address}".`, { code: "address_not_found" });
  }
  const { violations } = await lookupByBBL(building.bbl, options);
  return {
    bbl: building.bbl,
    building,
    alternatives: buildings.slice(1),
    violations
  };
}
function applyFilters(violations, options) {
  const states = options.states;
  const classes = options.classes;
  if (!states?.length && !classes?.length) return violations;
  return violations.filter((v) => {
    if (states?.length && !states.includes(v.status.state)) return false;
    if (classes?.length && (v.class === null || !classes.includes(v.class))) return false;
    return true;
  });
}
function clampLimit(limit) {
  if (!Number.isFinite(limit) || limit < 1) {
    throw new HpdLookupError(`\`limit\` must be a positive number, received ${limit}.`, {
      code: "invalid_input"
    });
  }
  return Math.min(Math.floor(limit), MAX_LIMIT);
}
function toSocrataDate(since) {
  const date = new Date(since);
  if (Number.isNaN(date.getTime())) {
    throw new HpdLookupError(`\`since\` must be a valid date, received "${since}".`, {
      code: "invalid_input"
    });
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}
export {
  ADDRESS_PRESERVE_UPPERCASE,
  CITATION_WORDS,
  CLASS_SEVERITY,
  DEFAULT_LIMIT,
  DEFAULT_MAX_SUGGESTIONS,
  GEOSEARCH_URL,
  HPD_ACTION_VERBS,
  HpdLookupError,
  MAX_LIMIT,
  PRESERVE_UPPERCASE,
  SOCRATA_VIOLATIONS_URL,
  STATUS_MAP,
  cleanDescription,
  formatAddress,
  isHpdLookupError,
  lookupByAddress,
  lookupByBBL,
  normalizeStatusKey,
  parseViolation,
  searchAddresses,
  toSentenceCase,
  translateStatus
};
