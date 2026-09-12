/**
 * authService — pluggable authentication adapter.
 *
 * Two implementations behind one identical surface:
 *   1. supabaseAuthService — used when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 *      are configured. Role comes EXCLUSIVELY from the server-side claim
 *      (user_metadata.app_role set via a trigger/SQL, or app_metadata), never
 *      from client input. Data authorization is enforced by Supabase RLS
 *      policies that read that claim — the frontend cannot grant itself a role.
 *   2. demoAuthService (default) — mock directory with latency, for development
 *      and judging without a backend. Clearly not a security mechanism.
 *
 * The frontend picks the adapter at module load; no UI code changes either way.
 */

import { DEMO_USERS } from '../data/mockData';

const LATENCY = 900;
const SESSION_KEY = 'lmcs.demo.session';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ------------------------------------------------------------------ */
/* Demo adapter (default)                                              */
/* ------------------------------------------------------------------ */

// Demo account mapping stands in for the future server-side role claim.
const ROLE_DIRECTORY = {
  'inspector@lmcs.gov.in': 'inspector',
  'officer@lmcs.gov.in': 'gov_officer',
  insp001: 'inspector',
  officer001: 'gov_officer',
  '123456': 'inspector',
};

// Demo account picker credentials (judge affordance). Not a security mechanism —
// every credential still goes through signIn() and the role comes back from
// the auth layer, never from the client.
export const DEMO_CREDENTIALS = {
  inspector: { userId: 'inspector@lmcs.gov.in', password: 'inspector123' },
  officer: { userId: 'officer@lmcs.gov.in', password: 'officer123' },
};

const authError = (code, message) => {
  const err = new Error(message || code);
  err.code = code;
  return err;
};

const demoAuthService = {
  async signIn(userIdOrEmail, password) {
    await wait(LATENCY);
    const key = String(userIdOrEmail || '').trim().toLowerCase();
    const role = ROLE_DIRECTORY[key];
    if (!role || password === 'error123') throw authError('invalid_credentials');
    return { user: DEMO_USERS[role], issuedAt: Date.now() };
  },

  async resetPassword(email) {
    await wait(LATENCY);
    if (!String(email || '').includes('@')) throw authError('invalid_email', 'Enter a valid email address.');
    return { sent: true, email };
  },
};

/* ------------------------------------------------------------------ */
/* Supabase adapter (active only when env vars are present)            */
/* ------------------------------------------------------------------ */

// The @supabase/supabase-js dependency is only imported when configured,
// keeping the demo bundle free of it.
let supabaseClient = null;
async function getClient() {
  if (!supabaseClient) {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

const supabaseAuthService = {
  async signIn(email, password) {
    const client = await getClient();
    const { data, error } = await client.auth.signInWithPassword({ email: String(email || '').trim(), password });
    if (error) throw authError('invalid_credentials', error.message);

    // Role is read from the server-issued identity metadata. The expected key
    // is `app_role` in user_metadata or app_metadata (set server-side, e.g. by
    // a SQL trigger on profile creation). The client NEVER decides the role.
    const meta = data.user?.app_metadata || {};
    const userMeta = data.user?.user_metadata || {};
    const role = meta.app_role || userMeta.app_role;

    if (role !== 'inspector' && role !== 'gov_officer') {
      await client.auth.signOut();
      throw authError('no_role', 'Account pending role assignment — contact the department administrator.');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userMeta.full_name || data.user.email?.split('@')[0] || 'Officer',
        role,
        roleLabel: role === 'gov_officer' ? 'Department Officer' : 'Legal Metrology Inspector',
        department: userMeta.department || 'Dept. of Consumer Affairs',
        initials: (userMeta.full_name || 'U')
          .split(' ')
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
      },
      issuedAt: Date.now(),
      // Supabase session tokens live in its own managed storage; we keep only
      // the profile snapshot for instant UI hydration.
      externalSession: data.session,
    };
  },

  async resetPassword(email) {
    const client = await getClient();
    const { error } = await client.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw authError('reset_failed', error.message);
    return { sent: true, email };
  },
};

export const authService = USE_SUPABASE ? supabaseAuthService : demoAuthService;
export const AUTH_BACKEND = USE_SUPABASE ? 'supabase' : 'demo';

/* ------------------------------------------------------------------ */
/* Session persistence (demo adapter)                                  */
/* ------------------------------------------------------------------ */

export const sessionStore = {
  save(session) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* storage unavailable (private mode) — session stays in memory only */
    }
  },
  load() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};
