/* Global site script
 - Pages dropdown toggle
 - Firebase init (compat)
 - Auth handling and navbar profile UI
 - Profile page sign-in / sign-up (Google + email)
 - Profile edit (username, bio)
 - Generate per-user token (calls createUserToken cloud function)
 - Small token popup + warning UI
Make sure this file is loaded after your HTML (script tag at bottom) and styles.css is present.
*/

/* ===== FIREBASE CONFIG - keep as provided ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBgAw8v4n_wOaqRGWSUVNPNlICauTviXgw",
  authDomain: "cattalex-4b13a.firebaseapp.com",
  databaseURL: "https://cattalex-4b13a-default-rtdb.firebaseio.com",
  projectId: "cattalex-4b13a",
  storageBucket: "cattalex-4b13a.firebasestorage.app",
  messagingSenderId: "540197793526",
  appId: "1:540197793526:web:06ca0778f42478d0b6c6d7",
  measurementId: "G-N37NGG26JD"
};

/* ===== Initialize firebase compat if not already ===== */
if (typeof firebase === 'undefined' || !firebase.apps) {
  console.error('Firebase SDK not found. Make sure firebase compat scripts are included in your HTML.');
} else {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

/* ===== Helpers ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const el = id => document.getElementById(id);
function mk(tag, attrs = {}) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  return e;
}
function firstCharForAvatar(displayName, username) {
  if (displayName && displayName.trim()) return displayName.trim()[0].toUpperCase();
  if (username && username.trim()) return username.trim()[0].toUpperCase();
  return 'C';
}

/* ===== Pages dropdown behavior ===== */
function wirePagesDropdown() {
  const btn = el('pagesBtn');
  const menu = el('pagesMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const is = menu.classList.contains('show');
    if (is) {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      menu.classList.add('show');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
  // close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  // keyboard accessibility
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); menu.classList.add('show'); btn.setAttribute('aria-expanded','true'); const first = menu.querySelector('a'); if (first) first.focus(); }
  });
}

/* ===== Navbar profile rendering =====
 - Looks for an element with id="profileNav". If missing, creates a simple link appended to .top-cta.
 - When logged out: show a "Profile" link to profile.html
 - When logged in: show compact avatar + username and a dropdown with:
    - View / Edit Profile (profile.html)
    - Generate Token (calls createUserToken)
    - Logout
*/
let currentUserDoc = null;

async function renderProfileNav(userDoc, firebaseUser) {
  // find container
  let nav = el('profileNav');
  if (!nav) {
    // try to create one in the header's .top-cta
    const topCtas = document.querySelector('.top-cta');
    if (topCtas) {
      nav = mk('div', { id: 'profileNav', style: 'margin-left:12px;' });
      topCtas.appendChild(nav);
    } else {
      return;
    }
  }

  if (!firebaseUser) {
    // logged out - show Profile link only
    nav.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
    return;
  }

  // logged in - show avatar & name with dropdown
  const username = (userDoc && userDoc.username) ? userDoc.username : (firebaseUser.displayName || firebaseUser.email || 'Account');
  const avatarChar = firstCharForAvatar(firebaseUser.displayName, (userDoc && userDoc.username));
  nav.innerHTML = `
    <div class="profile-menu" style="position:relative;">
      <button id="profileBtnMenu" class="btn btn--ghost" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:8px;">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(90deg,var(--red),var(--blue));display:inline-flex;align-items:center;justify-content:center;color:#071022;font-weight:700;">${avatarChar}</span>
        <span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(username)}</span> ▾
      </button>
      <div id="profileDropdown" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:linear-gradient(180deg, rgba(11,15,24,0.98), rgba(6,8,12,0.95)); border:1px solid rgba(255,255,255,0.04); padding:10px; border-radius:10px; box-shadow:0 10px 40px rgba(2,6,12,0.6); z-index:60;">
        <a id="navViewProfile" class="btn btn--glass" href="profile.html" style="display:block;margin-bottom:8px">Account</a>
        <button id="navGenToken" class="btn btn--ghost" style="display:block;margin-bottom:8px">Get Token</button>
        <button id="navLogout" class="btn btn--ghost" style="display:block">Log out</button>
      </div>
    </div>
  `;
  // wire dropdown
  const btn = el('profileBtnMenu');
  const dropdown = el('profileDropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!open));
  });
  // close when clicking outside
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded','false');
    }
  });
  // wire logout
  const ln = el('navLogout');
  if (ln) ln.addEventListener('click', async () => {
    try { await auth.signOut(); } catch(e) { console.error(e); alert('Logout error'); }
  });
  // wire generate token -> show same flow as profile page: call createUserToken and show popup
  const genBtn = el('navGenToken');
  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      if (!confirm('Generate a token for your account? The token will be displayed once. Never share it. Proceed?')) return;
      try {
        const callable = functions.httpsCallable('createUserToken');
        const res = await callable({});
        const token = (res && res.data && res.data.token) ? res.data.token : null;
        if (!token) return alert('No token returned from server. Check functions deployment.');
        showTokenPopup(token);
      } catch (err) {
        console.error('createUserToken error', err);
        alert('Error generating token. Ensure Cloud Functions are deployed and callable.');
      }
    });
  }
}

