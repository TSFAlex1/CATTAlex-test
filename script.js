// site-wide script: Firebase init, auth handling, navbar profile, profile page logic, token generation

// ----- Firebase configuration (provided by you) -----
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

// Initialize Firebase (compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

// Use emulator settings during local dev if desired (uncomment and configure)
// functions.useEmulator("localhost", 5001);

// ----- Utility helpers -----
function el(id) { return document.getElementById(id); }
function $(sel, root=document) { return root.querySelector(sel); }

// default avatar generation: show first character of display name or "C"
function defaultAvatarText(displayName, username) {
  if (displayName && displayName.trim()) return displayName.trim()[0].toUpperCase();
  if (username && username.trim()) return username.trim()[0].toUpperCase();
  return 'C';
}

// ----- Navbar profile rendering -----
function renderProfileNav(userDoc) {
  const nav = el('profileNav');
  if (!nav) return;
  auth.onAuthStateChanged(null); // noop to be safe
  const user = auth.currentUser;
  if (!user) {
    // logged out: simple Profile button linking to profile.html
    nav.innerHTML = `<a class="btn btn--ghost" href="profile.html">Profile</a>`;
    return;
  }

  // logged in: show avatar + dropdown
  const username = (userDoc && userDoc.username) ? userDoc.username : (user.displayName || user.email || 'User');
  const avatarChar = defaultAvatarText(user.displayName, userDoc && userDoc.username);
  nav.innerHTML = `
    <div class="profile-menu" style="position:relative;">
      <button id="profileBtnMenu" class="btn btn--ghost" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:8px;">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(90deg,var(--red),var(--blue));display:inline-flex;align-items:center;justify-content:center;color:#071022;font-weight:700;">${avatarChar}</span>
        <span>${username}</span> ▾
      </button>
      <div id="profileDropdown" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:linear-gradient(180deg, rgba(11,15,24,0.98), rgba(6,8,12,0.95)); border:1px solid rgba(255,255,255,0.04); padding:8px; border-radius:10px; box-shadow:0 10px 40px rgba(2,6,12,0.6); z-index:60;">
        <a href="profile.html" class="btn btn--glass" style="display:block;margin-bottom:8px">View / Edit Profile</a>
        <button id="navLogout" class="btn btn--ghost" style="display:block">Log out</button>
      </div>
    </div>
  `;
  const btn = el('profileBtnMenu');
  const dropdown = el('profileDropdown');
  btn.addEventListener('click', (e) => {
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', !open);
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      btn.setAttribute('aria-expanded','false');
    }
  });
  const navLogout = el('navLogout');
  if (navLogout) navLogout.addEventListener('click', () => auth.signOut());
}

// ----- Auth state + userDoc subscription -----
let userDocUnsub = null;
auth.onAuthStateChanged(async (user) => {
  // when auth changes, re-render navbar
  if (user) {
    // get user doc
    try {
      const docRef = db.collection('users').doc(user.uid);
      // subscribe realtime for profile updates, but if another page does not need realtime we can fetch once
      if (typeof userDocUnsub === 'function') userDocUnsub();
      userDocUnsub = docRef.onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : null;
        renderProfileNav(data);
        // if on profile page, update the form UI
        if (el('signedInView')) populateProfileForm(data, user);
      });
    } catch (err) {
      console.error('Error reading user doc:', err);
      renderProfileNav(null);
    }
  } else {
    // no user
    if (typeof userDocUnsub === 'function') userDocUnsub();
    userDocUnsub = null;
    renderProfileNav(null);
    // if profile page present, show sign in view
    if (el('signedOutView')) showSignedOutUI();
  }
});

// ----- PROFILE PAGE: helper functions -----
function showSignedOutUI() {
  if (el('signedOutView')) {
    el('signedOutView').style.display = 'block';
  }
  if (el('signedInView')) {
    el('signedInView').style.display = 'none';
  }
}
function showSignedInUI() {
  if (el('signedOutView')) el('signedOutView').style.display = 'none';
  if (el('signedInView')) el('signedInView').style.display = 'block';
}
function populateProfileForm(data, user) {
  showSignedInUI();
  if (el('usernameInput')) el('usernameInput').value = (data && data.username) ? data.username : '';
  if (el('bioInput')) el('bioInput').value = (data && data.bio) ? data.bio : '';
  if (el('profileAvatar')) el('profileAvatar').textContent = defaultAvatarText(user.displayName, data && data.username);
}

// ----- Profile page events (login/signup/edit) -----
document.addEventListener('DOMContentLoaded', () => {
  // Only run profile page logic when those elements exist
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

  // Google Sign-in
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const res = await auth.signInWithPopup(provider);
        // create user doc if missing
        const user = res.user;
        const docRef = db.collection('users').doc(user.uid);
        const snap = await docRef.get();
        if (!snap.exists) {
          await docRef.set({
            username: user.displayName ? user.displayName.replace(/\s+/g,'.').toLowerCase().slice(0,20) : user.email.split('@')[0],
            bio: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        // redirect or update UI will happen via auth listener
      } catch (err) {
        console.error(err);
        if (authMsg) authMsg.textContent = err.message || 'Sign-in error';
      }
    });
  }

  // Email sign up
  if (emailSignUpBtn) {
    emailSignUpBtn.addEventListener('click', async () => {
      if (!emailInput || !passwordInput) return;
      try {
        const email = emailInput.value.trim();
        const pw = passwordInput.value;
        const cred = await auth.createUserWithEmailAndPassword(email, pw);
        // create Firestore doc
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

  // Email sign in
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

  // Save profile (username & bio)
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return alert('You must be signed in to save your profile.');
      const usernameVal = (usernameInput.value || '').trim();
      const bioVal = (bioInput.value || '').trim().slice(0,300);
      // client-side username validation per policy: 4-20 chars, letters, numbers, underscores, periods
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
      // UI will update via auth listener
      window.location.href = 'index.html';
    });
  }

  // Generate per-user token (calls a server-side function createUserToken)
  if (generateTokenBtn) {
    generateTokenBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return alert('Sign in to generate a token.');
      if (!confirm('Generate a new token for your account? The token will be shown once. Never share it. Proceed?')) return;
      try {
        const callable = functions.httpsCallable('createUserToken');
        const res = await callable({});
        const token = res.data && res.data.token;
        if (token) {
          // display once
          if (lastTokenBox) lastTokenBox.style.display = 'block';
          if (lastTokenInput) lastTokenInput.value = token;
        } else {
          alert('No token returned from server.');
        }
      } catch (err) {
        console.error('createUserToken error', err);
        alert('Error generating token: ' + (err.message || err));
      }
    });
  }

  if (copyTokenBtn) {
    copyTokenBtn.addEventListener('click', () => {
      if (!lastTokenInput) return;
      lastTokenInput.select();
      document.execCommand('copy');
      alert('Token copied to clipboard — store it safely.');
    });
  }
});