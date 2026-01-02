/* site script with client-side token generation + auth/profile UI
   - Requires firebase compat SDKs included in HTML (app, auth, firestore)
   - Replaces server-side function calls with client-side token generation and storing SHA-256 hash in Firestore
*/

/* ===== FIREBASE CONFIG (keep your config) ===== */
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

/* ===== Initialize Firebase (compat must already be loaded in the page) ===== */
if (typeof firebase === 'undefined' || !firebase.apps) {
  console.error('Firebase SDK not found. Make sure compat scripts are included in your pages.');
} else {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}
const auth = firebase.auth();
const db = firebase.firestore();

/* ===== Small helpers ===== */
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
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function firstCharForAvatar(displayName, username) {
  if (displayName && displayName.trim()) return displayName.trim()[0].toUpperCase();
  if (username && username.trim()) return username.trim()[0].toUpperCase();
  return 'C';
}

/* ===== Pages dropdown wiring ===== */
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
  document.addEventListener('click', () => {
    if (menu.classList.contains('show')) {
      menu.classList.remove('show');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      menu.classList.add('show');
      btn.setAttribute('aria-expanded','true');
      const first = menu.querySelector('a');
      if (first) first.focus();
    }
  });
}

/* ===== CLIENT-SIDE TOKEN GENERATION =====
 - generateRandomToken(): creates a high-entropy token (base64url)
 - sha256Hex(token): returns hex string of SHA-256(token) using SubtleCrypto
 - storeTokenHash(uid, tokenHash): writes to Firestore users/{uid}/tokens subcollection
 - createAndStoreTokenForUser(user): returns plaintext token (show once) or throws
*/
function generateRandomToken() {
  // 24 bytes => 32 chars base64 url safe
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  // base64url encode
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b64;
}

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

