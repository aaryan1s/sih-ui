// Mock data layer — shapes mirror future Supabase query results.
// Declared dimensions follow docs/IMPLEMENTATION_PLAN.md §9:
// value · confidence · presence · correctness · placement · readability ·
// font_size · violation_type · rule_reference · bounding_box

export const DEMO_USERS = {
  inspector: {
    id: 'usr-insp-001',
    name: 'R. Sharma',
    role: 'inspector',
    roleLabel: 'Legal Metrology Inspector',
    department: 'Weights & Measures — North District',
    initials: 'RS',
  },
  gov_officer: {
    id: 'usr-gov-001',
    name: 'A. Kumar',
    role: 'gov_officer',
    roleLabel: 'Department Officer',
    department: 'Dept. of Consumer Affairs — Food & Civil Supplies',
    initials: 'AK',
  },
};

// Per-declaration status vocabulary
export const DIMENSION_STATUS = {
  ok: 'ok', // ✓
  warn: 'warn', // ⚠ requires review
  bad: 'bad', // ✕ non-compliant
  unknown: 'unknown', // ? unable to determine
  na: 'na', // — not applicable
};

export const INSPECTION_STATUS = {
  compliant: 'compliant',
  non_compliant: 'non_compliant',
  warning: 'warning',
  under_review: 'under_review',
};

/* Inspector profile (reference screen 3 — shared by both portals) */
export const PROFILES = {
  inspector: {
    name: 'R. Sharma',
    roleLabel: 'Inspector',
    department: 'Legal Metrology Department',
    employeeId: 'INSP-2023-0176',
    email: 'r.sharma@gov.in',
    phone: '+91 98765 43210',
    designation: 'Inspector',
    region: 'North District',
    dateOfJoining: '12 Aug 2023',
    signatureStatus: 'registered',
  },
  gov_officer: {
    name: 'A. Kumar',
    roleLabel: 'Department Officer',
    department: 'Dept. of Consumer Affairs — Food & Civil Supplies',
    employeeId: 'GOV-2019-0042',
    email: 'a.kumar@gov.in',
    phone: '+91 98110 22334',
    designation: 'Assistant Commissioner (LM)',
    region: 'State Headquarters',
    dateOfJoining: '03 Feb 2019',
    signatureStatus: 'registered',
  },
};

/* Inspector monthly trend — compliant vs non-compliant (reference screen 2) */
export const inspectorTrend = {
  months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  compliant: [16, 15, 19, 17, 21, 18],
  nonCompliant: [5, 4, 3, 5, 4, 2],
};

/* Product catalog for the capture step's barcode lookup (reference screen 5) */
export const PRODUCT_CATALOG = {
  '8901234567890': {
    name: 'Good Day Cookies 500g',
    brand: 'Britannia',
    manufacturerId: 'mfr-001',
    manufacturer: 'M/s Sundar Foods Pvt Ltd',
    category: 'Packaged Foods',
  },
  '8901234567891': {
    name: 'Sunfeel Refined Oil 1L Pouch',
    brand: 'Sunfeel',
    manufacturerId: 'mfr-001',
    manufacturer: 'M/s Sundar Foods Pvt Ltd',
    category: 'Edible Oils',
  },
  '8901234567892': {
    name: 'Freshlite Atta 5kg',
    brand: 'Freshlite',
    manufacturerId: 'mfr-002',
    manufacturer: 'M/s Grainwell Mills',
    category: 'Flours & Grains',
  },
};

/* Mock automated-extraction payload for wizard step 3 (product image is the
   packaged-product.jpg asset; dimensions honor the §9 declaration contract) */
export const WIZARD_EXTRACTION = {
  imageUrl: '/assets/packaged-product.jpg',
  fields: [
    { key: 'brand', label: 'Brand Name', value: 'Good Day', confidence: 0.96 },
    { key: 'productName', label: 'Product Name', value: 'Good Day Cookies', confidence: 0.94 },
    { key: 'netQuantity', label: 'Net Quantity', value: '500 g', confidence: 0.95 },
    { key: 'mrp', label: 'MRP', value: '₹ 120.00', confidence: 0.98 },
    { key: 'mfg', label: 'MFG', value: '08/2026', confidence: 0.91 },
    { key: 'exp', label: 'EXP / Best Before', value: '07/2027', confidence: 0.89 },
    { key: 'batch', label: 'Batch No.', value: 'B0286A', confidence: 0.87 },
    { key: 'manufacturer', label: 'Manufacturer', value: 'Britannia Industries Ltd.', confidence: 0.92 },
  ],
};

