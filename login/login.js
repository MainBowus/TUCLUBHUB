// ClubTU login page — show/hide password + basic validation feedback

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const togglePw = document.getElementById('togglePw');
  const formError = document.getElementById('formError');

  // Show / hide password
  if (togglePw && passwordInput) {
    togglePw.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      togglePw.textContent = isHidden ? '🙈' : '👁';
      togglePw.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    });
  }

  // Basic validation on submit
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

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

      formError.hidden = true;
      // Placeholder for real authentication — no backend connected in this mockup.
      alert('เข้าสู่ระบบสำเร็จ (ตัวอย่างดีไซน์ — ยังไม่เชื่อมระบบจริง)');
    });
  }

});