async function storeTokenHash(uid, tokenHash) {
  // store as subcollection token doc with createdAt
  return db.collection('users').doc(uid).collection('tokens').add({
    tokenHash,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function createAndStoreTokenForUser(user) {
  if (!user || !user.uid) throw new Error('User must be signed in to create token');
  const plaintext = generateRandomToken();
  const hash = await sha256Hex(plaintext);
  await storeTokenHash(user.uid, hash);
  return plaintext;
}

/* ===== Token popup (one-time display) ===== */
function showTokenPopup(token) {
  let popup = el('__tokenPopup');
  if (popup) popup.remove();
  popup = mk('div', { id: '__tokenPopup' });
  Object.assign(popup.style, {
    position: 'fixed', left: '50%', top: '50%', transform:'translate(-50%,-50%)',
    zIndex: 220, minWidth: '300px', maxWidth: '92%', padding: '18px',
    background: 'linear-gradient(180deg, rgba(10,14,22,0.99), rgba(8,12,20,0.95))',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', boxShadow: '0 18px 50px rgba(0,0,0,0.6)', color:'#e9f1ff'
  });
  popup.innerHTML = `
    <h4 style="margin:0 0 8px 0">Your token — keep it secret</h4>
    <p style="margin:0 0 12px;color:var(--muted)">
      This token was generated for your account. It will be shown once. Never share it publicly.
    </p>
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

/* ===== NAVBAR PROFILE RENDER & behavior ===== */
async function renderProfileNav(userDoc, firebaseUser) {
  let nav = el('profileNav');
  if (!nav) {
    const topCta = document.querySelector('.top-cta');
    if (topCta) {
      nav = mk('div', { id: 'profileNav', style: 'margin-left:12px;' });
      topCta.appendChild(nav);
    } else return;
  }

  if (!firebaseUser) {
    nav.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
    return;
  }

  const username = (userDoc && userDoc.username) ? userDoc.username : (firebaseUser.displayName || firebaseUser.email || 'Account');
  const avatarChar = firstCharForAvatar(firebaseUser.displayName, (userDoc && userDoc.username));

  nav.innerHTML = `
    <div class="profile-menu" style="position:relative;">
      <button id="profileBtnMenu" class="btn btn--ghost" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:8px;">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(90deg,var(--red),var(--blue));display:inline-flex;align-items:center;justify-content:center;color:#071022;font-weight:700;">${avatarChar}</span>
        <span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(username)}</span> ▾
      </button>
      <div id="profileDropdown" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:linear-gradient(180deg, rgba(11,15,24,0.98), rgba(6,8,12,0.95)); border:1px solid rgba(255,255,255,0.04); padding:10px; border-radius:10px; box-shadow:0 10px 40px rgba(2,6,12,0.6); z-index:60;">
        <a id="navViewProfile" class="btn btn--glass" href="profile.html" style="display:block;margin-bottom:8px">Account</a>
        <button id="navGenToken" class="btn btn--ghost" style="display:block;margin-bottom:8px">Get Token</button>
        <button id="navLogout" class="btn btn--ghost" style="display:block">Log out</button>
      </div>
    </div>
  `;

  const btn = el('profileBtnMenu');
  const dropdown = el('profileDropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded','false');
    }
  });

  const navLogout = el('navLogout');
  if (navLogout) navLogout.addEventListener('click', async () => {
    try { await auth.signOut(); } catch (e) { console.error(e); alert('Logout error'); }
  });

  const navGen = el('navGenToken');
  if (navGen) {
    navGen.addEventListener('click', async () => {
      if (!confirm('Generate a token for your account? The token will be displayed once. Never share it. Proceed?')) return;
      try {
        const token = await createAndStoreTokenForUser(auth.currentUser);
        showTokenPopup(token);
      } catch (err) {
        console.error('Token generation error (client-side):', err);
        alert('Error generating token client-side: ' + (err.message || err));
      }
    });
  }
}

/* ===== Profile page wiring (sign-in, sign-up, save profile, token generation) ===== */
function wireProfilePage() {
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

  function showSignedOut() {
    if (signedOutView) signedOutView.style.display = 'block';
    if (signedInView) signedInView.style.display = 'none';
  }
  function showSignedIn() {
    if (signedOutView) signedOutView.style.display = 'none';
    if (signedInView) signedInView.style.display = 'block';
  }

  // Google sign-in with auto token generation
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const res = await auth.signInWithPopup(provider);
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
        // ensure ID token ready (helpful) then create token client-side
        try {
          await auth.currentUser.getIdToken(true);
        } catch (e) { /* ignore */ }
        try {
          const token = await createAndStoreTokenForUser(user);
          // show token in UI (if token box present) or popup
          if (lastTokenBox && lastTokenInput) {
            lastTokenBox.style.display = 'block';
            lastTokenInput.value = token;
          } else {
            showTokenPopup(token);
          }
        } catch (err) {
          console.error('Auto token generation error', err);
          // show non-blocking message
          alert('Account created but failed to generate token client-side: ' + (err.message || err));
        }
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-in error';
      }
    });
  }

  // Email sign up with auto token generation
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
        // ensure ID token settled
        try { await auth.currentUser.getIdToken(true); } catch(e){/*ignore*/}
        // generate token client-side
        try {
          const token = await createAndStoreTokenForUser(user);
          if (lastTokenBox && lastTokenInput) {
            lastTokenBox.style.display = 'block';
            lastTokenInput.value = token;
          } else {
            showTokenPopup(token);
          }
        } catch (err) {
          console.error('Token generation after signup failed', err);
          alert('Account created, but failed to generate a token client-side: ' + (err.message || err));
        }
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-up error';
      }
    });
  }

  // Email sign-in
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
      if (!user) return alert('You must be signed in to save your profile.');
      const usernameVal = (usernameInput.value || '').trim();
      const bioVal = (bioInput.value || '').trim().slice(0,300);
      if (!/^[A-Za-z0-9_.]{4,20}$/.test(usernameVal)) {
        return alert('Username must be 4-20 characters and only letters, numbers, underscores and periods.');
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
        alert('Error saving profile: ' + (err.message || err));
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

  // Manual generate token on profile page
  if (generateTokenBtn) {
    generateTokenBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return alert('Sign in to generate a token.');
      if (!confirm('Generate a new token for your account? The token will be shown once. Never share it. Proceed?')) return;
      try {
        const token = await createAndStoreTokenForUser(user);
        if (lastTokenBox && lastTokenInput) {
          lastTokenBox.style.display = 'block';
          lastTokenInput.value = token;
        } else {
          showTokenPopup(token);
        }
      } catch (err) {
        console.error('Token generation error (client-side):', err);
        alert('Error generating token client-side: ' + (err.message || err));
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

  // observe auth state to populate UI
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

/* ===== Auth state handling for navbar and realtime profile doc subscription ===== */
let userDocUnsub = null;
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    renderProfileNav(null, null);
    return;
  }
  // subscribe to user doc
  try {
    const docRef = db.collection('users').doc(user.uid);
    if (typeof userDocUnsub === 'function') userDocUnsub();
    userDocUnsub = docRef.onSnapshot((snap) => {
      const data = snap.exists ? snap.data() : null;
      renderProfileNav(data, user);
    });
  } catch (err) {
    console.error('Error subscribing to user doc', err);
    renderProfileNav(null, user);
  }
});

/* ===== Wire dropdown & profile page on DOM ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  wirePagesDropdown();
  wireProfilePage();

  // ensure profileNav exists
  if (!el('profileNav')) {
    const topCta = document.querySelector('.top-cta');
    if (topCta) {
      const p = mk('div', { id: 'profileNav', style: 'margin-left:12px;' });
      p.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
      topCta.appendChild(p);
    }
  }

  // set footer year if present
  const y = el('year');
  if (y) y.textContent = new Date().getFullYear();
});
