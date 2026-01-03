/* ===== Helpers ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const el = id => document.getElementById(id);
const mk = (t, attrs = {}) => {
  const e = document.createElement(t);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  return e;
};

/* ===== Pages dropdown (FIXED) ===== */
function wirePagesDropdown() {
  const btn = el('pagesBtn');
  const menu = el('pagesMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ===== Profile navbar (SAFE render) ===== */
function renderProfileNav(userDoc, firebaseUser) {
  const nav = el('profileNav');
  if (!nav) return;

  // signed out
  if (!firebaseUser) {
    if (nav.dataset.state === 'signed-out') return;
    nav.dataset.state = 'signed-out';
    nav.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
    return;
  }

  // signed in
  if (nav.dataset.state === 'signed-in') return;
  nav.dataset.state = 'signed-in';

  const name =
    (userDoc && userDoc.username) ||
    firebaseUser.displayName ||
    firebaseUser.email ||
    'Account';

  nav.innerHTML = `
    <div class="profile-menu" style="position:relative;">
      <button id="profileBtnMenu" class="btn btn--ghost" aria-expanded="false">
        ${name} ▾
      </button>
      <div id="profileDropdown" hidden>
        <a class="btn btn--glass" href="profile.html">Account</a>
        <button id="navLogout" class="btn btn--ghost">Log out</button>
      </div>
    </div>
  `;

  const btn = el('profileBtnMenu');
  const menu = el('profileDropdown');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !menu.hasAttribute('hidden');
    menu.toggleAttribute('hidden', open);
    btn.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  el('navLogout')?.addEventListener('click', async () => {
    await firebase.auth().signOut();
    location.reload();
  });
}

/* ===== Firebase ===== */
const auth = firebase.auth();
const db = firebase.firestore();

/* ===== Auth state ===== */
let unsub = null;
auth.onAuthStateChanged(user => {
  if (!user) {
    if (unsub) unsub();
    renderProfileNav(null, null);
    return;
  }

  const ref = db.collection('users').doc(user.uid);
  unsub = ref.onSnapshot(snap => {
    renderProfileNav(snap.exists ? snap.data() : null, user);
  });
});

/* ===== DOM ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  wirePagesDropdown();

  // footer year
  const y = el('year');
  if (y) y.textContent = new Date().getFullYear();
});