/* ===== Utility: token popup + warning ===== */
function showTokenPopup(token) {
  // create simple modal elements
  // warning + token box + copy button + close
  let popup = el('__tokenPopup');
  if (popup) popup.remove();

  popup = mk('div', { id: '__tokenPopup' });
  Object.assign(popup.style, {
    position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
    zIndex: 200, minWidth: '280px', maxWidth: '92%', padding: '18px',
    background: 'linear-gradient(180deg, rgba(10,14,22,0.99), rgba(8,12,20,0.95))',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', boxShadow: '0 18px 50px rgba(0,0,0,0.6)', color:'#e9f1ff'
  });
  popup.innerHTML = `
    <h4 style="margin:0 0 8px 0">Your token — keep it secret</h4>
    <p style="margin:0 0 12px;color:var(--muted)">This token was generated for your account. It will be shown once. Never share it publicly.</p>
    <div style="display:flex;gap:8px;align-items:center">
      <input id="__tokenVal" readonly style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:#fff" />
      <button id="__tokenCopy" class="btn btn--accent">Copy</button>
    </div>
    <div style="text-align:right;margin-top:12px">
      <button id="__tokenClose" class="btn btn--glass">Close</button>
    </div>
  `;
  document.body.appendChild(popup);
  el('__tokenVal').value = token;
  el('__tokenCopy').addEventListener('click', () => {
    el('__tokenVal').select();
    document.execCommand('copy');
    alert('Token copied to clipboard. Store it safely.');
  });
  el('__tokenClose').addEventListener('click', () => popup.remove());
}

