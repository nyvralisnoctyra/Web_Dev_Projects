/* ==========================================================================
   GitHub Profiles — app.js
   ────────────────────────────────────────────────────────────────────────
   · Race-safe (AbortController + request-id stamp)
   · XSS-safe (escapeHtml on every user-supplied field)
   · Client cache (memory + localStorage with TTL)
   · Optional GitHub token (60 → 5,000 req/hour)
   · Quota badge + graceful 403/429 handling
   · Parallel fetch (profile + repos in one round-trip)
   · Debounced live search · Keyboard shortcuts
   · Custom animated cursor · Animated loader
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   1. CONFIG
   -------------------------------------------------------------------------- */
const API_URL    = 'https://api.github.com/users/';
const MAX_REPOS  = 6;
const CACHE_TTL  = 1000 * 60 * 60;   // 1 hour
const DEBOUNCE   = 450;              // ms

const CACHE_PREFIX = 'gh:profile:';
const TOKEN_KEY    = 'gh:token';

/* --------------------------------------------------------------------------
   2. DOM
   -------------------------------------------------------------------------- */
const form        = document.getElementById('form');
const searchInput = document.getElementById('search');
const main        = document.getElementById('main');
const quotaEl     = document.getElementById('quota');
const tokenBtn    = document.getElementById('token-btn');
const refreshBtn  = document.getElementById('refresh-btn');

/* --------------------------------------------------------------------------
   3. UTILITIES
   -------------------------------------------------------------------------- */
const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const debounce = (fn, delay = DEBOUNCE) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

const formatCount = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  if (num < 1000) return String(num);
  if (num < 1_000_000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
};

/* --------------------------------------------------------------------------
   4. TOKEN HANDLING
   -------------------------------------------------------------------------- */
const getToken   = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t.trim());
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Fetch wrapper that adds Authorization when a token is present. */
const ghFetch = (url, opts = {}) => {
  const token = getToken();
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
};

/* --------------------------------------------------------------------------
   5. CACHE
   -------------------------------------------------------------------------- */
const memCache = new Map();

const cacheGet = (key) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return v;
  } catch {
    return null;
  }
};

const cacheSet = (key, value) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ t: Date.now(), v: value })
    );
  } catch { /* quota exceeded — ignore */ }
};

const clearCache = () => {
  memCache.clear();
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
};

/* --------------------------------------------------------------------------
   6. RACE GUARD
   -------------------------------------------------------------------------- */
let currentRequestId = 0;
let activeController = null;

const cancelActiveRequest = () => {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
};

/* --------------------------------------------------------------------------
   7. QUOTA BADGE
   -------------------------------------------------------------------------- */
const updateQuota = (res) => {
  if (!quotaEl) return;
  const remaining = res.headers.get('X-RateLimit-Remaining');
  const limit     = res.headers.get('X-RateLimit-Limit');
  if (remaining == null || limit == null) return;
  quotaEl.textContent = `${remaining}/${limit}`;
  quotaEl.classList.toggle('quota--low', Number(remaining) < 5);
  quotaEl.title = `GitHub API: ${remaining} of ${limit} requests remaining`;
};

/* --------------------------------------------------------------------------
   8. TEMPLATES
   -------------------------------------------------------------------------- */
const loadingTemplate = () => `
  <div class="loader" aria-busy="true">
    <div class="loader__ring"></div>
    <div class="loader__text">Loading</div>
  </div>
`;

const errorTemplate = (msg) => `
  <div class="error" role="alert">⚠️ ${escapeHtml(msg)}</div>
`;

const profileTemplate = (user, repos = []) => {
  const chips = repos.length
    ? repos.slice(0, MAX_REPOS).map((r) => `
        <a class="repo"
           href="${escapeHtml(r.html_url)}"
           target="_blank"
           rel="noopener noreferrer"
           title="${escapeHtml(r.description || r.name)}">
          ${escapeHtml(r.name)}
        </a>`).join('')
    : `<span class="repo" style="opacity:.6;cursor:default;">No public repos</span>`;

  return `
    <div class="card">
      <div>
        <img class="avatar"
             src="${escapeHtml(user.avatar_url)}"
             alt="${escapeHtml(user.name || user.login)}"
             loading="lazy"
             onerror="this.src='https://picsum.photos/288'" />
      </div>
      <div class="user-info">
        <h2>${escapeHtml(user.name || user.login)}</h2>
        <p>${escapeHtml(user.bio || 'This profile has no bio.')}</p>
        <ul class="info">
          <li><strong>${formatCount(user.followers)}</strong> Followers</li>
          <li><strong>${formatCount(user.following)}</strong> Following</li>
          <li><strong>${formatCount(user.public_repos)}</strong> Repos</li>
        </ul>
        <div id="repos">${chips}</div>
      </div>
    </div>
  `;
};

/* --------------------------------------------------------------------------
   9. RENDER
   -------------------------------------------------------------------------- */
