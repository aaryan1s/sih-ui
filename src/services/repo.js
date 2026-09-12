/**
 * repo — the single data-access seam (Phase 4).
 *
 * Every screen reads here; NEVER from mock arrays directly. Two adapters:
 *  - supabase: real Postgres + RLS when VITE_SUPABASE_URL/KEY are configured
 *  - local:    the persisted dataStore (previous localStorage engine), so the
 *              app stays fully functional with zero setup (demo/judging mode)
 *
 * Backend swap rule: adapters implement the identical async surface below.
 */

import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { store, useStoreData as useLocalStoreData } from './dataStore';
/* No seed/demo data: every collection starts empty (see dataStore.js). */

export const DATA_BACKEND = SUPABASE_ENABLED ? 'supabase' : 'local';

/* ------------------------------------------------------------------ */
/* Local adapter (dataStore) — wrapped async for a uniform interface   */
/* ------------------------------------------------------------------ */

const localAdapter = {
  async listInspections() {
    return store.get('inspections');
  },
  async getInspection(id) {
    return store.get('inspections').find((i) => i.id === id) || null;
  },
  async createInspection(record) {
    // Map the UI record into the same shape the Supabase adapter returns
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
      const manufacturer = s.manufacturers.find((m) => m.id === record.manufacturerId);
      if (manufacturer) {
        manufacturer.inspectionCount += 1;
        if (record.summary?.violationCount > 0) manufacturer.violationCount += record.summary.violationCount;
      }
    }, 'inspections');
    return record;
  },

  async listManufacturers() {
    return store.get('manufacturers');
  },
  async searchManufacturers(query) {
    const q = query.trim().toLowerCase();
    const list = store.get('manufacturers');
    if (!q) return list;
    return list.filter(
      (m) =>
        m.legalName.toLowerCase().includes(q) ||
        (m.tradeName || '').toLowerCase().includes(q) ||
        (m.gstin || '').toLowerCase().includes(q) ||
        (m.license?.number || '').toLowerCase().includes(q) ||
        (m.address || '').toLowerCase().includes(q)
    );
  },
  async createManufacturer(record) {
    store.mutate((s) => {
      s.manufacturers.push(record);
    }, 'manufacturers');
    return record;
  },

  async listCases() {
    return store.get('cases');
  },
  async listReports() {
    return store.get('reports');
  },

  async uploadEvidence(/* inspectionId, file */) {
    // Local mode: file becomes a data URL handled by the caller (wizard).
    return { local: true };
  },
};

/* ------------------------------------------------------------------ */
/* Supabase adapter (Postgres + RLS)                                   */
/* ------------------------------------------------------------------ */

const mapInspectionRow = (row) => ({
  id: row.reference,
  dbId: row.id,
  product: row.inspection_products?.[0]?.label_name || '—',
  manufacturer: row.inspection_products?.[0]?.products?.manufacturers?.legal_name || '—',
  manufacturerId: row.inspection_products?.[0]?.products?.manufacturer_id || null,
  inspector: row.profiles?.full_name || 'Inspector',
  inspectorId: row.inspector_id,
  establishment: row.establishment,
  date: (row.inspected_at || '').slice(0, 10),
  time: (row.inspected_at || '').slice(11, 16),
  status: row.status,
  remarks: row.remarks,
  summary: row.summary,
  declarations: (row.inspection_products?.[0]?.declarations || []).map((d) => ({
    name: d.name,
    value: d.value,
    confidence: d.confidence ?? 0,
    presence: d.presence_status,
    correctness: d.correctness_status,
    placement: d.placement_status,
    readability: d.readability_status,
    font_size: d.font_size_status,
    violation_type: d.violation_type,
    rule_reference: d.rule_reference,
    bounding_box: d.bbox,
  })),
  evidence: (row.evidence || []).map((e) => ({ id: e.id, type: 'photo', label: e.label, note: e.note, path: e.storage_path })),
});

