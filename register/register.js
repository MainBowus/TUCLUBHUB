
document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('registerForm');
  const passwordInput = document.getElementById('password');
  const pwStrength = document.getElementById('pwStrength');
  const pwHint = document.getElementById('pwHint');
  const termsCheckbox = document.getElementById('terms');
  const formError = document.getElementById('formError');

  const strengthBars = pwStrength ? pwStrength.querySelectorAll('span') : [];

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

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let message = '';
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
        message = 'กรุณากรอกข้อมูลให้ครบทุกช่องก่อนสร้างบัญชี';
      } else if (passwordInput && passwordInput.value.length < 8) {
        passwordInput.classList.add('invalid');
        message = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
      } else if (termsCheckbox && !termsCheckbox.checked) {
        message = 'กรุณายอมรับข้อกำหนดการใช้งานก่อนสร้างบัญชี';
      }

      if (message) {
        formError.textContent = message;
        formError.hidden = false;
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      formError.hidden = true;
      // Placeholder for real submission — no backend connected in this mockup.
      alert('สร้างบัญชีสำเร็จ (ตัวอย่างดีไซน์ — ยังไม่เชื่อมระบบจริง)');
    });
  }

});