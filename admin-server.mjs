/**
 * admin-server.mjs
 * ─────────────────────────────────────────────────────────────
 * خادم محلي بسيط لإدارة بيانات شجرة العائلة.
 * لا يحتاج أي تثبيت — فقط: node admin-server.mjs
 * ─────────────────────────────────────────────────────────────
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'src', 'data', 'family-data.ts');
const DATA_DIR = dirname(DATA_FILE);
const ADMIN_HTML = join(__dirname, 'admin.html');
const PORT = 3333;

// ─── Undo tracking ─────────────────────────────────────────
const BACKUP_FILE = DATA_FILE + '.backup';
const NOTES_FILE = join(__dirname, 'notes.json');

// ─── Notes Storage ──────────────────────────────────────────
function readNotes() {
  try {
    if (existsSync(NOTES_FILE)) {
      return JSON.parse(readFileSync(NOTES_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function writeNotes(notes) {
  writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

// ─── Helpers ────────────────────────────────────────────────

function esc(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function parseBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => {
      try { resolve(JSON.parse(d)); } catch { resolve({}); }
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// ─── Data Layer ─────────────────────────────────────────────

function readRaw() {
  return readFileSync(DATA_FILE, 'utf-8');
}

function parseRaw(raw) {
  const start = raw.indexOf('= {');
  const end = raw.lastIndexOf('};');
  if (start === -1 || end === -1) throw new Error('Cannot parse family-data.ts');
  let obj = raw.substring(start + 2, end + 1);
  obj = obj.replace(/\/\/.*$/gm, '');
  return new Function('return ' + obj)();
}

function readData() {
  return parseRaw(readRaw());
}

function nextPersonId(people) {
  let mx = 0;
  for (const p of people) {
    const n = parseInt(p.id.slice(1));
    if (n > mx) mx = n;
  }
  return 'p' + String(mx + 1).padStart(3, '0');
}

function nextSpouseId(people) {
  let mx = 0;
  for (const p of people) {
    for (const s of p.spouses) {
      const n = parseInt(s.id.slice(1));
      if (n > mx) mx = n;
    }
  }
  return 's' + String(mx + 1).padStart(3, '0');
}

// ─── Backup & Safe Write ────────────────────────────────────

function backup() {
  copyFileSync(DATA_FILE, BACKUP_FILE);
  console.log('  ↳ backup → family-data.ts.backup');
}

function getLatestBackup() {
  return existsSync(BACKUP_FILE) ? BACKUP_FILE : null;
}

function validateRaw(raw) {
  try {
    const data = parseRaw(raw);
    if (!data.people || !Array.isArray(data.people)) return false;
    if (!data.rootPersonId) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply one or more mutations safely:
 * backup → apply mutations → validate → write (atomic via temp file)
 * Each mutation: (rawString) => modifiedRawString
 */
function safeOp(...mutations) {
  backup();
  let raw = readRaw();
  for (const fn of mutations) {
    raw = fn(raw);
  }
  if (!validateRaw(raw)) {
    throw new Error('البيانات الناتجة غير صالحة — تم إلغاء العملية والاحتفاظ بالنسخة الأصلية');
  }
  // Validate via temp file, then write directly to original
  // (renameSync fails on Windows when the file is locked by editors/watchers)
  const tmpFile = DATA_FILE + '.tmp';
  writeFileSync(tmpFile, raw, 'utf-8');
  // Re-validate the written temp file
  try {
    const reRead = readFileSync(tmpFile, 'utf-8');
    if (!validateRaw(reRead)) {
      unlinkSync(tmpFile);
      throw new Error('فشل التحقق من الملف المؤقت — تم إلغاء العملية');
    }
  } catch (e) {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    throw e;
  }
  // Write directly to original file (avoids EPERM on Windows when file is locked)
  writeFileSync(DATA_FILE, raw, 'utf-8');
  // Clean up temp file
  try { unlinkSync(tmpFile); } catch {}
}

// ─── Pure Mutation Functions ────────────────────────────────
// Each takes the raw file string and returns the modified string.
// They do NOT read or write files themselves.

/** Append a new Person entry at the end of the people array. */
function mutatePushPerson(person) {
  return (raw) => {
    const fid = person.fatherId ? `"${person.fatherId}"` : 'null';
    const mid = person.motherId ? `"${person.motherId}"` : 'null';
    const line =
      `    { id: "${person.id}", name: "${esc(person.name)}", gender: "${person.gender}", ` +
      `relation: "${esc(person.relation)}", fatherId: ${fid}, motherId: ${mid}, ` +
      `spouses: [], notes: "${esc(person.notes)}" },\r\n`;
    const idx = raw.lastIndexOf('  ],');
    if (idx === -1) throw new Error('Cannot find people array end');
    return raw.slice(0, idx) + line + raw.slice(idx);
  };
}

/** Push a child ID into a spouse's childrenIds array. */
function mutatePushChildId(spouseId, childId) {
  return (raw) => {
    const needle = `id: "${spouseId}"`;
    const pos = raw.indexOf(needle);
    if (pos === -1) throw new Error('Spouse ' + spouseId + ' not found');
    const tag = 'childrenIds: [';
    const cidStart = raw.indexOf(tag, pos);
    if (cidStart === -1) throw new Error('childrenIds not found for ' + spouseId);
    const open = cidStart + tag.length;
    const close = raw.indexOf(']', open);
    if (close === -1) throw new Error('Malformed childrenIds');
    const existing = raw.substring(open, close).trim();
    const updated = existing ? `${existing}, "${childId}"` : `"${childId}"`;
    return raw.slice(0, open) + updated + raw.slice(close);
  };
}

function spouseChildrenText(childrenIds) {
  const ids = childrenIds || [];
  return ids.length ? ids.map(c => `"${c}"`).join(', ') : '';
}

function spouseToText(s) {
  const cids = spouseChildrenText(s.childrenIds);
  if (s.type === 'external') {
    return `{ id: "${s.id}", type: "external", name: "${esc(s.name || '')}", label: "${esc(s.label)}", childrenIds: [${cids}] }`;
  }
  return `{ id: "${s.id}", type: "linked", name: "", personId: "${s.personId}", label: "${esc(s.label)}", childrenIds: [${cids}] }`;
}

