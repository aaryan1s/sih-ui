/**
 * Central application store — the single source of truth for all entities.
 *
 * Data consistency contract (per the functional spec):
 *   One inspection created → Dashboard, History, Manufacturer profile,
 *   Reports, Violations, Cases and Analytics all reflect it, because every
 *   screen reads through `store.get(entity)` / `store.subscribe(entity)` —
 *   never from local copies.
 *
 * Persistence: localStorage so demo sessions survive reloads (a real backend
 * replaces this adapter without touching any UI).
 *
 * Stores are plain arrays inside a plain object; mutation goes exclusively
 * through store.mutate(), which bumps a version counter and notifies
 * subscribers. React binding: useStoreData(entity) hook (see below).
 */

/*
 * No seed/demo business data. The store starts EMPTY — every inspection,
 * manufacturer, case and report in the UI originates from real user actions
 * (submitted inspections and the records derived from them).
 */
const STORAGE_KEY = 'lmcs.store.v2'; // v2: seed-era snapshots are intentionally discarded

/* ---------- persistence ---------- */

const buildEmptyState = () => ({
  inspections: [],
  manufacturers: [],
  cases: [],
  reports: [],
  notes: {}, // caseId -> [{ id, author, text, date }]
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate shape; tolerate snapshots written by older/newer versions
      if (parsed && Array.isArray(parsed.inspections)) {
        return { ...buildEmptyState(), ...parsed };
      }
    }
  } catch {
    /* corrupted or unavailable storage — start empty */
  }
  return buildEmptyState();
}

function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode) — in-memory only */
  }
}

/* ---------- store core ---------- */

const state = load();
const listeners = new Set(); // fn(entity) — entity is the changed key or '*'
let version = 0;

const notify = (entity) => {
  version += 1;
  persist(state);
  listeners.forEach((fn) => fn(entity));
};

export const store = {
  /** Read a collection (returns a stable reference for the current version). */
  get(entity) {
    return state[entity];
  },

  /** Current store version — changes on every mutation. */
  version() {
    return version;
  },

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** The only sanctioned way to change data. */
  mutate(mutator, entity = '*') {
    mutator(state);
    notify(entity);
  },

  /** Clear all records (dev affordance). */
  reset() {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, buildEmptyState());
    notify('*');
  },
};

/* ---------- entity operations (all flow through mutate) ---------- */

/* Transparent, explainable risk classification from the manufacturer's own
   recorded history — no opaque score. Derived after every linked inspection. */
const deriveRiskLevel = (mfr) => {
  if (!mfr.inspectionCount) return 'UNRATED';
  if (mfr.violationCount >= 5 || (mfr.inspectionCount >= 2 && mfr.violationCount / mfr.inspectionCount >= 0.5)) return 'HIGH';
  if (mfr.violationCount >= 2) return 'MODERATE';
  return 'LOW';
};

