// Lightweight client-only Firebase leaderboard helper
// Exposes window.Leaderboard = { submitScore, getTop10 }
// and window.LeaderboardReady = ensureInit()

// Pin Firebase version (aligns with your previous project)
const FIREBASE_VERSION = '12.2.1';
const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

let initPromise = null;
let _deps = null; // cached imported modules
let _db = null;
let _auth = null;
let _lastSubmitAt = 0;

function sanitizeName(input) {
  try {
    let s = String(input == null ? '' : input);
    s = s.trim();
    // Strip obvious URLs
    s = s.replace(/https?:\/\/\S+/gi, '')
         .replace(/www\.[^\s]+/gi, '');
    // Collapse multiple spaces
    s = s.replace(/\s+/g, ' ');
    // Allow A-Z a-z 0-9 _ - . space
    s = s.replace(/[^A-Za-z0-9_\.\- ]+/g, '');
    if (s.length === 0) s = 'Player';
    if (s.length > 24) s = s.slice(0, 24);
    return s;
  } catch (_) {
    return 'Player';
  }
}

function clampScore(n) {
  const s = Math.floor(Number.isFinite(n) ? n : 0);
  if (s < 0) return 0;
  if (s > 1_000_000) return 1_000_000;
  return s;
}

async function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const cfg = (window && window.FIREBASE_CONFIG) || null;
      if (!cfg) {
        try { window.LeaderboardDisabledReason = 'no_config'; } catch(_){}
        if (window.LEADERBOARD_DEBUG) console.warn('[Leaderboard] No FIREBASE_CONFIG; disabled.');
        throw new Error('Missing FIREBASE_CONFIG');
      }

      // Optional: App Check debug token for local dev (set via src/local-dev.js)
      // self.FIREBASE_APPCHECK_DEBUG_TOKEN can be set before this runs

      const [appMod, authMod, fsMod, appCheckMod] = await Promise.all([
        import(`${BASE}/firebase-app.js`),
        import(`${BASE}/firebase-auth.js`),
        import(`${BASE}/firebase-firestore.js`),
        // Best-effort App Check import
        import(`${BASE}/firebase-app-check.js`).catch(() => null),
      ]);
      _deps = { appMod, authMod, fsMod, appCheckMod };

      const { initializeApp, getApps, getApp } = appMod;
      const app = (getApps && getApps().length ? getApp() : initializeApp(cfg));

      // Optional App Check
      if (appCheckMod && window.FIREBASE_APPCHECK_SITE_KEY) {
        try {
          const { initializeAppCheck, ReCaptchaV3Provider } = appCheckMod;
          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(String(window.FIREBASE_APPCHECK_SITE_KEY)),
            isTokenAutoRefreshEnabled: true,
          });
        } catch (e) {
          if (window.LEADERBOARD_DEBUG) console.warn('[Leaderboard] App Check init skipped:', e);
        }
      }

      const { getAuth, signInAnonymously } = authMod;
      _auth = getAuth(app);
      try { await signInAnonymously(_auth); } catch (e) {
        try { window.LeaderboardDisabledReason = 'auth_failed'; } catch(_){}
        if (window.LEADERBOARD_DEBUG) console.warn('[Leaderboard] Anonymous auth failed:', e);
        // Continue; Firestore may still read public data
      }

      const { getFirestore } = fsMod;
      _db = getFirestore(app);

      return true;
    } catch (e) {
      try { window.LeaderboardDisabledReason = 'init_failed'; } catch(_){}
      if (window.LEADERBOARD_DEBUG) console.warn('[Leaderboard] Init failed:', e);
      // Keep API available even if init fails
      return false;
    }
  })();
  return initPromise;
}

async function submitScore(name, score) {
  try {
    const ok = await ensureInit();
    if (!ok || !_db) return false;

    const now = Date.now();
    if (now - _lastSubmitAt < 5000) return false; // throttle 5s
    _lastSubmitAt = now;

    const cleanName = sanitizeName(name);
    const s = clampScore(score);
    if (!Number.isFinite(s) || s <= 0) return false; // reject 0 or invalid

    const { collection, addDoc, serverTimestamp } = _deps.fsMod;
    await addDoc(collection(_db, 'scores'), {
      name: cleanName,
      score: s,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function getTop10() {
  try {
    const ok = await ensureInit();
    if (!ok || !_db) return [];
    const { collection, query, orderBy, limit, getDocs } = _deps.fsMod;
    const q = query(collection(_db, 'scores'), orderBy('score', 'desc'), limit(10));
    const snap = await getDocs(q);
    const out = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      let createdAt = d.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') createdAt = createdAt.toDate();
      else createdAt = new Date(0);
      out.push({ name: String(d.name || 'Player'), score: clampScore(d.score || 0), createdAt });
    });
    return out;
  } catch (_) {
    return [];
  }
}

window.Leaderboard = { submitScore, getTop10 };
window.LeaderboardReady = ensureInit();