/** Insert a new Spouse entry into a person's spouses array. */
function mutateInsertSpouse(personId, spouse) {
  return (raw) => {
    const needle = `id: "${personId}"`;
    const pos = raw.indexOf(needle);
    if (pos === -1) throw new Error('Person ' + personId + ' not found');
    const tag = 'spouses: [';
    const spStart = raw.indexOf(tag, pos);
    if (spStart === -1) throw new Error('spouses not found for ' + personId);
    const open = spStart + tag.length;
    let depth = 1, i = open;
    while (i < raw.length && depth > 0) {
      if (raw[i] === '[') depth++;
      if (raw[i] === ']') depth--;
      if (depth > 0) i++;
    }
    const close = i;
    const sp = spouseToText(spouse);
    const inside = raw.substring(open, close).trim();
    if (inside === '') {
      return raw.slice(0, open) + sp + raw.slice(close);
    }
    // Find the last '}' before close to insert after it (avoids orphan comma)
    let lastBrace = close - 1;
    while (lastBrace > open && raw[lastBrace] !== '}') lastBrace--;
    if (lastBrace <= open) {
      // Fallback: insert before close
      return raw.slice(0, close) + ', ' + sp + raw.slice(close);
    }
    return raw.slice(0, lastBrace + 1) + ', ' + sp + raw.slice(lastBrace + 1);
  };
}

/** Replace childrenIds for a specific spouse entry. */
function mutateSetSpouseChildrenIds(spouseId, childrenIds) {
  return (raw) => {
    const needle = `id: "${spouseId}"`;
    const pos = raw.indexOf(needle);
    if (pos === -1) throw new Error('Spouse ' + spouseId + ' not found');
    const tag = 'childrenIds: [';
    const cidStart = raw.indexOf(tag, pos);
    if (cidStart === -1) throw new Error('childrenIds not found for ' + spouseId);
    const open = cidStart + tag.length;
    const close = raw.indexOf(']', open);
    if (close === -1) throw new Error('Malformed childrenIds');
    const unique = dedupeChildIds(childrenIds);
    return raw.slice(0, open) + spouseChildrenText(unique) + raw.slice(close);
  };
}

/** Convert an external spouse entry to linked, preserving id/label/childrenIds. */
function mutateConvertExternalToLinked(personId, spouseId, linkedPersonId) {
  return (raw) => {
    const data = parseRaw(raw);
    const person = data.people.find(p => p.id === personId);
    if (!person) throw new Error('Person not found');
    const sp = person.spouses.find(s => s.id === spouseId);
    if (!sp || sp.type !== 'external') throw new Error('External spouse not found');
    const updated = person.spouses.map(s => {
      if (s.id !== spouseId) return s;
      return {
        id: s.id,
        type: 'linked',
        name: '',
        personId: linkedPersonId,
        label: s.label,
        childrenIds: [...s.childrenIds],
      };
    });
    return mutateRebuildPersonSpouses(personId, updated)(raw);
  };
}

/** Rebuild a person's entire spouses array from parsed spouse objects. */
function mutateRebuildPersonSpouses(personId, spouses) {
  return (raw) => {
    const personNeedle = `id: "${personId}"`;
    const personPos = raw.indexOf(personNeedle);
    if (personPos === -1) throw new Error('Person not found');
    const spTag = 'spouses: [';
    const spStart = raw.indexOf(spTag, personPos);
    if (spStart === -1) throw new Error('spouses not found');
    const open = spStart + spTag.length;
    let depth = 1, i = open;
    while (i < raw.length && depth > 0) {
      if (raw[i] === '[') depth++;
      if (raw[i] === ']') depth--;
      if (depth > 0) i++;
    }
    const close = i;
    const newContent = spouses.map(spouseToText).join(', ');
    return raw.slice(0, open) + newContent + raw.slice(close);
  };
}

/** Remove a person entry from the people array. */
function mutateRemovePerson(personId) {
  return (raw) => {
    const needle = `id: "${personId}"`;
    const idPos = raw.indexOf(needle);
    if (idPos === -1) throw new Error('Person not found: ' + personId);

    // Verify this is a person entry (not a spouse) by checking context
    // Person entries have gender field nearby, spouse entries don't always
    let braceStart = idPos;
    while (braceStart > 0 && raw[braceStart] !== '{') braceStart--;

    let lineStart = braceStart;
    while (lineStart > 0 && raw[lineStart - 1] !== '\n') lineStart--;

    // Count braces to find matching }
    let depth = 0, pos = braceStart;
    while (pos < raw.length) {
      if (raw[pos] === '{') depth++;
      if (raw[pos] === '}') { depth--; if (depth === 0) break; }
      pos++;
    }
    let end = pos + 1;
    if (end < raw.length && raw[end] === ',') end++;
    while (end < raw.length && (raw[end] === ' ' || raw[end] === '\t')) end++;
    if (end < raw.length && raw[end] === '\r') end++;
    if (end < raw.length && raw[end] === '\n') end++;

    return raw.slice(0, lineStart) + raw.slice(end);
  };
}

/** Remove a child ID from ALL childrenIds arrays where it appears. */
function mutateRemoveFromAllChildrenIds(childId) {
  return (raw) => {
    let result = raw;
    const cidTag = 'childrenIds: [';
    let changed = true;
    while (changed) {
      changed = false;
      let searchPos = 0;
      while (true) {
        const cidStart = result.indexOf(cidTag, searchPos);
        if (cidStart === -1) break;
        const open = cidStart + cidTag.length;
        const close = result.indexOf(']', open);
        if (close === -1) break;
        const content = result.substring(open, close);
        if (content.includes(`"${childId}"`)) {
          const ids = content.match(/"[^"]+"/g) || [];
          const filtered = ids.filter(id => id !== `"${childId}"`);
          const newContent = filtered.join(', ');
          result = result.slice(0, open) + newContent + result.slice(close);
          changed = true;
          break;
        }
        searchPos = close + 1;
      }
    }
    return result;
  };
}

/** Remove a child ID from a specific spouse's childrenIds. */
function mutateRemoveChildId(spouseId, childId) {
  return (raw) => {
    const needle = `id: "${spouseId}"`;
    const pos = raw.indexOf(needle);
    if (pos === -1) throw new Error('Spouse not found: ' + spouseId);
    const tag = 'childrenIds: [';
    const cidStart = raw.indexOf(tag, pos);
    if (cidStart === -1) throw new Error('childrenIds not found');
    const open = cidStart + tag.length;
    const close = raw.indexOf(']', open);
    if (close === -1) throw new Error('Malformed childrenIds');
    const content = raw.substring(open, close);
    const ids = content.match(/"[^"]+"/g) || [];
    const filtered = ids.filter(id => id !== `"${childId}"`);
    return raw.slice(0, open) + filtered.join(', ') + raw.slice(close);
  };
}

