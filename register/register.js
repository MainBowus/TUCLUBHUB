// ClubTU register page — password strength meter, validation, and Firebase Auth

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// TODO: apiKey ตัวนี้เอาไว้ระบุโปรเจกต์เฉยๆ ไม่ใช่ความลับ (ปลอดภัยที่จะฝังในโค้ดฝั่ง client)
// แต่ต้องไปตั้ง Firestore Security Rules และเปิด Email/Password sign-in ใน Firebase Console ให้เรียบร้อยด้วย
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

  const form = document.getElementById('registerForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const studentIdInput = document.getElementById('student_id');
  const facultySelect = document.getElementById('faculty');
  const yearSelect = document.getElementById('year');
  const termsCheckbox = document.getElementById('terms');
  const pwStrength = document.getElementById('pwStrength');
  const pwHint = document.getElementById('pwHint');
  const formError = document.getElementById('formError');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  const strengthBars = pwStrength ? pwStrength.querySelectorAll('span') : [];

  // ===== Password strength meter =====
  function getPasswordScore(value) {
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return score; // 0-4
  }

  function updateStrengthMeter() {
    if (!passwordInput || strengthBars.length === 0) return;

    const value = passwordInput.value;
    const score = getPasswordScore(value);

    strengthBars.forEach((bar, i) => {
      bar.classList.remove('weak', 'okay', 'good');
      if (i >= score) return;
      if (score <= 1) bar.classList.add('weak');
      else if (score <= 2) bar.classList.add('okay');
      else bar.classList.add('good');
    });

    if (!value) {
      pwHint.textContent = 'อย่างน้อย 8 ตัวอักษร';
    } else if (score <= 1) {
      pwHint.textContent = 'รหัสผ่านยังไม่ปลอดภัยพอ ลองเพิ่มตัวเลขหรืออักษรพิเศษ';
    } else if (score <= 2) {
      pwHint.textContent = 'พอใช้ได้ ลองเพิ่มความยาวหรือความหลากหลาย';
    } else {
      pwHint.textContent = 'รหัสผ่านนี้ค่อนข้างปลอดภัย';
    }
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', updateStrengthMeter);
    updateStrengthMeter();
  }

  // ===== Map Firebase error codes to Thai messages =====
  function firebaseErrorMessage(error) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน';
      case 'auth/invalid-email':
        return 'รูปแบบอีเมลไม่ถูกต้อง';
      case 'auth/weak-password':
        return 'รหัสผ่านนี้ยังไม่ปลอดภัยพอ (ต้องมีอย่างน้อย 6 ตัวอักษร)';
      case 'auth/network-request-failed':
        return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง';
      default:
        return 'สมัครสมาชิกไม่สำเร็จ (' + error.code + ')';
    }
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี';
  }

  // ===== Form submit → Firebase Auth + Firestore profile =====
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.hidden = true;

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const studentId = studentIdInput.value.trim();
      const faculty = facultySelect.value;
      const year = yearSelect.value;

      // --- client-side validation ---
      const requiredFields = form.querySelectorAll('[required]');
      let firstInvalid = null;

      requiredFields.forEach(field => {
        field.classList.remove('invalid');
        if (!field.value) {
          field.classList.add('invalid');
          if (!firstInvalid) firstInvalid = field;
        }
      });

      let message = '';
      if (firstInvalid) {
        message = 'กรุณากรอกข้อมูลให้ครบทุกช่องก่อนสร้างบัญชี';
      } else if (password.length < 8) {
        passwordInput.classList.add('invalid');
        message = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
      } else if (!termsCheckbox.checked) {
        message = 'กรุณายอมรับข้อกำหนดการใช้งานก่อนสร้างบัญชี';
      }

      if (message) {
        formError.textContent = message;
        formError.hidden = false;
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // --- create the Firebase account ---
      setSubmitting(true);
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // save the extra student profile fields in Firestore, keyed by uid
        await setDoc(doc(db, 'students', uid), {
          email,
          studentId,
          faculty,
          year,
          createdAt: new Date().toISOString()
        });

        alert('สร้างบัญชีสำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ');
        window.location.href = '/login/login.html';

      } catch (error) {
        formError.textContent = firebaseErrorMessage(error);
        formError.hidden = false;
      } finally {
        setSubmitting(false);
      }
    });
  }

});