/* Mock rule-engine findings for wizard step 4 — Check · Rule · Status · Remarks,
   with full §9 dimension detail per check */
export const WIZARD_COMPLIANCE = [
  {
    id: 'net_quantity',
    check: 'Net Quantity Declaration',
    rule: 'Rule 3(1)',
    status: 'ok',
    remarks: 'Properly declared',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.95 },
  },
  {
    id: 'mrp',
    check: 'MRP (Incl. of all taxes)',
    rule: 'Rule 2(1)',
    status: 'ok',
    remarks: 'Properly declared',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.98 },
  },
  {
    id: 'mfg_date',
    check: 'MFG Date Details',
    rule: 'Rule 6(4)',
    status: 'ok',
    remarks: 'Present and valid',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.91 },
  },
  {
    id: 'best_before',
    check: 'Expiry / Best Before',
    rule: 'Rule 6(3)',
    status: 'ok',
    remarks: 'Present and valid',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.89 },
  },
  {
    id: 'font_size',
    check: 'Unit of Measurement',
    rule: 'Rule 6(6)',
    status: 'ok',
    remarks: 'Correct unit',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.93 },
  },
  {
    id: 'font_size_violation',
    check: 'Font Size — Declarations',
    rule: 'Rule 9(4)',
    status: 'bad',
    remarks: 'Font size below prescribed limit',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'warn', font_size: 'bad', confidence: 0.84, bounding_box: { x: 0.18, y: 0.62, w: 0.4, h: 0.1 } },
  },
  {
    id: 'country_of_origin',
    check: 'Country of Origin',
    rule: 'Rule 6(7)',
    status: 'ok',
    remarks: 'Compliant',
    dimensions: { presence: 'ok', correctness: 'ok', placement: 'ok', readability: 'ok', font_size: 'ok', confidence: 0.9 },
  },
];

/* Inspector report records (reference screen 10b) */
export const REPORTS = [
  { id: 'RPT-2026-0412', inspectionId: 'LM-1042', product: 'Sunfeel Refined Oil 1L Pouch', establishment: 'Shree Traders', date: '2026-09-10', status: INSPECTION_STATUS.non_compliant, violations: 2 },
  { id: 'RPT-2026-0411', inspectionId: 'LM-1041', product: 'Freshlite Atta 5kg', establishment: 'Shree Traders', date: '2026-09-10', status: INSPECTION_STATUS.compliant, violations: 0 },
  { id: 'RPT-2026-0410', inspectionId: 'LM-1040', product: 'Chakra Tea 500g', establishment: 'City Mart', date: '2026-09-09', status: INSPECTION_STATUS.warning, violations: 0 },
  { id: 'RPT-2026-0409', inspectionId: 'LM-1039', product: 'Glow Handwash 250ml', establishment: 'City Mart', date: '2026-09-09', status: INSPECTION_STATUS.compliant, violations: 0 },
  { id: 'RPT-2026-0408', inspectionId: 'LM-1038', product: 'Zesta Orange Juice 1L', establishment: 'Reliance Fresh', date: '2026-09-08', status: INSPECTION_STATUS.under_review, violations: 0 },
];