/** Remove a spouse entry from a person's spouses array. Rebuilds the array content. */
function mutateRemoveSpouseEntry(personId, spouseId) {
  return (raw) => {
    const data = parseRaw(raw);
    const person = data.people.find(p => p.id === personId);
    if (!person) throw new Error('Person not found');
    const remaining = person.spouses.filter(s => s.id !== spouseId);

    // Find the spouses array in raw text
    const personNeedle = `id: "${personId}"`;
    const personPos = raw.indexOf(personNeedle);
    const spTag = 'spouses: [';
    const spStart = raw.indexOf(spTag, personPos);
    if (spStart === -1) throw new Error('spouses not found');
    const open = spStart + spTag.length;
    let depth = 1, i = open;
    while (i < raw.length && depth > 0) {
      if (raw[i] === '[') depth++;
      if (raw[i] === ']') depth--;
      if (depth > 0) i++;
    }
    const close = i;

    // Rebuild content
    const newContent = remaining.map(s => {
      if (s.type === 'external') {
        return `{ id: "${s.id}", type: "external", name: "${esc(s.name || '')}", label: "${esc(s.label)}", childrenIds: [${s.childrenIds.map(c => `"${c}"`).join(', ')}] }`;
      } else {
        return `{ id: "${s.id}", type: "linked", name: "${esc(s.name || '')}", personId: "${s.personId}", label: "${esc(s.label)}", childrenIds: [${s.childrenIds.map(c => `"${c}"`).join(', ')}] }`;
      }
    }).join(', ');

    return raw.slice(0, open) + newContent + raw.slice(close);
  };
}

// ─── Spouse Linking Helpers ────────────────────────────────

