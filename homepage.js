import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdpVxCs6DG95KZWq3bGJGwgJwjPfaL5x4",
  authDomain: "login-tuclub.firebaseapp.com",
  projectId: "login-tuclub",
  storageBucket: "login-tuclub.firebasestorage.app",
  messagingSenderId: "231949365976",
  appId: "1:231949365976:web:c5b0d6bf6e218b0f305dad",
  measurementId: "G-ZMDV54K9EC"
};

const db = getFirestore(initializeApp(firebaseConfig));
let clubs = [];
let activeStudentCount = 0;
let activeCategory = '';
let quizIndex = 0;
let quizAnswers = [];
const quizQuestions = [
  { text: 'เวลาว่าง คุณอยากทำอะไรที่สุด?', options: [{ label: 'ออกกำลังกายและแข่งขัน', category: 'กีฬา' }, { label: 'สร้างงานศิลปะหรือการแสดง', category: 'ศิลปะ' }, { label: 'เขียนโค้ดหรือทดลองเทคโนโลยี', category: 'เทคโนโลยี' }, { label: 'ช่วยเหลือผู้คนและสังคม', category: 'อาสาพัฒนา' }] },
  { text: 'กิจกรรมแบบไหนทำให้คุณมีพลัง?', options: [{ label: 'ซ้อมและขึ้นเวที', category: 'ศิลปะการแสดง' }, { label: 'แก้โจทย์และเรียนรู้สิ่งใหม่', category: 'วิชาการ' }, { label: 'เล่นดนตรีหรือฟังเพลง', category: 'ดนตรี' }, { label: 'พบเพื่อนจากหลายวัฒนธรรม', category: 'นานาชาติ' }] },
  { text: 'คุณถนัดหรืออยากพัฒนาทักษะใด?', options: [{ label: 'การสื่อสารและการโน้มน้าว', category: 'โต้วาที' }, { label: 'การถ่ายภาพและเล่าเรื่องด้วยภาพ', category: 'ถ่ายภาพ' }, { label: 'การออกแบบและความคิดสร้างสรรค์', category: 'ศิลปะ' }, { label: 'การวางแผนและทำงานเป็นทีม', category: 'อาสาพัฒนา' }] },
  { text: 'ถ้าได้ทำโปรเจกต์หนึ่งชิ้น คุณจะเลือกอะไร?', options: [{ label: 'ทำแอปหรือเว็บไซต์', category: 'เทคโนโลยี' }, { label: 'จัดค่ายให้ชุมชน', category: 'อาสาพัฒนา' }, { label: 'ทำวิจัยหรือบทความ', category: 'วิชาการ' }, { label: 'จัดนิทรรศการหรือการแสดง', category: 'ศิลปะการแสดง' }] },
  { text: 'คุณชอบบรรยากาศของชมรมแบบไหน?', options: [{ label: 'คึกคักและท้าทาย', category: 'กีฬา' }, { label: 'สงบและได้โฟกัส', category: 'วิชาการ' }, { label: 'สนุก มีเสียงเพลง และเป็นกันเอง', category: 'ดนตรี' }, { label: 'เปิดกว้าง ได้รู้จักคนใหม่', category: 'นานาชาติ' }] },
  { text: 'หัวข้อไหนที่คุณอยากคุยได้นาน ๆ?', options: [{ label: 'ประเด็นสังคมและสิทธิ', category: 'โต้วาที' }, { label: 'นวัตกรรมและอนาคต', category: 'เทคโนโลยี' }, { label: 'ภาพยนตร์ แฟชั่น และงานสร้างสรรค์', category: 'ศิลปะ' }, { label: 'ธรรมชาติและชุมชน', category: 'อาสาพัฒนา' }] },
  { text: 'คุณอยากมีผลงานแบบไหนใน portfolio?', options: [{ label: 'เหรียญรางวัลหรือการแข่งขัน', category: 'กีฬา' }, { label: 'ผลงานภาพถ่าย', category: 'ถ่ายภาพ' }, { label: 'โปรเจกต์เทคโนโลยี', category: 'เทคโนโลยี' }, { label: 'การแสดงบนเวที', category: 'ศิลปะการแสดง' }] },
  { text: 'คุณอยากใช้เวลาหลังเลิกเรียนอย่างไร?', options: [{ label: 'ฝึกเครื่องดนตรี', category: 'ดนตรี' }, { label: 'อ่านและแลกเปลี่ยนความรู้', category: 'วิชาการ' }, { label: 'ฝึกพูดและนำเสนอ', category: 'โต้วาที' }, { label: 'ทำกิจกรรมเพื่อส่วนรวม', category: 'อาสาพัฒนา' }] },
  { text: 'ถ้าต้องชวนเพื่อนเข้าชมรม คุณจะใช้วิธีไหน?', options: [{ label: 'ทำโปสเตอร์สวย ๆ', category: 'ศิลปะ' }, { label: 'ทำคลิปหรือภาพเล่าเรื่อง', category: 'ถ่ายภาพ' }, { label: 'ชวนคุยด้วยเหตุผลและข้อมูล', category: 'โต้วาที' }, { label: 'ชวนไปลองกิจกรรมด้วยกัน', category: 'กีฬา' }] },
  { text: 'เป้าหมายจากการเข้าชมรมของคุณคืออะไร?', options: [{ label: 'ได้เพื่อนและประสบการณ์ใหม่', category: 'นานาชาติ' }, { label: 'พัฒนาทักษะเพื่ออาชีพ', category: 'เทคโนโลยี' }, { label: 'สร้างประโยชน์ให้สังคม', category: 'อาสาพัฒนา' }, { label: 'มีพื้นที่แสดงตัวตน', category: 'ศิลปะการแสดง' }] }
];
const $ = id => document.getElementById(id);
const escapeHtml = value => { const node = document.createElement('div'); node.textContent = value == null ? '' : String(value); return node.innerHTML; };
const asDate = value => value && value.toDate ? value.toDate() : new Date(value);
const formatDate = value => { const date = asDate(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; };
const daysUntil = value => { const date = asDate(value); if (!value || Number.isNaN(date.getTime())) return null; date.setHours(23, 59, 59, 999); return Math.ceil((date.getTime() - Date.now()) / 86400000); };

function renderStats() {
  const stats = document.querySelectorAll('.stats-strip .stat .num');
  if (stats[0]) stats[0].textContent = clubs.length;
  if (stats[1]) stats[1].textContent = new Set(clubs.map(club => club.category).filter(Boolean)).size;
  if (stats[2]) stats[2].textContent = activeStudentCount;
  if (stats[3]) stats[3].textContent = clubs.filter(club => daysUntil(club.deadline) >= 0).length;
}

function renderCategories() {
  const categories = [...new Set(clubs.map(club => club.category).filter(Boolean))];
  $('categoryList').innerHTML = categories.length
    ? categories.map(category => `<button class="stamp ${activeCategory === category ? 'selected' : ''}" type="button" data-category="${escapeHtml(category)}"><span class="ico">✦</span>${escapeHtml(category)}</button>`).join('')
    : '<div class="empty-home">ยังไม่มีหมวดหมู่ชมรม</div>';
}

function clubCard(club) {
  const days = daysUntil(club.deadline);
  const state = days === null ? 'เปิดรับ' : days < 0 ? 'ปิดรับแล้ว' : days <= 7 ? 'ใกล้ปิดรับ' : 'เปิดรับ';
  const statusClass = state === 'เปิดรับ' ? 'open' : state === 'ใกล้ปิดรับ' ? 'soon' : 'closed';
  return `<div class="club-card"><div class="club-banner"><div class="club-emoji">${escapeHtml(club.emoji || '🏷️')}</div></div><div class="club-body"><div class="club-cat">${escapeHtml(club.category || 'ทั่วไป')}</div><h3>${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</h3><p class="club-desc">${escapeHtml(club.description || 'ยังไม่มีรายละเอียดชมรม')}</p><div class="club-foot"><span class="status-pill ${statusClass}">${state}</span><button class="club-link home-view-club" type="button" data-club-id="${escapeHtml(club.id)}">ดูรายละเอียด</button></div></div></div>`;
}

function showClubDetails(club) {
  const dialog = $('homeClubDialog');
  if (!dialog || !club) return;
  const days = daysUntil(club.deadline);
  const status = days !== null && days < 0 ? 'ปิดรับสมัครแล้ว' : days !== null && days <= 7 ? 'ใกล้ปิดรับสมัคร' : 'เปิดรับสมัคร';
  $('homeClubDetail').innerHTML = `<div class="home-club-banner"><span>${escapeHtml(club.emoji || '🏷️')}</span></div><div class="home-club-body"><div class="club-cat">${escapeHtml(club.category || 'ทั่วไป')}</div><h2>${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</h2><p>${escapeHtml(club.description || 'ชมรมนี้ยังไม่ได้เพิ่มรายละเอียด')}</p><div class="home-club-meta"><div><b>สถานะ</b><span>${status}</span></div><div><b>วันปิดรับสมัคร</b><span>${escapeHtml(formatDate(club.deadline))}</span></div><div><b>ติดต่อ</b><span>${escapeHtml(club.contact || 'ยังไม่ระบุ')}</span></div></div><a class="btn btn-primary" href="login/login.html">เข้าสู่ระบบเพื่อสมัครสมาชิก</a></div>`;
  dialog.showModal();
}

function renderSearchResults(keyword = '') {
  const term = keyword.trim().toLowerCase();
  const searchPanel = $('homeSearchResults');
  if (!searchPanel) return;

  if (!term) {
    searchPanel.hidden = true;
    searchPanel.innerHTML = '';
    return;
  }

  const availableClubs = clubs.filter(club => !activeCategory || club.category === activeCategory);
  const matches = availableClubs.filter(club => [club.name, club.category, club.description].some(value => String(value || '').toLowerCase().includes(term))).slice(0, 5);

  searchPanel.hidden = false;
  searchPanel.innerHTML = matches.length
    ? `<div class="search-results-header">ผลการค้นหา</div>${matches.map(club => `
      <button class="search-result-item" type="button" data-search-club="${escapeHtml(club.id)}">
        <span class="search-item-emoji">${escapeHtml(club.emoji || '🏷️')}</span>
        <span class="search-item-copy">
          <strong>${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</strong>
          <small>${escapeHtml(club.category || 'ทั่วไป')}</small>
        </span>
      </button>
    `).join('')}`
    : '<div class="search-no-result">ไม่พบชมรมที่ตรงกับคำค้นหา</div>';
}

function renderClubs(keyword = '') {
  const term = keyword.trim().toLowerCase();
  const categoryFiltered = clubs.filter(club => (!activeCategory || club.category === activeCategory));
  const filtered = categoryFiltered.filter(club => (!term || [club.name, club.category, club.description].some(value => String(value || '').toLowerCase().includes(term))));
  const ordered = term ? [...filtered, ...categoryFiltered.filter(club => !filtered.some(item => item.id === club.id))] : categoryFiltered;
  const deadlineClubs = filtered.filter(club => daysUntil(club.deadline) !== null && daysUntil(club.deadline) >= 0).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline)).slice(0, 4);

  $('deadlineList').innerHTML = deadlineClubs.length ? deadlineClubs.map(club => { const deadline = asDate(club.deadline); const days = daysUntil(club.deadline); return `<div class="deadline-card"><div class="date mono">${escapeHtml(String(deadline.getDate()).padStart(2, '0'))}</div><div class="month mono">${escapeHtml(formatDate(club.deadline))}</div><h3>ปิดรับสมัคร</h3><div class="club">${escapeHtml(club.name || '-')}</div><span class="urgency ${days <= 7 ? 'high' : 'mid'}">${days === 0 ? 'วันนี้' : `เหลือ ${days} วัน`}</span></div>`; }).join('') : '<div class="empty-home">ยังไม่มีกำหนดการรับสมัคร</div>';

  const matchIds = new Set(filtered.map(club => club.id));
  $('featuredClubList').innerHTML = ordered.length
    ? ordered.slice(0, 6).map(club => `<div class="club-card ${term && matchIds.has(club.id) ? 'is-match' : ''}">${clubCard(club).replace('<div class="club-card">', '<div class="club-card">')}</div>`).join('')
    : '<div class="empty-home">ไม่พบชมรมที่ตรงกับคำค้นหา</div>';
}

