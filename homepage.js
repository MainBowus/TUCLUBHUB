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

function renderClubs(keyword = '') {
  const term = keyword.trim().toLowerCase();
  const filtered = clubs.filter(club => (!activeCategory || club.category === activeCategory) && (!term || [club.name, club.category, club.description].some(value => String(value || '').toLowerCase().includes(term))));
  const deadlineClubs = filtered.filter(club => daysUntil(club.deadline) !== null && daysUntil(club.deadline) >= 0).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline)).slice(0, 4);
  $('deadlineList').innerHTML = deadlineClubs.length ? deadlineClubs.map(club => { const deadline = asDate(club.deadline); const days = daysUntil(club.deadline); return `<div class="deadline-card"><div class="date mono">${escapeHtml(String(deadline.getDate()).padStart(2, '0'))}</div><div class="month mono">${escapeHtml(formatDate(club.deadline))}</div><h3>ปิดรับสมัคร</h3><div class="club">${escapeHtml(club.name || '-')}</div><span class="urgency ${days <= 7 ? 'high' : 'mid'}">${days === 0 ? 'วันนี้' : `เหลือ ${days} วัน`}</span></div>`; }).join('') : '<div class="empty-home">ยังไม่มีกำหนดการรับสมัคร</div>';
  $('featuredClubList').innerHTML = filtered.length ? filtered.slice(0, 6).map(clubCard).join('') : '<div class="empty-home">ไม่พบชมรมที่ตรงกับคำค้นหา</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
  const menuToggle = $('menuToggle');
  const mobileNav = $('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => { const isOpen = mobileNav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(isOpen)); });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mobileNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));
  }
  $('categoryList').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; activeCategory = activeCategory === button.dataset.category ? '' : button.dataset.category; renderCategories(); renderClubs($('homeSearch').value); });
  $('homeSearch').addEventListener('input', event => renderClubs(event.target.value));
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