export const inspections = [
  {
    id: 'LM-1042',
    product: 'Sunfeel Refined Oil 1L Pouch',
    manufacturer: 'M/s Sundar Foods Pvt Ltd',
    manufacturerId: 'mfr-001',
    inspector: 'R. Sharma',
    inspectorId: 'usr-insp-001',
    establishment: 'Shree Traders',
    date: '2026-09-10',
    time: '14:20',
    status: INSPECTION_STATUS.non_compliant,
    declarations: [
      {
        name: 'MRP',
        value: '₹ 145.00',
        confidence: 0.97,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.62, y: 0.71, w: 0.3, h: 0.09 },
      },
      {
        name: 'Net Quantity',
        value: '1 L',
        confidence: 0.94,
        presence: 'ok',
        correctness: 'ok',
        placement: 'warn',
        readability: 'ok',
        font_size: 'ok',
        violation_type: 'misplaced',
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.08, y: 0.66, w: 0.22, h: 0.12 },
      },
      {
        name: 'Manufacturer Name & Address',
        value: 'Sundar Foods Pvt Ltd, Plot 14, Sector 24, Panipat, Haryana',
        confidence: 0.91,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 6(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.1, y: 0.05, w: 0.55, h: 0.16 },
      },
      {
        name: 'Best Before',
        value: null,
        confidence: 0.0,
        presence: 'bad',
        correctness: 'na',
        placement: 'na',
        readability: 'na',
        font_size: 'na',
        violation_type: 'missing',
        rule_reference: 'Rule 6(3), LM (PC) Rules 2011',
        bounding_box: null,
      },
      {
        name: 'FSSAI License No.',
        value: '1',
        confidence: 0.22,
        presence: 'ok',
        correctness: 'unknown',
        placement: 'ok',
        readability: 'bad',
        font_size: 'na',
        violation_type: 'illegible',
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.4, y: 0.82, w: 0.24, h: 0.07 },
      },
    ],
    summary: {
      overall: INSPECTION_STATUS.non_compliant,
      compliantCount: 2,
      warnCount: 1,
      violationCount: 2,
      undeterminedCount: 0,
    },
    evidence: [
      { id: 'ev-1', type: 'photo', label: 'Front label (original)', note: 'Primary capture at store shelf' },
      { id: 'ev-2', type: 'photo', label: 'Best-before zone close-up', note: 'No date visible' },
      { id: 'ev-3', type: 'note', label: 'Inspector note', note: 'Batch codes match invoice #INV-7721.' },
    ],
  },
  {
    id: 'LM-1041',
    product: 'Freshlite Atta 5kg',
    manufacturer: 'M/s Grainwell Mills',
    manufacturerId: 'mfr-002',
    inspector: 'R. Sharma',
    inspectorId: 'usr-insp-001',
    establishment: 'Shree Traders',
    date: '2026-09-10',
    time: '11:05',
    status: INSPECTION_STATUS.compliant,
    declarations: [
      {
        name: 'MRP',
        value: '₹ 240.00',
        confidence: 0.98,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.64, y: 0.7, w: 0.28, h: 0.1 },
      },
      {
        name: 'Net Quantity',
        value: '5 kg',
        confidence: 0.96,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.1, y: 0.68, w: 0.2, h: 0.12 },
      },
    ],
    summary: { overall: 'compliant', compliantCount: 5, warnCount: 0, violationCount: 0, undeterminedCount: 0 },
    evidence: [{ id: 'ev-1', type: 'photo', label: 'Front label', note: 'All declarations visible' }],
  },
  {
    id: 'LM-1040',
    product: 'Chakra Tea 500g',
    manufacturer: 'M/s Hillbrook Beverages',
    manufacturerId: 'mfr-003',
    inspector: 'R. Sharma',
    inspectorId: 'usr-insp-001',
    establishment: 'City Mart',
    date: '2026-09-09',
    time: '16:45',
    status: INSPECTION_STATUS.warning,
    declarations: [
      {
        name: 'MRP',
        value: '₹ 210.00',
        confidence: 0.95,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'warn',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.6, y: 0.74, w: 0.3, h: 0.08 },
      },
    ],
    summary: { overall: 'warning', compliantCount: 4, warnCount: 1, violationCount: 0, undeterminedCount: 0 },
    evidence: [{ id: 'ev-1', type: 'photo', label: 'MRP zone', note: 'Slightly smudged print' }],
  },
  {
    id: 'LM-1039',
    product: 'Glow Handwash 250ml',
    manufacturer: 'M/s Purehome Care',
    manufacturerId: 'mfr-004',
    inspector: 'R. Sharma',
    inspectorId: 'usr-insp-001',
    establishment: 'City Mart',
    date: '2026-09-09',
    time: '10:30',
    status: INSPECTION_STATUS.compliant,
    declarations: [
      {
        name: 'MRP',
        value: '₹ 99.00',
        confidence: 0.97,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.66, y: 0.7, w: 0.26, h: 0.1 },
      },
    ],
    summary: { overall: 'compliant', compliantCount: 6, warnCount: 0, violationCount: 0, undeterminedCount: 0 },
    evidence: [{ id: 'ev-1', type: 'photo', label: 'Front label', note: null }],
  },
  {
    id: 'LM-1038',
    product: 'Zesta Orange Juice 1L',
    manufacturer: 'M/s Hillbrook Beverages',
    manufacturerId: 'mfr-003',
    inspector: 'R. Sharma',
    inspectorId: 'usr-insp-001',
    establishment: 'Reliance Fresh',
    date: '2026-09-08',
    time: '15:10',
    status: INSPECTION_STATUS.under_review,
    declarations: [
      {
        name: 'MRP',
        value: '₹ 110.00',
        confidence: 0.93,
        presence: 'ok',
        correctness: 'ok',
        placement: 'ok',
        readability: 'ok',
        font_size: 'ok',
        violation_type: null,
        rule_reference: 'Rule 2(1), LM (PC) Rules 2011',
        bounding_box: { x: 0.63, y: 0.72, w: 0.29, h: 0.09 },
      },
    ],
    summary: { overall: 'under_review', compliantCount: 3, warnCount: 2, violationCount: 0, undeterminedCount: 1 },
    evidence: [{ id: 'ev-1', type: 'photo', label: 'Front label', note: 'Awaiting batch verification' }],
  },
];