/* ===== Profile page logic (if profile.html present) ===== */
function wireProfilePage() {
  // elements we expect to exist on profile.html
  const googleSignInBtn = el('googleSignIn');
  const emailSignInBtn = el('emailSignIn');
  const emailSignUpBtn = el('emailSignUp');
  const emailInput = el('emailInput');
  const passwordInput = el('passwordInput');
  const authMsg = el('authMsg');
  const saveProfileBtn = el('saveProfile');
  const usernameInput = el('usernameInput');
  const bioInput = el('bioInput');
  const logoutBtn = el('logoutBtn');
  const generateTokenBtn = el('generateToken');
  const lastTokenBox = el('lastTokenBox');
  const lastTokenInput = el('lastToken');
  const copyTokenBtn = el('copyToken');
  const signedOutView = el('signedOutView');
  const signedInView = el('signedInView');
  const profileAvatar = el('profileAvatar');

  if (!googleSignInBtn && !emailSignInBtn && !signedOutView && !signedInView) return; // not on profile page

  // utility to show views
  function showSignedOut() {
    if (signedOutView) signedOutView.style.display = 'block';
    if (signedInView) signedInView.style.display = 'none';
  }
  function showSignedIn() {
    if (signedOutView) signedOutView.style.display = 'none';
    if (signedInView) signedInView.style.display = 'block';
  }

  // Google sign-in
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const res = await auth.signInWithPopup(provider);
        // ensure user doc exists
        const user = res.user;
        const docRef = db.collection('users').doc(user.uid);
        const snap = await docRef.get();
        if (!snap.exists) {
          await docRef.set({
            username: (user.displayName || user.email.split('@')[0]).replace(/\s+/g,'.').slice(0,20),
            bio: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-in error';
      }
    });
  }

  // Email SignUp
  if (emailSignUpBtn) {
    emailSignUpBtn.addEventListener('click', async () => {
      if (!emailInput || !passwordInput) return;
      try {
        const email = emailInput.value.trim();
        const pw = passwordInput.value;
        const cred = await auth.createUserWithEmailAndPassword(email, pw);
        const user = cred.user;
        await db.collection('users').doc(user.uid).set({
          username: email.split('@')[0].slice(0,20),
          bio: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-up error';
      }
    });
  }

  // Email SignIn
  if (emailSignInBtn) {
    emailSignInBtn.addEventListener('click', async () => {
      try {
        const email = emailInput.value.trim();
        const pw = passwordInput.value;
        await auth.signInWithEmailAndPassword(email, pw);
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-in error';
      }
    });
  }

  // Save profile
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) { alert('Please sign in'); return; }
      const usernameVal = (usernameInput.value || '').trim();
      const bioVal = (bioInput.value || '').trim().slice(0, 300);
      if (!/^[A-Za-z0-9_.]{4,20}$/.test(usernameVal)) {
        alert('Username must be 4-20 characters and only letters, numbers, underscores and periods.');
        return;
      }
      try {
        await db.collection('users').doc(user.uid).set({
          username: usernameVal,
          bio: bioVal,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert('Profile saved.');
      } catch (err) {
        console.error(err);
        alert('Error saving profile');
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // Generate token (profile page button)
  if (generateTokenBtn) {
    generateTokenBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) { alert('Sign in to generate a token.'); return; }
      if (!confirm('Generate a new token for your account? The token will be shown once. Never share it. Proceed?')) return;
      try {
        const callable = functions.httpsCallable('createUserToken');
        const res = await callable({});
        const token = res.data && res.data.token;
        if (token) {
          if (lastTokenBox) lastTokenBox.style.display = 'block';
          if (lastTokenInput) lastTokenInput.value = token;
        } else {
          alert('No token returned from server.');
        }
      } catch (err) {
        console.error(err);
        alert('Error generating token (check Cloud Functions).');
      }
    });
  }

  if (copyTokenBtn) {
    copyTokenBtn.addEventListener('click', () => {
      if (!lastTokenInput) return;
      lastTokenInput.select();
      document.execCommand('copy');
      alert('Token copied. Store it safely.');
    });
  }

  // Firestore listener for current user document to populate form
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      showSignedOut();
      return;
    }
    showSignedIn();
    try {
      const docRef = db.collection('users').doc(user.uid);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : null;
      if (usernameInput) usernameInput.value = data && data.username ? data.username : '';
      if (bioInput) bioInput.value = data && data.bio ? data.bio : '';
      if (profileAvatar) profileAvatar.textContent = firstCharForAvatar(user.displayName, data && data.username);
    } catch (err) {
      console.error('Error loading profile doc', err);
    }
  });
}

/* ===== Auth state change: update navbar and run profile wiring ===== */
let userDocUnsub = null;
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // no user -> show Profile link in nav
    renderProfileNav(null, null);
    // ensure profile page UI shows sign in UI if present
    // (profile wiring will do this via its own listener on load)
  } else {
    // fetch user doc (one-time) then render nav
    try {
      const docRef = db.collection('users').doc(user.uid);
      // try realtime subscription for profile updates
      if (typeof userDocUnsub === 'function') userDocUnsub();
      userDocUnsub = docRef.onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : null;
        currentUserDoc = data;
        renderProfileNav(data, user);
      });
    } catch (err) {
      console.error('Error fetching user doc', err);
      renderProfileNav(null, user);
    }
  }
});

/* ===== Misc page wiring on DOM ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  wirePagesDropdown();
  wireProfilePage();

  // Year in footer (if present)
  const yearEl = el('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Make sure nav profile area exists on pages that had the older markup
  const nav = el('profileNav');
  if (!nav) {
    // attempt to append a placeholder to header if desired (but do not remove existing layout)
    const topCta = document.querySelector('.top-cta');
    if (topCta) {
      const placeholder = mk('div', { id: 'profileNav', style: 'margin-left:12px;' });
      placeholder.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
      topCta.appendChild(placeholder);
    }
  }
});

/* ===== Small helper: safe HTML escape for username display ===== */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}