/** Normalize Arabic name for comparison (strip patronymic, diacritics). */
function normalizeArabicName(name) {
  return (name || '')
    .replace(/[\u064B-\u065F\u0670]/g, '') // Strip diacritics
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ بنت /g, ' ') // Strip patronymic
    .replace(/ ابن /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detect existing linked spouse relationship between two people. */
function detectExistingRelationship(data, personAId, personBId) {
  const personA = data.people.find(p => p.id === personAId);
  const personB = data.people.find(p => p.id === personBId);
  if (!personA || !personB) return null;

  // Check A → B
  const aToB = personA.spouses.find(s => s.type === 'linked' && s.personId === personBId);
  // Check B → A
  const bToA = personB.spouses.find(s => s.type === 'linked' && s.personId === personAId);

  return { aToB, bToA };
}

/** Get direct children from spouse entries (not recursive). */
function getDirectChildren(data, spouseEntry) {
  if (!spouseEntry || !spouseEntry.childrenIds) return [];
  return spouseEntry.childrenIds
    .map(cid => data.people.find(p => p.id === cid))
    .filter(Boolean);
}

/** Recursively count descendants of a person. */
function countDescendants(data, personId, visited = new Set()) {
  if (visited.has(personId)) return 0;
  visited.add(personId);

  const person = data.people.find(p => p.id === personId);
  if (!person) return 0;

  let count = 0;
  for (const spouse of person.spouses) {
    for (const childId of spouse.childrenIds) {
      count++;
      count += countDescendants(data, childId, visited);
    }
  }
  return count;
}

/** Deduplicate child IDs, preserving order. */
function dedupeChildIds(ids) {
  const seen = new Set();
  return ids.filter(id => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Find external spouses that match a person by name (for conversion detection). */
function findMatchingExternalSpouses(data, ownerPersonId, targetPerson) {
  const owner = data.people.find(p => p.id === ownerPersonId);
  if (!owner) return [];

  const targetNorm = normalizeArabicName(targetPerson.name);
  const matches = [];

  for (const spouse of owner.spouses) {
    if (spouse.type === 'external') {
      const spouseNorm = normalizeArabicName(spouse.name);
      if (spouseNorm === targetNorm) {
        matches.push(spouse);
      }
    }
  }

  return matches;
}

// ─── Validation Helpers ─────────────────────────────────────

/** Check if a person can be safely deleted. Returns { ok, reason, details }. */
function checkCanDelete(data, personId) {
  const person = data.people.find(p => p.id === personId);
  if (!person) return { ok: false, reason: 'الشخص غير موجود' };

  if (data.rootPersonId === personId) {
    return { ok: false, reason: 'لا يمكن حذف الجد الأكبر (أصل الشجرة)' };
  }

  if (person.spouses.length > 0) {
    return {
      ok: false,
      reason: `هذا الشخص لديه ${person.spouses.length} زيجة مسجلة`,
      details: { spouses: person.spouses.length },
    };
  }

  // Check if anyone references this person as father
  const asfather = data.people.filter(p => p.fatherId === personId);
  if (asfather.length > 0) {
    return {
      ok: false,
      reason: `هذا الشخص مسجّل كأب لـ ${asfather.length} شخص`,
      details: { children: asfather.map(p => p.name) },
    };
  }

  // Check as mother
  const asmother = data.people.filter(p => p.motherId === personId);
  if (asmother.length > 0) {
    return {
      ok: false,
      reason: `هذا الشخص مسجّل كأم لـ ${asmother.length} شخص`,
      details: { children: asmother.map(p => p.name) },
    };
  }

  // Check linked spouses referencing this person
  for (const p of data.people) {
    for (const s of p.spouses) {
      if (s.type === 'linked' && s.personId === personId) {
        return {
          ok: false,
          reason: `هذا الشخص مسجّل كزوج/ة لـ ${p.name}`,
          details: { linkedTo: p.name },
        };
      }
    }
  }

  return { ok: true };
}

// ─── Analyze Spouse Link (read-only analysis) ──────────

/** Count descendants from specific childrenIds (per-marriage, not per-person). */
function countDescendantsFromChildren(data, childIds, visited = new Set()) {
  let count = 0;
  for (const cid of childIds) {
    if (visited.has(cid)) continue;
    visited.add(cid);
    count++; // the child itself
    count += countDescendants(data, cid, visited);
  }
  return count;
}

/**
 * Analyzes a potential spouse link between two existing people.
 * Returns relationship state, existing children, conflicts, external spouse candidates.
 * Does NOT mutate data.
 */
function analyzeSpouseLink(data, ownerPersonId, selectedSpousePersonId) {
  const owner = data.people.find(p => p.id === ownerPersonId);
  const spouse = data.people.find(p => p.id === selectedSpousePersonId);

  if (!owner || !spouse) {
    return { error: 'أحد الأشخاص غير موجود' };
  }

  if (ownerPersonId === selectedSpousePersonId) {
    return { error: 'لا يمكن ربط الشخص بنفسه' };
  }

  // Detect existing relationship
  const existing = detectExistingRelationship(data, ownerPersonId, selectedSpousePersonId);

  // Find external spouses that match — bidirectional
  const externalMatchesOnOwner = findMatchingExternalSpouses(data, ownerPersonId, spouse);
  const externalMatchesOnSpouse = findMatchingExternalSpouses(data, selectedSpousePersonId, owner);

  // Pick the best external match (prefer the one with children)
  let bestExternal = null;
  let bestExternalSide = null; // 'owner' or 'spouse'
  if (externalMatchesOnOwner.length > 0) {
    bestExternal = externalMatchesOnOwner[0];
    bestExternalSide = 'owner';
  }
  if (externalMatchesOnSpouse.length > 0) {
    const spMatch = externalMatchesOnSpouse[0];
    if (!bestExternal || (spMatch.childrenIds.length > (bestExternal.childrenIds || []).length)) {
      bestExternal = spMatch;
      bestExternalSide = 'spouse';
    }
  }

  // Get children from each side
  let ownerChildren = [];
  let spouseChildren = [];
  let externalChildren = [];
  let ownerChildIds = [];
  let spouseChildIds = [];

  if (existing.aToB) {
    ownerChildren = getDirectChildren(data, existing.aToB);
    ownerChildIds = existing.aToB.childrenIds || [];
  }
  if (existing.bToA) {
    spouseChildren = getDirectChildren(data, existing.bToA);
    spouseChildIds = existing.bToA.childrenIds || [];
  }
  if (bestExternal) {
    externalChildren = getDirectChildren(data, bestExternal);
  }

  // Determine relationship state
  let state = 'none';
  if (existing.aToB && existing.bToA) {
    state = 'both-sided';
  } else if (existing.aToB) {
    state = 'one-sided-owner';
  } else if (existing.bToA) {
    state = 'one-sided-spouse';
  } else if (bestExternal) {
    state = 'external-conversion';
  }

  // Detect conflicts (different children on each side)
  let conflict = false;
  let conflictDetails = null;
  if (state === 'both-sided') {
    const ownerIdSet = new Set(ownerChildIds);
    const spouseIdSet = new Set(spouseChildIds);
    const sameSize = ownerIdSet.size === spouseIdSet.size;
    const allMatch = sameSize && [...ownerIdSet].every(id => spouseIdSet.has(id));
    if (!allMatch) {
      // Check if one side is empty (Case F) vs truly different (Case H)
      if (ownerIdSet.size === 0 || spouseIdSet.size === 0) {
        conflict = false; // Case F: one side empty, auto-sync
      } else {
        conflict = true; // Case H: real conflict
        conflictDetails = {
          ownerOnly: [...ownerIdSet].filter(id => !spouseIdSet.has(id)).map(id => {
            const c = data.people.find(p => p.id === id);
            return c ? { id: c.id, name: c.name } : { id, name: id };
          }),
          spouseOnly: [...spouseIdSet].filter(id => !ownerIdSet.has(id)).map(id => {
            const c = data.people.find(p => p.id === id);
            return c ? { id: c.id, name: c.name } : { id, name: id };
          }),
          shared: [...ownerIdSet].filter(id => spouseIdSet.has(id)).map(id => {
            const c = data.people.find(p => p.id === id);
            return c ? { id: c.id, name: c.name } : { id, name: id };
          }),
        };
      }
    }
  }

  // Count descendants per-marriage (not per-person)
  const allChildIds = dedupeChildIds([...ownerChildIds, ...spouseChildIds]);
  const marriageDescendants = allChildIds.length > 0
    ? countDescendantsFromChildren(data, allChildIds)
    : 0;

  // Determine the resolved action
  let resolvedAction = 'create_new_relationship';
  if (state === 'both-sided' && !conflict) resolvedAction = 'reuse_existing_relationship';
  else if (state === 'both-sided' && conflict) resolvedAction = 'resolve_children_conflict';
  else if (state === 'one-sided-owner') resolvedAction = 'complete_missing_reciprocal';
  else if (state === 'one-sided-spouse') resolvedAction = 'complete_missing_reciprocal';
  else if (state === 'external-conversion') resolvedAction = 'convert_external_to_linked';

  // Check for Case F: both-sided but one side has empty children
  if (state === 'both-sided' && !conflict && ownerChildIds.length !== spouseChildIds.length) {
    resolvedAction = 'synchronize_children';
  }

  return {
    state,
    resolvedAction,
    owner: {
      id: owner.id,
      name: owner.name,
      gender: owner.gender,
      childrenCount: ownerChildren.length,
      children: ownerChildren.map(c => ({ id: c.id, name: c.name, gender: c.gender })),
      childIds: ownerChildIds,
    },
    spouse: {
      id: spouse.id,
      name: spouse.name,
      gender: spouse.gender,
      childrenCount: spouseChildren.length,
      children: spouseChildren.map(c => ({ id: c.id, name: c.name, gender: c.gender })),
      childIds: spouseChildIds,
    },
    marriageDescendants,
    external: bestExternal ? {
      spouseId: bestExternal.id,
      name: bestExternal.name,
      label: bestExternal.label,
      side: bestExternalSide,
      ownerPersonId: bestExternalSide === 'owner' ? ownerPersonId : selectedSpousePersonId,
      childrenCount: externalChildren.length,
      children: externalChildren.map(c => ({ id: c.id, name: c.name, gender: c.gender })),
      childIds: bestExternal.childrenIds || [],
    } : null,
    conflict,
    conflictDetails,
    existingSpouseEntry: existing.aToB ? {
      id: existing.aToB.id,
      label: existing.aToB.label,
      childIds: existing.aToB.childrenIds || [],
    } : null,
    reverseSpouseEntry: existing.bToA ? {
      id: existing.bToA.id,
      label: existing.bToA.label,
      childIds: existing.bToA.childrenIds || [],
    } : null,
  };
}

// ─── HTTP Server ────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ── Serve admin page ──
    if (url.pathname === '/' && req.method === 'GET') {
      const html = readFileSync(ADMIN_HTML, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // ── GET /api/data ──
    if (url.pathname === '/api/data' && req.method === 'GET') {
      return json(res, 200, readData());
    }

    // ── GET /api/undo-status ──
    if (url.pathname === '/api/undo-status' && req.method === 'GET') {
      const bp = getLatestBackup();
      return json(res, 200, { available: !!bp });
    }

    // ── POST /api/add-child ──
    if (url.pathname === '/api/add-child' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.name?.trim()) return json(res, 400, { error: 'الاسم مطلوب' });
      if (!b.gender)        return json(res, 400, { error: 'الجنس مطلوب' });
      if (!b.parentId)      return json(res, 400, { error: 'الوالد مطلوب' });
      if (!b.spouseId)      return json(res, 400, { error: 'الزيجة مطلوبة' });

      const data = readData();
      const parent = data.people.find(p => p.id === b.parentId);
      if (!parent) return json(res, 400, { error: 'الوالد غير موجود' });
      const sp = parent.spouses.find(s => s.id === b.spouseId);
      if (!sp) return json(res, 400, { error: 'الزيجة غير موجودة' });

      const childId = nextPersonId(data.people);

      let fatherId = null, motherId = null;
      if (parent.gender === 'male') {
        fatherId = b.parentId;
        if (sp.type === 'linked' && sp.personId) motherId = sp.personId;
      } else {
        motherId = b.parentId;
        if (sp.type === 'linked' && sp.personId) fatherId = sp.personId;
      }

      console.log(`  + add-child: "${b.name.trim()}" → ${childId}`);

      // Build mutations
      const addChildMutations = [
        mutatePushPerson({
          id: childId,
          name: b.name.trim(),
          gender: b.gender,
          relation: '',
          fatherId,
          motherId,
          notes: (b.notes || '').trim(),
        }),
        mutatePushChildId(b.spouseId, childId),
      ];

      // ── مزامنة تلقائية: إذا كانت الزيجة linked، نضيف الابن عند الطرف الآخر أيضاً ──
      if (sp.type === 'linked' && sp.personId) {
        const otherParent = data.people.find(p => p.id === sp.personId);
        if (otherParent) {
          // ابحث عن spouse entry عند الطرف الآخر المرتبط بالوالد الحالي
          const reverseSpouseEntry = otherParent.spouses.find(
            s => s.type === 'linked' && s.personId === b.parentId
          );
          if (reverseSpouseEntry) {
            // أضف الابن في childrenIds عند الطرف الآخر
            addChildMutations.push(mutatePushChildId(reverseSpouseEntry.id, childId));
            console.log(`    ↳ مزامنة تلقائية: إضافة ${childId} عند ${otherParent.name} (${reverseSpouseEntry.id})`);
          } else {
            // الطرف الآخر ليس لديه spouse entry مرتبط — ننشئ واحد (حالة نادرة)
            console.log(`    ⚠ الطرف الآخر (${otherParent.name}) ليس لديه ربط عكسي — لا يمكن المزامنة التلقائية`);
          }
        }
      }

      safeOp(...addChildMutations);

      return json(res, 200, {
        success: true,
        id: childId,
        message: `تمت إضافة "${b.name.trim()}" بنجاح`,
      });
    }

    // ── POST /api/analyze-spouse-link ──
    if (url.pathname === '/api/analyze-spouse-link' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.ownerPersonId) return json(res, 400, { error: 'الشخص الأول مطلوب' });
      if (!b.selectedSpousePersonId) return json(res, 400, { error: 'الشخص الثاني مطلوب' });

      const data = readData();
      const analysis = analyzeSpouseLink(data, b.ownerPersonId, b.selectedSpousePersonId);

      if (analysis.error) {
        return json(res, 400, { error: analysis.error });
      }

      return json(res, 200, analysis);
    }

    // ── POST /api/link-existing-family ──
    if (url.pathname === '/api/link-existing-family' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.ownerPersonId) return json(res, 400, { error: 'الشخص الأول مطلوب' });
      if (!b.selectedSpousePersonId) return json(res, 400, { error: 'الشخص الثاني مطلوب' });
      if (!b.label) return json(res, 400, { error: 'التسمية مطلوبة' });

      const data = readData();
      
      // Validate no self-marriage
      if (b.ownerPersonId === b.selectedSpousePersonId) {
        return json(res, 400, { error: 'لا يمكن ربط الشخص بنفسه' });
      }

      const owner = data.people.find(p => p.id === b.ownerPersonId);
      const spouse = data.people.find(p => p.id === b.selectedSpousePersonId);
      if (!owner || !spouse) {
        return json(res, 400, { error: 'أحد الأشخاص غير موجود' });
      }

      // Prevent duplicate linked spouse
      const existingLinkedA = owner.spouses.find(s => s.type === 'linked' && s.personId === b.selectedSpousePersonId);
      const existingLinkedB = spouse.spouses.find(s => s.type === 'linked' && s.personId === b.ownerPersonId);

      const analysis = analyzeSpouseLink(data, b.ownerPersonId, b.selectedSpousePersonId);
      const state = analysis.state;
      const resolvedAction = b.action || analysis.resolvedAction;

      console.log(`  + link-existing-family: ${owner.name} ↔ ${spouse.name} (state: ${state}, action: ${resolvedAction})`);

      // Determine what to do based on state and action
      const mutations = [];
      let resultChildIds = [];
      let resultMessage = '';

      if (state === 'both-sided') {
        if (resolvedAction === 'synchronize_children' || resolvedAction === 'synchronize') {
          // Case F or G: Synchronize children between sides
          const ownerChildIds = existingLinkedA ? (existingLinkedA.childrenIds || []) : [];
          const spouseChildIds = existingLinkedB ? (existingLinkedB.childrenIds || []) : [];
          
          // Use provided childrenIds or merge both sides
          let finalChildIds;
          if (b.childrenIds && Array.isArray(b.childrenIds)) {
            finalChildIds = dedupeChildIds(b.childrenIds);
          } else {
            // Auto-merge: combine both sides, dedup
            finalChildIds = dedupeChildIds([...ownerChildIds, ...spouseChildIds]);
          }
          
          // Validate all child IDs exist
          const invalidIds = finalChildIds.filter(cid => !data.people.find(p => p.id === cid));
          if (invalidIds.length > 0) {
            return json(res, 400, { error: `أبناء غير موجودين: ${invalidIds.join(', ')}` });
          }

          if (existingLinkedA) mutations.push(mutateSetSpouseChildrenIds(existingLinkedA.id, finalChildIds));
          if (existingLinkedB) mutations.push(mutateSetSpouseChildrenIds(existingLinkedB.id, finalChildIds));
          
          resultChildIds = finalChildIds;
          resultMessage = 'تم مزامنة الأبناء بنجاح';

        } else if (resolvedAction === 'resolve_children_conflict') {
          // Case H: Conflict resolution — childrenIds must be provided by client
          if (!b.childrenIds || !Array.isArray(b.childrenIds)) {
            return json(res, 400, { error: 'يجب تحديد قائمة الأبناء لحل التعارض' });
          }
          const finalChildIds = dedupeChildIds(b.childrenIds);
          
          // Validate
          const invalidIds = finalChildIds.filter(cid => !data.people.find(p => p.id === cid));
          if (invalidIds.length > 0) {
            return json(res, 400, { error: `أبناء غير موجودين: ${invalidIds.join(', ')}` });
          }

          if (existingLinkedA) mutations.push(mutateSetSpouseChildrenIds(existingLinkedA.id, finalChildIds));
          if (existingLinkedB) mutations.push(mutateSetSpouseChildrenIds(existingLinkedB.id, finalChildIds));
          
          resultChildIds = finalChildIds;
          resultMessage = 'تم حل التعارض ومزامنة الأبناء بنجاح';

        } else {
          // reuse_existing_relationship — already correctly linked
          return json(res, 200, {
            success: true,
            message: 'هذه العلاقة موجودة بالفعل داخل الشجرة',
            alreadyLinked: true,
            childrenCount: (existingLinkedA?.childrenIds || []).length,
          });
        }

      } else if (state === 'external-conversion') {
        // Case E: Convert external spouse to linked
        if (!b.convertExternal) {
          return json(res, 400, { error: 'يجب تأكيد تحويل الزوج/ة الخارجي/ة' });
        }

        const extSide = analysis.external.side; // 'owner' or 'spouse'
        const extOwnerPersonId = analysis.external.ownerPersonId;
        const extSpouseId = analysis.external.spouseId;
        const extChildIds = analysis.external.childIds || [];
        
        const extOwner = data.people.find(p => p.id === extOwnerPersonId);
        const extTarget = extOwnerPersonId === b.ownerPersonId ? b.selectedSpousePersonId : b.ownerPersonId;
        
        // Convert external → linked
        mutations.push(mutateConvertExternalToLinked(extOwnerPersonId, extSpouseId, extTarget));
        
        // Create reciprocal entry if missing
        const targetPerson = data.people.find(p => p.id === extTarget);
        const reverseExists = targetPerson?.spouses.find(s => s.type === 'linked' && s.personId === extOwnerPersonId);
        
        if (!reverseExists) {
          const sid = nextSpouseId(data.people);
          const reverseLabel = extOwner.gender === 'male' ? 'الزوج' : 'الزوجة';
          mutations.push(mutateInsertSpouse(extTarget, {
            id: sid,
            type: 'linked',
            personId: extOwnerPersonId,
            label: reverseLabel,
            childrenIds: extChildIds,
          }));
        } else if (reverseExists.childrenIds.length === 0 && extChildIds.length > 0) {
          // Sync children to the reverse side
          mutations.push(mutateSetSpouseChildrenIds(reverseExists.id, extChildIds));
        }
        
        resultChildIds = extChildIds;
        resultMessage = 'تم تحويل الزوج/ة الخارجي/ة وربط الأسرة الموجودة بنجاح';

      } else if (state === 'one-sided-owner') {
        // Case B: Relationship exists on owner only — complete reciprocal
        const childIds = existingLinkedA.childrenIds || [];
        const sid = nextSpouseId(data.people);
        const reverseLabel = owner.gender === 'male' ? 'الزوج' : 'الزوجة';
        
        mutations.push(mutateInsertSpouse(b.selectedSpousePersonId, {
          id: sid,
          type: 'linked',
          personId: b.ownerPersonId,
          label: reverseLabel,
          childrenIds: childIds,
        }));
        
        resultChildIds = childIds;
        resultMessage = 'تم إكمال الربط من الجهة الأخرى واستخدام الأبناء المسجلين بالفعل';

      } else if (state === 'one-sided-spouse') {
        // Case C: Relationship exists on spouse only — complete on owner side
        const childIds = existingLinkedB.childrenIds || [];
        const sid = nextSpouseId(data.people);
        
        mutations.push(mutateInsertSpouse(b.ownerPersonId, {
          id: sid,
          type: 'linked',
          personId: b.selectedSpousePersonId,
          label: b.label,
          childrenIds: childIds,
        }));
        
        resultChildIds = childIds;
        resultMessage = 'تم إكمال الربط واستخدام الأبناء المسجلين بالفعل';

      } else {
        // Case A: No relationship — create new
        // Generate both spouse IDs upfront to avoid reading data between mutations
        let maxSid = 0;
        for (const p of data.people) {
          for (const s of p.spouses) {
            const n = parseInt(s.id.slice(1));
            if (n > maxSid) maxSid = n;
          }
        }
        const sid1 = 's' + String(maxSid + 1).padStart(3, '0');
        const sid2 = 's' + String(maxSid + 2).padStart(3, '0');
        
        const reverseLabel = owner.gender === 'male' ? 'الزوج' : 'الزوجة';
        
        mutations.push(mutateInsertSpouse(b.ownerPersonId, {
          id: sid1,
          type: 'linked',
          personId: b.selectedSpousePersonId,
          label: b.label,
          childrenIds: [],
        }));
        
        mutations.push(mutateInsertSpouse(b.selectedSpousePersonId, {
          id: sid2,
          type: 'linked',
          personId: b.ownerPersonId,
          label: reverseLabel,
          childrenIds: [],
        }));
        
        resultChildIds = [];
        resultMessage = 'تم إنشاء علاقة زواج جديدة بنجاح';
      }

      // Apply mutations atomically
      if (mutations.length > 0) {
        safeOp(...mutations);
      }

      // Post-write validation
      const finalData = readData();
      const finalOwner = finalData.people.find(p => p.id === b.ownerPersonId);
      const finalSpouse = finalData.people.find(p => p.id === b.selectedSpousePersonId);
      
      // Verify no duplicate linked spouse entries
      if (finalOwner) {
        const linkedToSpouse = finalOwner.spouses.filter(s => s.type === 'linked' && s.personId === b.selectedSpousePersonId);
        if (linkedToSpouse.length > 1) {
          console.warn(`  ⚠ Duplicate linked spouse detected on ${finalOwner.name} — manual review needed`);
        }
      }

      // Resolve child display names for the response
      const resultChildren = resultChildIds
        .map(cid => finalData.people.find(p => p.id === cid))
        .filter(Boolean)
        .map(c => ({ id: c.id, name: c.name }));

      // Count total descendants from direct children
      const descendantsCount = resultChildIds.length > 0
        ? countDescendantsFromChildren(finalData, resultChildIds) - resultChildIds.length
        : 0;

      return json(res, 200, {
        success: true,
        message: resultMessage,
        state,
        resolvedAction,
        childrenCount: resultChildIds.length,
        children: resultChildren,
        descendantsCount,
      });
    }

    // ── POST /api/add-spouse ──
    if (url.pathname === '/api/add-spouse' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId)      return json(res, 400, { error: 'الشخص مطلوب' });
      if (!b.type)          return json(res, 400, { error: 'نوع الزوج مطلوب' });
      if (!b.label?.trim()) return json(res, 400, { error: 'التسمية مطلوبة' });
      if (b.type === 'external' && !b.name?.trim())
        return json(res, 400, { error: 'اسم الزوج/ة مطلوب' });
      if (b.type === 'linked' && !b.linkedPersonId)
        return json(res, 400, { error: 'الشخص المرتبط مطلوب' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });

      const sid = nextSpouseId(data.people);

      if (b.type === 'external') {
        console.log(`  + add-spouse (external): "${b.name.trim()}" → ${person.name}`);
        safeOp(
          mutateInsertSpouse(b.personId, {
            id: sid, type: 'external', name: b.name.trim(), label: b.label.trim(),
          }),
        );
      } else {
        console.log(`  + add-spouse (linked): ${b.linkedPersonId} → ${person.name}`);
        // Need sid2 for reverse link — compute after first mutation
        safeOp(
          mutateInsertSpouse(b.personId, {
            id: sid, type: 'linked', personId: b.linkedPersonId, label: b.label.trim(),
          }),
        );
        // Reverse link (separate safeOp because we need updated data for next ID)
        const data2 = readData();
        const sid2 = nextSpouseId(data2.people);
        const reverseLabel = person.gender === 'male' ? 'الزوج' : 'الزوجة';
        // Don't backup again — already backed up
        let raw = readRaw();
        raw = mutateInsertSpouse(b.linkedPersonId, {
          id: sid2, type: 'linked', personId: b.personId, label: reverseLabel,
        })(raw);
        if (!validateRaw(raw)) throw new Error('Failed to validate reverse link');
        writeFileSync(DATA_FILE, raw, 'utf-8');
      }

      return json(res, 200, {
        success: true,
        message: 'تمت إضافة الزوج/ة بنجاح',
      });
    }

    // ── POST /api/add-person ──
    if (url.pathname === '/api/add-person' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.name?.trim()) return json(res, 400, { error: 'الاسم مطلوب' });
      if (!b.gender)       return json(res, 400, { error: 'الجنس مطلوب' });

      const data = readData();
      const pid = nextPersonId(data.people);

      console.log(`  + add-person: "${b.name.trim()}" → ${pid}`);
      safeOp(
        mutatePushPerson({
          id: pid,
          name: b.name.trim(),
          gender: b.gender,
          relation: '',
          fatherId: null,
          motherId: null,
          notes: (b.notes || '').trim(),
        }),
      );

      return json(res, 200, {
        success: true,
        id: pid,
        message: `تمت إضافة "${b.name.trim()}" بنجاح`,
      });
    }

    // ── POST /api/check-delete ──
    if (url.pathname === '/api/check-delete' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });
      const data = readData();
      const result = checkCanDelete(data, b.personId);
      return json(res, 200, result);
    }

    // ── POST /api/edit-person ──
    if (url.pathname === '/api/edit-person' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });
      if (!b.name?.trim()) return json(res, 400, { error: 'الاسم مطلوب' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });

      const oldName = person.name;
      const newName = b.name.trim();
      const newGender = b.gender || person.gender;
      const newNotes = b.notes !== undefined ? b.notes : person.notes;

      console.log(`  ✏ edit-person: "${oldName}" → "${newName}" (${b.personId})`);

      safeOp((raw) => {
        const needle = `id: "${b.personId}"`;
        const pos = raw.indexOf(needle);
        if (pos === -1) throw new Error('Person not found');

        // Find name field within 200 chars after the id
        const region = raw.substring(pos, pos + 300);
        const nameMatch = region.match(/name:\s*"/);
        if (!nameMatch) throw new Error('name field not found');
        const nameStart = pos + nameMatch.index + nameMatch[0].length;
        const nameEnd = raw.indexOf('"', nameStart);
        let result = raw.slice(0, nameStart) + esc(newName) + raw.slice(nameEnd);

        // Replace gender if changed
        if (newGender !== person.gender) {
          const newPos = result.indexOf(`id: "${b.personId}"`);
          const gRegion = result.substring(newPos, newPos + 300);
          const gMatch = gRegion.match(/gender:\s*"/);
          if (gMatch) {
            const gStart = newPos + gMatch.index + gMatch[0].length;
            const gEnd = result.indexOf('"', gStart);
            result = result.slice(0, gStart) + newGender + result.slice(gEnd);
          }
        }

        // Replace notes if changed
        if (newNotes !== person.notes) {
          const nPos = result.indexOf(`id: "${b.personId}"`);
          const nRegion = result.substring(nPos, nPos + 500);
          const nMatch = nRegion.match(/notes:\s*"/);
          if (nMatch) {
            const nStart = nPos + nMatch.index + nMatch[0].length;
            const nEnd = result.indexOf('"', nStart);
            result = result.slice(0, nStart) + esc(newNotes) + result.slice(nEnd);
          }
        }

        return result;
      });

      return json(res, 200, {
        success: true,
        message: `تم تعديل "${oldName}" إلى "${newName}" بنجاح`,
      });
    }

    // ── POST /api/delete-person ──
    if (url.pathname === '/api/delete-person' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });

      const check = checkCanDelete(data, b.personId);
      if (!check.ok) return json(res, 400, { error: check.reason });

      console.log(`  - delete-person: "${person.name}" (${b.personId})`);
      safeOp(
        mutateRemoveFromAllChildrenIds(b.personId),
        mutateRemovePerson(b.personId),
      );

      return json(res, 200, {
        success: true,
        message: `تم حذف "${person.name}" بنجاح`,
      });
    }

    // ── POST /api/edit-spouse ──
    if (url.pathname === '/api/edit-spouse' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });
      if (!b.spouseId) return json(res, 400, { error: 'الزيجة مطلوبة' });
      if (!b.name?.trim()) return json(res, 400, { error: 'الاسم مطلوب' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });
      const sp = person.spouses.find(s => s.id === b.spouseId);
      if (!sp) return json(res, 400, { error: 'الزيجة غير موجودة' });
      if (sp.type !== 'external') return json(res, 400, { error: 'لا يمكن تعديل زيجة مرتبطة — عدّل الشخص مباشرة' });

      const oldName = sp.name;
      const newName = b.name.trim();
      const newLabel = b.label?.trim() || sp.label;

      console.log(`  ✏ edit-spouse: "${oldName}" → "${newName}" (${b.spouseId})`);

      safeOp((raw) => {
        // Find spouse ID with flexible spacing
        let pos = raw.indexOf(`id: "${b.spouseId}"`);
        if (pos === -1) pos = raw.indexOf(`id:"${b.spouseId}"`);
        if (pos === -1) throw new Error('Spouse not found in file');

        // Replace name
        const searchRegion = raw.substring(pos, pos + 300);
        const nameMatch = searchRegion.match(/name:\s*"/);
        if (!nameMatch) throw new Error('name field not found');
        const nameStart = pos + nameMatch.index + nameMatch[0].length;
        const nameEnd = raw.indexOf('"', nameStart);
        let result = raw.slice(0, nameStart) + esc(newName) + raw.slice(nameEnd);

        // Replace label if changed
        if (newLabel !== sp.label) {
          const newPos = result.indexOf(`id: "${b.spouseId}"`) !== -1
            ? result.indexOf(`id: "${b.spouseId}"`)
            : result.indexOf(`id:"${b.spouseId}"`);
          if (newPos !== -1) {
            const labelRegion = result.substring(newPos, newPos + 400);
            const labelMatch = labelRegion.match(/label:\s*"/);
            if (labelMatch) {
              const labelStart = newPos + labelMatch.index + labelMatch[0].length;
              const labelEnd = result.indexOf('"', labelStart);
              result = result.slice(0, labelStart) + esc(newLabel) + result.slice(labelEnd);
            }
          }
        }

        return result;
      });

      return json(res, 200, {
        success: true,
        message: `تم تعديل "${oldName}" إلى "${newName}" بنجاح`,
      });
    }

    // ── POST /api/remove-child ──
    if (url.pathname === '/api/remove-child' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.parentId) return json(res, 400, { error: 'الوالد مطلوب' });
      if (!b.spouseId) return json(res, 400, { error: 'الزيجة مطلوبة' });
      if (!b.childId)  return json(res, 400, { error: 'الابن/ة مطلوب' });

      const data = readData();
      const parent = data.people.find(p => p.id === b.parentId);
      if (!parent) return json(res, 400, { error: 'الوالد غير موجود' });
      const sp = parent.spouses.find(s => s.id === b.spouseId);
      if (!sp) return json(res, 400, { error: 'الزيجة غير موجودة' });
      if (!sp.childrenIds.includes(b.childId))
        return json(res, 400, { error: 'الابن/ة غير موجود في هذه الزيجة' });

      const child = data.people.find(p => p.id === b.childId);
      const childName = child ? child.name : b.childId;

      console.log(`  - remove-child: "${childName}" from spouse ${b.spouseId}`);

      // Build mutations
      const removeChildMutations = [
        mutateRemoveChildId(b.spouseId, b.childId),
      ];

      // ── مزامنة تلقائية: إذا كانت الزيجة linked، نزيل الابن من الطرف الآخر أيضاً ──
      if (sp.type === 'linked' && sp.personId) {
        const otherParent = data.people.find(p => p.id === sp.personId);
        if (otherParent) {
          const reverseSpouseEntry = otherParent.spouses.find(
            s => s.type === 'linked' && s.personId === b.parentId
          );
          if (reverseSpouseEntry && reverseSpouseEntry.childrenIds.includes(b.childId)) {
            removeChildMutations.push(mutateRemoveChildId(reverseSpouseEntry.id, b.childId));
            console.log(`    ↳ مزامنة تلقائية: إزالة ${b.childId} من ${otherParent.name} (${reverseSpouseEntry.id})`);
          }
        }
      }

      safeOp(...removeChildMutations);

      return json(res, 200, {
        success: true,
        message: `تمت إزالة "${childName}" من هذه الزيجة`,
      });
    }

    // ── POST /api/remove-spouse ──
    if (url.pathname === '/api/remove-spouse' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });
      if (!b.spouseId) return json(res, 400, { error: 'الزيجة مطلوبة' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });
      const sp = person.spouses.find(s => s.id === b.spouseId);
      if (!sp) return json(res, 400, { error: 'الزيجة غير موجودة' });

      if (sp.childrenIds.length > 0) {
        return json(res, 400, {
          error: `هذه الزيجة مرتبطة بـ ${sp.childrenIds.length} أبناء — يجب إزالة الأبناء أولاً`,
        });
      }

      const mutations = [mutateRemoveSpouseEntry(b.personId, b.spouseId)];

      // If linked, remove reverse link too
      if (sp.type === 'linked' && sp.personId) {
        const linkedPerson = data.people.find(p => p.id === sp.personId);
        if (linkedPerson) {
          const reverseSpouse = linkedPerson.spouses.find(
            s => s.type === 'linked' && s.personId === b.personId
          );
          if (reverseSpouse) {
            mutations.push(mutateRemoveSpouseEntry(sp.personId, reverseSpouse.id));
          }
        }
      }

      console.log(`  - remove-spouse: ${b.spouseId} from ${person.name}`);
      safeOp(...mutations);

      return json(res, 200, {
        success: true,
        message: 'تمت إزالة علاقة الزواج بنجاح',
      });
    }

    // ── POST /api/undo-last ──
    if (url.pathname === '/api/undo-last' && req.method === 'POST') {
      const bp = getLatestBackup();
      if (!bp) return json(res, 400, { error: 'لا توجد نسخة احتياطية للاستعادة' });

      // Restore from the single backup file
      copyFileSync(bp, DATA_FILE);

      console.log('  ↺ undo → restored from backup');
      return json(res, 200, {
        success: true,
        message: 'تمت استعادة النسخة السابقة بنجاح',
      });
    }

    // ── GET /api/notes ──
    if (url.pathname === '/api/notes' && req.method === 'GET') {
      const notes = readNotes();
      return json(res, 200, { notes });
    }

    // ── POST /api/notes/add ──
    if (url.pathname === '/api/notes/add' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });

      const data = readData();
      const person = data.people.find(p => p.id === b.personId);
      if (!person) return json(res, 400, { error: 'الشخص غير موجود' });

      const notes = readNotes();
      if (notes.find(n => n.personId === b.personId)) {
        return json(res, 200, { success: true, message: 'الشخص موجود بالفعل في الملاحظات' });
      }

      notes.push({
        personId: b.personId,
        name: person.name,
        note: (b.note || '').trim(),
        addedAt: new Date().toISOString(),
      });
      writeNotes(notes);

      return json(res, 200, { success: true, message: `تمت إضافة "${person.name}" للملاحظات` });
    }

    // ── POST /api/notes/remove ──
    if (url.pathname === '/api/notes/remove' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });

      let notes = readNotes();
      notes = notes.filter(n => n.personId !== b.personId);
      writeNotes(notes);

      return json(res, 200, { success: true });
    }

    // ── POST /api/notes/update ──
    if (url.pathname === '/api/notes/update' && req.method === 'POST') {
      const b = await parseBody(req);
      if (!b.personId) return json(res, 400, { error: 'الشخص مطلوب' });

      const notes = readNotes();
      const entry = notes.find(n => n.personId === b.personId);
      if (!entry) return json(res, 400, { error: 'غير موجود في الملاحظات' });

      entry.note = (b.note || '').trim();
      writeNotes(notes);

      return json(res, 200, { success: true, message: 'تم تحديث الملاحظة' });
    }

    // ── 404 ──
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('ERROR:', err);
    json(res, 500, { error: err.message || 'خطأ داخلي في الخادم' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │                                          │');
  console.log('  │   لوحة إدارة شجرة العائلة               │');
  console.log(`  │   http://localhost:${PORT}                  │`);
  console.log('  │                                          │');
  console.log('  │   اضغط Ctrl+C للإيقاف                   │');
  console.log('  │                                          │');
  console.log('  └──────────────────────────────────────────┘');
  console.log('');
});