export const manufacturers = [
  {
    id: 'mfr-001',
    legalName: 'M/s Sundar Foods Pvt Ltd',
    tradeName: 'Sundar Foods',
    gstin: '06AACCS1234K1Z5',
    address: 'Plot 14, Sector 24, Panipat, Haryana - 132103',
    contact: 'compliance@sundarfoods.example · +91 98xxxxxx21',
    license: { number: 'LM/HR/2019/4471', status: 'active' },
    categories: ['Edible Oils', 'Packaged Foods'],
    inspectionCount: 14,
    violationCount: 5,
    risk: {
      level: 'HIGH',
      factors: [
        { name: 'Violation count', detail: '5 violations in the last 6 months', weight: 'high' },
        { name: 'Severity mix', detail: '2 severe (missing best-before)', weight: 'high' },
        { name: 'Recurrence', detail: 'Same rule violated across 3 batches', weight: 'medium' },
        { name: 'Enforcement history', detail: '1 prior written notice', weight: 'low' },
      ],
      justification: 'HIGH: 5 violations in 6 months, 2 severe, recurring across batches, 1 prior notice.',
    },
  },
  {
    id: 'mfr-002',
    legalName: 'M/s Grainwell Mills',
    tradeName: 'Freshlite',
    gstin: '07AABCGr5678L1Z2',
    address: 'Survey 42, Industrial Area, Bahadurgarh, Haryana - 124507',
    contact: 'quality@grainwell.example · +91 97xxxxxx88',
    license: { number: 'LM/HR/2017/2210', status: 'active' },
    categories: ['Flours & Grains'],
    inspectionCount: 9,
    violationCount: 0,
    risk: {
      level: 'LOW',
      factors: [
        { name: 'Violation count', detail: 'No violations on record', weight: 'low' },
        { name: 'Recurrence', detail: 'None', weight: 'low' },
      ],
      justification: 'LOW: consistently compliant across 9 inspections.',
    },
  },
  {
    id: 'mfr-003',
    legalName: 'M/s Hillbrook Beverages',
    tradeName: 'Hillbrook',
    gstin: '08AACHB9012M1Z8',
    address: 'Khasra 118, JOHARI Road, Jaipur, Rajasthan - 302012',
    contact: 'legal@hillbrook.example · +91 96xxxxxx44',
    license: { number: 'LM/RJ/2018/3388', status: 'under_review' },
    statusNote: 'License review pending — linked case CASE-071',
    categories: ['Beverages', 'Juices'],
    inspectionCount: 11,
    violationCount: 4,
    risk: {
      level: 'MODERATE',
      factors: [
        { name: 'Violation count', detail: '4 violations in the last year', weight: 'medium' },
        { name: 'Severity mix', detail: 'Mostly readability warnings', weight: 'medium' },
        { name: 'Recency', detail: '2 violations in the last 30 days', weight: 'high' },
      ],
      justification: 'MODERATE: repeated readability warnings with recent recurrence.',
    },
  },
  {
    id: 'mfr-004',
    legalName: 'M/s Purehome Care',
    tradeName: 'Glow',
    gstin: '09AACGP3456N1Z9',
    address: 'Unit 7, Trans Ganga, Kanpur, Uttar Pradesh - 208001',
    contact: 'ops@purehome.example · +91 95xxxxxx67',
    license: { number: 'LM/UP/2021/1194', status: 'active' },
    categories: ['Personal Care'],
    inspectionCount: 6,
    violationCount: 1,
    risk: {
      level: 'LOW',
      factors: [{ name: 'Violation count', detail: '1 minor violation (2025)', weight: 'low' }],
      justification: 'LOW: single minor violation, no recurrence.',
    },
  },
];