const renderUser = ({ user, repos }) => {
  main.innerHTML = profileTemplate(user, repos);
  main.setAttribute('aria-busy', 'false');
  document.title = `${user.name || user.login} — GitHub Profiles`;
};

/* --------------------------------------------------------------------------
   10. FETCH (with cache + rate-limit handling)
   -------------------------------------------------------------------------- */
const getUser = async (username) => {
  const clean = String(username).trim();
  if (!clean) return;

  const key = clean.toLowerCase();

  /* Fast path — memory */
  if (memCache.has(key)) {
    renderUser(memCache.get(key));
    return;
  }

  /* Medium path — localStorage */
  const cached = cacheGet(key);
  if (cached) {
    memCache.set(key, cached);
    renderUser(cached);
    return;
  }

  /* Slow path — network */
  cancelActiveRequest();
  const requestId = ++currentRequestId;
  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  main.innerHTML = loadingTemplate();
  main.setAttribute('aria-busy', 'true');

  try {
    const [userRes, reposRes] = await Promise.all([
      ghFetch(API_URL + encodeURIComponent(clean), { signal }),
      ghFetch(
        API_URL + encodeURIComponent(clean) +
        `/repos?sort=updated&per_page=${MAX_REPOS}`,
        { signal }
      ),
    ]);

    if (requestId !== currentRequestId) return;

    /* Quota header is on every response — update badge */
    updateQuota(userRes);

    /* Rate limit reached (403 with a body message, or 429) */
    if (userRes.status === 403 || userRes.status === 429) {
      const resetAt = userRes.headers.get('X-RateLimit-Reset');
      const mins = resetAt
        ? Math.max(1, Math.ceil((Number(resetAt) * 1000 - Date.now()) / 60000))
        : null;
      const suffix = mins ? ` Try again in ~${mins} min.` : '';
      const hint = getToken()
        ? ' Your token may be invalid or expired.'
        : ' Add a token (🔑) to unlock 5,000 req/hr.';
      main.innerHTML = errorTemplate(`GitHub rate limit reached.${suffix}${hint}`);
      main.setAttribute('aria-busy', 'false');
      return;
    }

    if (!userRes.ok) {
      const msg = userRes.status === 404
        ? `User "${clean}" not found.`
        : `GitHub error (${userRes.status}).`;
      main.innerHTML = errorTemplate(msg);
      main.setAttribute('aria-busy', 'false');
      return;
    }

    const user = await userRes.json();

    let repos = [];
    if (reposRes.ok) {
      try { repos = await reposRes.json(); } catch { repos = []; }
    }

    if (requestId !== currentRequestId) return;

    const payload = { user, repos };
    memCache.set(key, payload);
    cacheSet(key, payload);
    renderUser(payload);
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (requestId !== currentRequestId) return;
    main.innerHTML = errorTemplate('Network error. Check your connection.');
    main.setAttribute('aria-busy', 'false');
    console.error('[GitHub Profiles]', err);
  } finally {
    if (requestId === currentRequestId) activeController = null;
  }
};

/* --------------------------------------------------------------------------
   11. CUSTOM ANIMATED CURSOR
   -------------------------------------------------------------------------- */
(() => {
  const cursor = document.querySelector('.cursor');
  const dot    = document.querySelector('.cursor-dot');
  if (!cursor || !dot) return;

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let cx = mx, cy = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform =
      `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });

  const loop = () => {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.transform =
      `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  const interactive = 'a, button, input, .repo, .card';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactive)) cursor.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactive)) cursor.classList.remove('is-hover');
  });
  document.addEventListener('mousedown', () => cursor.classList.add('is-click'));
  document.addEventListener('mouseup',   () => cursor.classList.remove('is-click'));
})();

/* --------------------------------------------------------------------------
   12. EVENTS
   -------------------------------------------------------------------------- */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  getUser(searchInput.value);
});

searchInput.addEventListener('input', debounce((e) => {
  const v = e.target.value.trim();
  if (v.length >= 2) getUser(v);
}));

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === 'Escape') searchInput.blur();
});

/* Token button */
tokenBtn?.addEventListener('click', () => {
  const current = getToken();
  const answer = prompt(
    'Paste a GitHub Personal Access Token\n' +
    '(no scopes required for public data)\n\n' +
    'Leave empty to remove the current token.',
    current ? '••••••••' : ''
  );
  if (answer === null) return;

  if (!answer.trim()) {
    clearToken();
    alert('Token removed. Back to 60 requests/hour.');
  } else {
    setToken(answer);
    alert('Token saved. You now have 5,000 requests/hour.');
  }
  memCache.clear();
  clearCache();
  const v = searchInput.value.trim();
  if (v) getUser(v);
});

/* Refresh button */
refreshBtn?.addEventListener('click', () => {
  clearCache();
  const v = searchInput.value.trim() || 'octocat';
  getUser(v);
});

/* --------------------------------------------------------------------------
   13. BOOT
   -------------------------------------------------------------------------- */
getUser('octocat');