const supabaseAdapter = {
  async listInspections() {
    const { data, error } = await supabase
      .from('inspections')
      .select(`*, profiles(full_name),
        inspection_products(*, declarations(*), products(manufacturers(legal_name))),
        evidence(*)`)
      .order('inspected_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapInspectionRow);
  },
  async getInspection(id) {
    const { data, error } = await supabase
      .from('inspections')
      .select(`*, profiles(full_name),
        inspection_products(*, declarations(*), products(manufacturers(legal_name))),
        evidence(*)`)
      .eq('reference', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapInspectionRow(data) : null;
  },

  /**
   * Full inspection submission (Phase 6/7): inspection → inspection_product →
   * declarations → evidence upload → violations → report row.
   *
   * Manufacturer and product are LINKED by lookup only — official records are
   * government-managed (RLS: officer-only writes); the label snapshot carries
   * what the inspector actually saw. inspector_id always comes from the server
   * session, never from the client payload.
   */
  async createInspection(record, files = {}) {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) throw new Error('Your session has expired — sign in again to submit.');
    const user = authData.user;

    // Link to the official manufacturer record when one matches (no duplicates)
    let manufacturerId = record.manufacturerId || null;
    if (!manufacturerId && record.manufacturer && record.manufacturer !== '—') {
      const { data: mfr } = await supabase
        .from('manufacturers')
        .select('id')
        .ilike('legal_name', `%${record.manufacturer}%`)
        .limit(1)
        .maybeSingle();
      manufacturerId = mfr?.id ?? null;
    }

    // Link to a catalog product when it exists
    let productId = null;
    if (record.product && record.product !== 'Unknown product') {
      const { data: prod } = await supabase
        .from('products')
        .select('id')
        .ilike('name', record.product)
        .limit(1)
        .maybeSingle();
      productId = prod?.id ?? null;
    }

    const inspectedAt = new Date(`${record.date}T${record.time || '00:00'}:00`);
    const { data: inspection, error: inspErr } = await supabase
      .from('inspections')
      .insert({
        reference: record.id,
        inspector_id: user.id,
        establishment: record.establishment,
        establishment_address: record.address ?? null,
        inspection_type: String(record.inspectionType || 'routine').toLowerCase().replace(/\s+/g, '_'),
        location: record.location ?? null,
        inspected_at: Number.isNaN(inspectedAt.getTime()) ? new Date().toISOString() : inspectedAt.toISOString(),
        remarks: record.notes || record.remarks || null,
        status: record.status,
        summary: record.summary ?? {},
      })
      .select('id')
      .single();
    if (inspErr) throw new Error(inspErr.message);

    // Product label image (raw file) → private product-images bucket
    let imagePath = null;
    if (files.labelImage instanceof File) {
      const path = `${inspection.id}/label-${Date.now()}`;
      const { error: imgErr } = await supabase.storage
        .from('product-images')
        .upload(path, files.labelImage, { contentType: files.labelImage.type || 'image/jpeg' });
      if (!imgErr) imagePath = path;
    }

    const { data: ip, error: ipErr } = await supabase
      .from('inspection_products')
      .insert({
        inspection_id: inspection.id,
        product_id: productId,
        label_name: record.label?.name || record.product || 'Unknown product',
        label_brand: record.label?.brand ?? null,
        label_net_quantity: record.label?.net_quantity ?? null,
        label_mrp: record.label?.mrp ?? null,
        label_mfg: record.label?.mfg ?? null,
        label_expiry: record.label?.expiry ?? null,
        label_batch: record.label?.batch ?? null,
        image_path: imagePath,
      })
      .select('id')
      .single();
    if (ipErr) throw new Error(ipErr.message);

    // Declarations — full §9 contract, one row per check
    const declRows = (record.declarations || []).map((d) => ({
      inspection_product_id: ip.id,
      name: d.name,
      value: d.value,
      ocr_value: d.ocr_value ?? d.ocrValue ?? null,
      confidence: d.confidence ?? null,
      presence_status: d.presence ?? null,
      correctness_status: d.correctness ?? null,
      placement_status: d.placement ?? null,
      readability_status: d.readability ?? null,
      font_size_status: d.font_size ?? null,
      violation_type: d.violation_type ?? null,
      rule_reference: d.rule_reference ?? null,
      bbox: d.bounding_box ?? null,
      verified: Boolean(d.verified),
    }));
    if (declRows.length > 0) {
      const { error: declErr } = await supabase.from('declarations').insert(declRows);
      if (declErr) throw new Error(declErr.message);
    }

    // Evidence attachments → private evidence bucket (non-fatal per item)
    for (const item of files.evidence || []) {
      try {
        const blob = await (await fetch(item.dataUrl)).blob();
        const path = `${inspection.id}/${item.id || Date.now()}`;
        const { error: upErr } = await supabase.storage
          .from('evidence')
          .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
        if (upErr) continue;
        await supabase.from('evidence').insert({
          inspection_id: inspection.id,
          storage_path: path,
          label: item.label || 'Evidence photo',
          note: item.note ?? null,
          uploaded_by: user.id,
        });
      } catch {
        // Non-fatal: the inspection stands; evidence can be re-attached.
      }
    }

    // Violations register rows from failed declarations
    const severityOf = (name = '') => {
      const n = name.toLowerCase();
      if (n.includes('mrp') || n.includes('net quantity') || n.includes('manufacturer')) return 'severe';
      if (n.includes('expiry') || n.includes('best before') || n.includes('month & year')) return 'major';
      return 'minor';
    };
    const violationRows = (record.declarations || [])
      .filter((d) => d.violation_type)
      .map((d) => ({
        inspection_id: inspection.id,
        manufacturer_id: manufacturerId,
        severity: severityOf(d.name),
        violation_type: d.violation_type,
        rule_reference: d.rule_reference || 'LM (PC) Rules 2011',
      }));
    if (violationRows.length > 0) {
      const { error: violErr } = await supabase.from('violations').insert(violationRows);
      if (violErr) throw new Error(violErr.message);
    }

    const { error: rptErr } = await supabase.from('reports').insert({
      inspection_id: inspection.id,
      reference: `RPT-${record.id.replace('LM-', '')}`,
      generated_by: user.id,
    });
    if (rptErr) throw new Error(rptErr.message);

    return record;
  },

  async listManufacturers() {
    const { data, error } = await supabase.from('manufacturers').select('*').order('legal_name');
    if (error) throw new Error(error.message);
    return data || [];
  },
  /** Real DB search: ilike on name/GSTIN/license (indexed). Debounce upstream. */
  async searchManufacturers(query) {
    const q = query.trim();
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .or(`legal_name.ilike.%${q}%,trade_name.ilike.%${q}%,gstin.ilike.%${q}%,license_number.ilike.%${q}%`)
      .order('legal_name')
      .limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async listCases() {
    const { data, error } = await supabase.from('cases').select('*').order('opened_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async listReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*, inspections(reference, status, inspected_at, establishment, inspection_products(label_name))')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.reference,
      inspectionId: r.inspections?.reference,
      product: r.inspections?.inspection_products?.[0]?.label_name || '—',
      establishment: r.inspections?.establishment,
      date: (r.inspections?.inspected_at || '').slice(0, 10),
      status: r.inspections?.status,
    }));
  },

  async uploadEvidence(inspectionDbId, file) {
    const path = `${inspectionDbId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('evidence').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path };
  },
};

export const repo = SUPABASE_ENABLED ? supabaseAdapter : localAdapter;

/* React binding: in local mode reuse the store subscription; in supabase mode
   pages fetch on mount (see useRepo hook below). */
export function useStoreData(entity) {
  return useLocalStoreData(entity);
}