export const cases = [
  {
    id: 'CASE-077',
    manufacturerId: 'mfr-001',
    manufacturer: 'M/s Sundar Foods Pvt Ltd',
    inspectionId: 'LM-1042',
    violation: 'Rule 6(3) — Missing Best Before declaration',
    severity: 'severe',
    status: 'under_review',
    assignedTo: 'A. Kumar',
    opened: '2026-09-10',
    flagReason: 'SYSTEM (advisory): 3rd recurring offense of the same rule across batches → Recommended for Government Review.',
    timeline: [
      { date: '2026-09-10', actor: 'System', event: 'Flag raised — repeated severe violation detected (advisory only)' },
      { date: '2026-09-10', actor: 'A. Kumar', event: 'Case assigned for review' },
      { date: '2026-09-11', actor: 'A. Kumar', event: 'Under review — evidence examined' },
    ],
    previousViolations: [
      { id: 'V-081', date: '2026-05-22', rule: 'Rule 6(3)', outcome: 'Written notice issued' },
      { id: 'V-064', date: '2026-02-14', rule: 'Rule 6(3)', outcome: 'Warning issued' },
    ],
  },
  {
    id: 'CASE-071',
    manufacturerId: 'mfr-003',
    manufacturer: 'M/s Hillbrook Beverages',
    inspectionId: 'LM-1040',
    violation: 'Rule 2(1) — Illegible MRP region',
    severity: 'major',
    status: 'action_taken',
    assignedTo: 'A. Kumar',
    opened: '2026-09-02',
    flagReason: 'SYSTEM (advisory): 2 violations within 30 days → Recommended for Government Review.',
    timeline: [
      { date: '2026-09-02', actor: 'System', event: 'Flag raised — recurrence within 30 days (advisory only)' },
      { date: '2026-09-04', actor: 'A. Kumar', event: 'Officer decision recorded: Notice issued pending re-inspection' },
    ],
    previousViolations: [{ id: 'V-072', date: '2026-08-18', rule: 'Rule 9(4)', outcome: 'Warning issued' }],
  },
];

export const ENFORCEMENT_ACTIONS = [
  { id: 'no_action', label: 'No Action' },
  { id: 'warning', label: 'Warning' },
  { id: 'notice', label: 'Notice' },
  { id: 'follow_up_inspection', label: 'Follow-up Inspection' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'license_review', label: 'License Review' },
  { id: 'suspension', label: 'Suspension' },
  { id: 'other', label: 'Other departmental action' },
];

export const govAnalytics = {
  kpis: {
    totalInspections: { value: 1240, delta: '+6.2%', trend: 'up' },
    complianceRate: { value: '88.4%', delta: '+1.3 pts', trend: 'up' },
    totalViolations: { value: 217, delta: '-4.8%', trend: 'down' },
    openCases: { value: 38, delta: '+3', trend: 'up' },
    totalManufacturers: { value: 412, delta: '+9', trend: 'up' },
    highRiskManufacturers: { value: 14, delta: '-2', trend: 'down' },
  },
  complianceTrend: [82, 83, 84, 83, 85, 86, 86, 87, 87, 88, 88, 88],
  complianceTrendMonths: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7', 'Wk 8', 'Wk 9', 'Wk 10', 'Wk 11', 'Wk 12'],
  violationsByCategory: [
    { label: 'MRP display', count: 62 },
    { label: 'Net quantity', count: 48 },
    { label: 'Address / identity', count: 31 },
    { label: 'Date marking', count: 44 },
    { label: 'Font size', count: 19 },
    { label: 'Other', count: 13 },
  ],
};
