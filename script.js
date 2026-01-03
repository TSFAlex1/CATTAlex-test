/* =========================
   Firebase init
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyBgAw8v4n_wOaqRGWSUVNPNlICauTviXgw",
  authDomain: "cattalex-4b13a.firebaseapp.com",
  projectId: "cattalex-4b13a",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

/* =========================
   Pages dropdown (WORKS WITH YOUR HTML)
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('pagesBtn');
  const menu = document.getElementById('pagesMenu');

  if (btn && menu) {
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
});

/* =========================
   Profile nav render (ONLY #profileNav)
   ========================= */
function renderProfileNav(user) {
  const nav = document.getElementById('profileNav');
  if (!nav) return;

  /* LOGGED OUT */
  if (!user) {
    nav.innerHTML = `
      <button id="loginBtn" class="btn btn--ghost">
        Log in / Sign up
      </button>
    `;

    document.getElementById('loginBtn').onclick = async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    };

    return;
  }

  /* LOGGED IN */
  const name = user.displayName || user.email || 'User';
  const avatarLetter = name[0].toUpperCase();

  nav.innerHTML = `
    <div class="account">
      <button class="account-btn" id="accountBtn">
        <span class="avatar">${avatarLetter}</span>
        <span class="account-name">${name}</span>
        ▾
      </button>

      <div class="account-dropdown" id="accountDropdown">
        <a href="profile.html">Account settings</a>
        <button id="tokenBtn">User token</button>
        <button id="logoutBtn">Log out</button>
      </div>
    </div>
  `;

  const account = nav.querySelector('.account');
  const btn = document.getElementById('accountBtn');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    account.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    account.classList.remove('open');
  });

  document.getElementById('logoutBtn').onclick = () => auth.signOut();

  document.getElementById('tokenBtn').onclick = () => {
    alert(
      'WARNING:\n\nThis user token identifies your account.\nDo NOT share it with anyone.'
    );
  };
}

/* =========================
   Auth state
   ========================= */
auth.onAuthStateChanged(user => {
  renderProfileNav(user);
});

/* =========================
   Footer year
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});
