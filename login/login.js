// ClubTU login page — Firebase Auth sign-in + fetch student profile from Firestore

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdpVxCs6DG95KZWq3bGJGwgJwjPfaL5x4",
  authDomain: "login-tuclub.firebaseapp.com",
  projectId: "login-tuclub",
  storageBucket: "login-tuclub.firebasestorage.app",
  messagingSenderId: "231949365976",
  appId: "1:231949365976:web:c5b0d6bf6e218b0f305dad",
  measurementId: "G-ZMDV54K9EC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePw = document.getElementById('togglePw');
  const rememberCheckbox = document.getElementById('remember');
  const formError = document.getElementById('formError');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  // ===== Show / hide password =====
  if (togglePw && passwordInput) {
    togglePw.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      togglePw.textContent = isHidden ? '🙈' : '👁';
      togglePw.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    });
  }

  function firebaseErrorMessage(error) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'รูปแบบอีเมลไม่ถูกต้อง';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'ไม่พบบัญชีนี้ หรืออีเมล/รหัสผ่านไม่ถูกต้อง';
      case 'auth/wrong-password':
        return 'รหัสผ่านไม่ถูกต้อง';
      case 'auth/too-many-requests':
        return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
      case 'auth/network-request-failed':
        return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง';
      default:
        return 'เข้าสู่ระบบไม่สำเร็จ (' + error.code + ')';
    }
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ';
  }

  // ===== Form submit → Firebase sign-in + fetch profile =====
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.hidden = true;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const requiredFields = form.querySelectorAll('[required]');
      let firstInvalid = null;

      requiredFields.forEach(field => {
        field.classList.remove('invalid');
        if (!field.value) {
          field.classList.add('invalid');
          if (!firstInvalid) firstInvalid = field;
        }
      });

      if (firstInvalid) {
        formError.textContent = 'กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ';
        formError.hidden = false;
        firstInvalid.focus();
        return;
      }

      setSubmitting(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // fetch the extra student profile fields saved during registration
        const snapshot = await getDoc(doc(db, 'students', uid));
        const profile = snapshot.exists() ? snapshot.data() : null;

        // stash profile in sessionStorage so dashboard.html can read it right away
        // (dashboard also re-fetches from Firestore on its own via onAuthStateChanged,
        // this is just to avoid a flash of empty state)
        if (profile) {
          sessionStorage.setItem('clubtu_profile', JSON.stringify(profile));
        }

        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem('clubtu_remember_email', email);
        }

        window.location.href = '/dashboard/dashboard.html';

      } catch (error) {
        formError.textContent = firebaseErrorMessage(error);
        formError.hidden = false;
      } finally {
        setSubmitting(false);
      }
    });
  }

  // pre-fill remembered email, if any
  const rememberedEmail = localStorage.getItem('clubtu_remember_email');
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

});