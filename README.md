Neon Pac — Firebase Leaderboard

Overview
- Client-only leaderboard using Firebase Firestore and Anonymous Auth.
- Exposes `window.Leaderboard = { submitScore(name, score), getTop10() }` and `window.LeaderboardReady`.
- Game integrates Top 10 in the HUD and submits on Game Over if the score qualifies.

Files
- `src/leaderboard.js`: Lazy-inits Firebase v12 from gstatic CDN and implements the API.
- `src/local-dev.js`: Optional App Check debug token placeholder for local dev.
- `neon_pac_phaser_html_5_game_HUDonly_TUNNEL_OK_FINAL4.html`: Loads the module and renders the Top 10 panel; prompts name and submits score on Game Over.

Setup
1) Firebase Project
   - Create a Firebase project, enable Firestore (in Native mode).
   - Authentication: enable Anonymous sign-in.
   - (Recommended) App Check: create reCAPTCHA v3 site key.

2) Add Config to HTML
   - Open `neon_pac_phaser_html_5_game_HUDonly_TUNNEL_OK_FINAL4.html` and set:
     - `window.FIREBASE_CONFIG = { apiKey, authDomain, projectId, appId, ... }` (Web app config from Firebase Console).
     - Optional: `window.FIREBASE_APPCHECK_SITE_KEY = 'YOUR_RECAPTCHA_V3_SITE_KEY'`.

3) Local Dev (optional)
   - Put your debug token in `src/local-dev.js`:
     - `self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'YOUR_DEBUG_TOKEN'`.
   - Register the token in App Check > Debug tokens.
   - The HTML auto-loads this file only on `localhost` / `127.0.0.1`.

4) Deploy / Run
   - Open the HTML file via a web server (and with internet access for Firebase gstatic CDN).
   - The game remains playable if Firebase fails to init; the leaderboard quietly disables.

API Behavior
- `submitScore(name, score): Promise<boolean>`
  - Sanitizes `name` (trim, strip URLs, allow `[A-Za-z0-9_.\- ]`, max 24; defaults to `Player`).
  - Clamps and floors score to `0..1_000_000`; rejects `<= 0`.
  - Throttles client submissions to one every 5 seconds.
  - On success: writes `{ name, score, createdAt: serverTimestamp() }` to `scores` collection.

- `getTop10(): Promise<Array<{ name, score, createdAt: Date }>>`
  - Orders by `score` descending, limit 10. Converts Firestore timestamps to `Date`.
  - Returns `[]` on failure.

Firestore Rules (starter)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{doc} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['name','score','createdAt'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 24
        && request.resource.data.score is int
        && request.resource.data.score >= 0 && request.resource.data.score <= 1000000;
      allow update, delete: if false;
    }
  }
}
```

Integration Notes
- HUD shows a compact Top 10 panel; auto-refreshes after initialization and after a successful submission.
- On Game Over, if the score qualifies (top list has < 10 items or current score > the last place), a name prompt appears and the score is submitted.
- Name is remembered in `localStorage` under `neonpac_name` for convenience.

Security Notes
- This is a client-only leaderboard suitable for casual games; determined users can spoof scores.
- App Check and Firestore rules reduce casual abuse; do not put any secrets in the repo.