export const inspectionsRepo = {
  create(record) {
    store.mutate((s) => {
      s.inspections.unshift(record);
      s.reports.unshift({
        id: `RPT-${record.id.replace('LM-', '')}`,
        inspectionId: record.id,
        product: record.product,
        establishment: record.establishment,
        date: record.date,
        status: record.status,
        violations: record.summary?.violationCount ?? 0,
      });

      /* Manufacturer record derived from the inspection itself — never a
         fabricated registry entry. Matching is by exact name (case-insensitive);
         first inspection mentioning a manufacturer creates the provisional
         record, later inspections accumulate onto it. */
      const violationCount = record.summary?.violationCount ?? 0;
      const name = (record.manufacturer || '').trim();
      if (name && name !== '—') {
        let mfr = s.manufacturers.find(
          (m) => (m.legalName || '').toLowerCase() === name.toLowerCase()
        );
        if (!mfr) {
          mfr = {
            id: `mfr-${Date.now().toString(36)}`,
            legalName: name,
            tradeName: name,
            gstin: record.gstin || null,
            address: record.manufacturerAddress || null,
            license: { status: 'unverified' },
            source: 'inspection', // provisional until a department officer verifies it
            inspectionCount: 0,
            violationCount: 0,
            risk: { level: 'UNRATED' },
          };
          s.manufacturers.push(mfr);
        }
        mfr.inspectionCount += 1;
        mfr.violationCount += violationCount;
        mfr.risk = { level: deriveRiskLevel(mfr) };
        record.manufacturerId = mfr.id;
      }

      /* Complaint-driven case — a complaint is a government work item from
         the moment it is filed, independent of how many violations it later
         contains. The inspector filing the complaint is the original reporter;
         the case status is "pending_review" until an officer acts. */
      const isComplaint = (record.inspectionType || '').toLowerCase().replace(/\s+/g, '_') === 'complaint';
      if (isComplaint) {
    s.cases.unshift({
      id: `CASE-${record.id}`,
      manufacturer: name || '—',
      manufacturerId: record.manufacturerId || null,
      inspectionId: record.id,
      violation: record.inspectionType || 'Filed as complaint',
      severity: violationCount >= 1 ? 'major' : 'minor',
      isComplaint: true,
      opened: record.date,
      status: 'pending_review',
      assignedTo: null,
      reporter: record.inspector || 'Inspector',
      reporterId: record.inspectorId || null,
      flagReason: `Filed as a consumer complaint on ${record.date}. Inspector of record: ${record.inspector || 'Inspector'}.`,
      complaint: true,
      previousViolations: [],
      timeline: [
        {
          date: record.date,
          actor: 'System',
          event: `Complaint filed ${record.date} — inspection ${record.id} (${record.establishment || 'establishment'} / ${name || 'no manufacturer match'}).`,
        },
      ],
      decision: null,
    });
      }

      /* System advisory flag — multiple declaration violations on the SAME
         manufacturer, recommended for review. Advisory only; officers decide.
         Complaint cases are always created above; this adds a separate advisory
         case when non-complaint inspections cross the threshold. */
      if (!isComplaint && violationCount >= 3) {
        const previousViolations = s.inspections
          .filter((i) => name && i.manufacturer && i.manufacturer.toLowerCase() === name.toLowerCase() && i.id !== record.id)
          .flatMap((i) =>
            i.declarations
              .filter((d) => d.violation_type)
              .map((d) => ({
                id: `${i.id} · ${d.name}`,
                date: i.date,
                rule: d.rule_reference || 'LM (PC) Rules 2011',
                outcome: d.violation_type.replace(/_/g, ' '),
              }))
          );
        s.cases.unshift({
          id: `CASE-${record.id.replace('LM-', '')}-adv`,
          manufacturer: name || '—',
          manufacturerId: record.manufacturerId || null,
          inspectionId: record.id,
          violation: `${violationCount} declaration violations recorded`,
          severity: violationCount >= 5 ? 'severe' : 'major',
          opened: record.date,
          status: 'under_review',
          assignedTo: null,
          flagReason: `System advisory: ${violationCount} declaration violation(s) on inspection ${record.id}${previousViolations.length ? ` plus ${previousViolations.length} earlier finding(s) for this manufacturer` : ''} — recommended for government review.`,
          previousViolations,
          timeline: [
            {
              date: record.date,
              actor: 'System',
              event: `Auto-flagged: ${violationCount} declaration violations on inspection ${record.id} — recommended for government review.`,
            },
          ],
          decision: null,
        });
      }
    }, 'inspections');
  },
};

export const casesRepo = {
  addAction(caseId, action) {
    store.mutate((s) => {
      const caseFile = s.cases.find((c) => c.id === caseId);
      if (!caseFile) return;
      caseFile.status = action.status;
      caseFile.timeline.push({
        date: new Date().toISOString().slice(0, 10),
        actor: action.actor,
        event: `${action.label} — ${action.reason}`,
      });
      caseFile.decision = { action: action.label, reason: action.reason, date: new Date().toISOString().slice(0, 10) };
    }, 'cases');
  },

  addNote(caseId, note) {
    store.mutate((s) => {
      s.notes[caseId] = s.notes[caseId] || [];
      s.notes[caseId].push(note);
    }, 'cases');
  },
};

export const manufacturersRepo = {
  create(record) {
    store.mutate((s) => {
      s.manufacturers.push(record);
    }, 'manufacturers');
  },
};

/* ---------- React binding ---------- */

import { useSyncExternalStore } from 'react';

/**
 * Subscribe a component to a store entity. The version number is the snapshot:
 * any mutation bumps it, re-renders the consumer, and the fresh collection is
 * read on the next render pass.
 */
export function useStoreData(entity) {
  useSyncExternalStore(
    (onStoreChange) => store.subscribe(() => onStoreChange()),
    () => store.version(),
    () => store.version()
  );
  return store.get(entity);
}
