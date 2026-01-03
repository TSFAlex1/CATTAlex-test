/* =========================
   SAFE SITE SCRIPT (NAV ONLY)
   ========================= */

/* Firebase init (unchanged) */
const firebaseConfig = {
  apiKey: "AIzaSyBgAw8v4n_wOaqRGWSUVNPNlICauTviXgw",
  authDomain: "cattalex-4b13a.firebaseapp.com",
  projectId: "cattalex-4b13a",
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* Helpers */
const el = id => document.getElementById(id);
const escapeHtml = s => s ? s.replace(/[&<>"']/g, m =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

/* =========================
   PAGES DROPDOWN (FIXED)
   ========================= */
function wirePagesDropdown() {
  const btn = el('pagesBtn');
  const menu = el('pagesMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', open);
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* =========================
   PROFILE NAV RENDER
   ========================= */
function renderProfileNav(userDoc, user) {
  const nav = el('profileNav');
  if (!nav) return;

  /* LOGGED OUT */
  if (!user) {
    nav.innerHTML = `
      <button id="loginGoogle" class="btn btn--ghost">
        Log in / Sign up
      </button>
    `;

    el('loginGoogle').onclick = async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    };
    return;
  }

  /* LOGGED IN */
  const username =
    (userDoc && userDoc.username) ||
    user.displayName ||
    user.email;

  const avatar = escapeHtml(username[0].toUpperCase());

  nav.innerHTML = `
    <div class="profile-menu" style="position:relative">
      <button id="profileBtn" class="btn btn--ghost" aria-expanded="false">
        <span class="avatar">${avatar}</span>
        ${escapeHtml(username)} ▾
      </button>
      <div id="profileMenu" class="profile-dropdown">
        <a href="profile.html">Account settings</a>
        <button id="genToken">User token</button>
        <button id="logout">Log out</button>
      </div>
    </div>
  `;

  const btn = el('profileBtn');
  const menu = el('profileMenu');

  btn.onclick = e => {
    e.stopPropagation();
    menu.classList.toggle('open');
  };

  document.addEventListener('click', () => menu.classList.remove('open'));

  el('logout').onclick = () => auth.signOut();

  el('genToken').onclick = async () => {
    alert(
      'WARNING:\n\nThis token identifies your account.\nDo NOT share it publicly.'
    );
  };
}

/* =========================
   AUTH STATE
   ========================= */
auth.onAuthStateChanged(async user => {
  if (!user) {
    renderProfileNav(null, null);
    return;
  }

  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  renderProfileNav(snap.exists ? snap.data() : null, user);
});

/* =========================
   DOM READY
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  wirePagesDropdown();
  const y = el('year');
  if (y) y.textContent = new Date().getFullYear();
});