function renderQuizQuestion() {
  const question = quizQuestions[quizIndex];
  $('quizProgressLabel').textContent = `ข้อ ${quizIndex + 1} จาก ${quizQuestions.length}`;
  $('quizProgressBar').style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
  $('quizQuestion').innerHTML = `<h3>${escapeHtml(question.text)}</h3><div class="quiz-options">${question.options.map((option, index) => `<label class="quiz-option"><input type="radio" name="quizAnswer" value="${escapeHtml(option.category)}" ${quizAnswers[quizIndex] === option.category ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('')}</div>`;
  $('quizBack').disabled = quizIndex === 0;
  $('quizNext').textContent = quizIndex === quizQuestions.length - 1 ? 'ดูผลลัพธ์' : 'ถัดไป';
}

function showQuizResult() {
  const scores = {};
  quizAnswers.forEach(category => { scores[category] = (scores[category] || 0) + 1; });
  const topCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ทั่วไป';
  const matches = clubs.filter(club => String(club.category || '').toLowerCase().includes(topCategory.toLowerCase()) || topCategory.toLowerCase().includes(String(club.category || '').toLowerCase())).slice(0, 3);
  $('quizForm').hidden = true;
  $('quizResult').hidden = false;
  $('quizResult').innerHTML = `<div class="quiz-result"><span class="result-kicker">ผลลัพธ์ของคุณ</span><h3>คุณเหมาะกับชมรมสาย${escapeHtml(topCategory)}</h3><p>จากคำตอบของคุณ เราคิดว่ากิจกรรมด้านนี้น่าจะทำให้คุณสนุกและได้ใช้จุดแข็งของตัวเอง</p><div class="quiz-matches">${matches.length ? matches.map(club => `<button type="button" class="quiz-match" data-quiz-club="${escapeHtml(club.id)}"><span>${escapeHtml(club.emoji || '🏷️')}</span>${escapeHtml(club.name || 'ชมรม')}</button>`).join('') : '<span class="quiz-no-match">ยังไม่มีชมรมในหมวดนี้ ลองดูชมรมทั้งหมดด้านล่าง</span>'}</div><div class="quiz-result-actions"><button class="btn btn-primary" id="quizBrowse" type="button">ดูชมรมที่แนะนำ</button><button class="btn btn-outline" id="quizRestart" type="button">ทำอีกครั้ง</button></div></div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const menuToggle = $('menuToggle');
  const mobileNav = $('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => { const isOpen = mobileNav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(isOpen)); });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mobileNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));
  }
  $('categoryList').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; activeCategory = activeCategory === button.dataset.category ? '' : button.dataset.category; renderCategories(); renderClubs($('homeSearch').value); renderSearchResults($('homeSearch').value); });
  $('homeSearch').addEventListener('input', event => { renderClubs(event.target.value); renderSearchResults(event.target.value); });
  $('homeSearchResults').addEventListener('click', event => {
    const button = event.target.closest('[data-search-club]');
    if (!button) return;
    const club = clubs.find(item => item.id === button.dataset.searchClub);
    if (club) showClubDetails(club);
  });
  $('interestQuizBtn').addEventListener('click', () => { quizIndex = 0; quizAnswers = []; $('quizForm').hidden = false; $('quizResult').hidden = true; renderQuizQuestion(); $('quizDialog').showModal(); });
  $('closeQuiz').addEventListener('click', () => $('quizDialog').close());
  $('quizNext').addEventListener('click', () => { const answer = document.querySelector('input[name="quizAnswer"]:checked'); if (!answer) { $('quizQuestion').classList.add('quiz-shake'); setTimeout(() => $('quizQuestion').classList.remove('quiz-shake'), 350); return; } quizAnswers[quizIndex] = answer.value; if (quizIndex === quizQuestions.length - 1) showQuizResult(); else { quizIndex += 1; renderQuizQuestion(); } });
  $('quizBack').addEventListener('click', () => { if (quizIndex > 0) { quizIndex -= 1; renderQuizQuestion(); } });
  $('quizResult').addEventListener('click', event => { const match = event.target.closest('[data-quiz-club]'); if (match) { $('quizDialog').close(); showClubDetails(clubs.find(club => club.id === match.dataset.quizClub)); } const browse = event.target.closest('#quizBrowse'); if (browse) { $('quizDialog').close(); document.getElementById('featured').scrollIntoView({ behavior: 'smooth' }); } if (event.target.closest('#quizRestart')) { quizIndex = 0; quizAnswers = []; $('quizForm').hidden = false; $('quizResult').hidden = true; renderQuizQuestion(); } });
  $('featuredClubList').addEventListener('click', event => {
    const button = event.target.closest('.home-view-club');
    if (button) showClubDetails(clubs.find(club => club.id === button.dataset.clubId));
  });
  $('closeHomeClubDialog').addEventListener('click', () => $('homeClubDialog').close());
  $('homeClubDialog').addEventListener('click', event => { if (event.target === $('homeClubDialog')) $('homeClubDialog').close(); });
  document.querySelectorAll('[href="#"]').forEach(link => link.addEventListener('click', event => event.preventDefault()));
  try {
    const [clubsSnapshot, applicationsSnapshot] = await Promise.all([
      getDocs(collection(db, 'clubs')),
      getDocs(collection(db, 'applications'))
    ]);
    clubs = clubsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    activeStudentCount = new Set(applicationsSnapshot.docs.map(item => item.data().uid).filter(Boolean)).size;
    renderStats(); renderCategories(); renderClubs();
  } catch (error) {
    console.error('Failed to load homepage clubs', error);
    $('featuredClubList').innerHTML = '<div class="empty-home">โหลดข้อมูลชมรมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</div>';
    $('deadlineList').innerHTML = '<div class="empty-home">โหลดกำหนดการไม่สำเร็จ</div>';
  }
});