import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
let currentUser = null;
let ownedClubs = [];
let applications = [];
let profiles = {};
let activeStatus = 'all';

const $ = id => document.getElementById(id);
const escapeHtml = value => { const node = document.createElement('div'); node.textContent = value == null ? '' : String(value); return node.innerHTML; };
const formatDate = value => {
  if (!value) return '-';
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};
const getInitials = value => String(value || '?').slice(0, 2).toUpperCase();
const statusLabel = status => ({ pending: 'รอพิจารณา', approved: 'อนุมัติแล้ว', rejected: 'ไม่ผ่าน' }[status] || status || 'ไม่ทราบสถานะ');

function showFeedback(message) { $('feedback').textContent = message; $('feedback').hidden = false; }
function hideFeedback() { $('feedback').hidden = true; }

async function loadOwnedClubs(uid) {
  const snapshot = await getDocs(query(collection(db, 'clubs'), where('adminUid', '==', uid)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function loadApplications() {
  const results = await Promise.all(ownedClubs.map(async club => {
    const snapshot = await getDocs(query(collection(db, 'applications'), where('clubId', '==', club.id)));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data(), clubName: club.name || 'ไม่มีชื่อชมรม' }));
  }));
  applications = results.flat();
  const uniqueUids = [...new Set(applications.map(item => item.uid).filter(Boolean))];
  const entries = await Promise.all(uniqueUids.map(async uid => [uid, await getDoc(doc(db, 'students', uid))]));
  profiles = Object.fromEntries(entries.map(([uid, snapshot]) => [uid, snapshot.exists() ? snapshot.data() : {}]));
}

function renderClubs() {
  const strip = $('clubStrip');
  strip.innerHTML = ownedClubs.map(club => `<div class="club-chip">${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}<small>${escapeHtml(club.category || 'ชมรม')}</small></div>`).join('');
  strip.hidden = ownedClubs.length === 0;
  $('managedClubList').innerHTML = ownedClubs.map(club => `<article class="managed-card"><h3>${escapeHtml(club.emoji || '🏷️')} ${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</h3><p>${escapeHtml(club.description || 'ยังไม่มีรายละเอียดชมรม')}</p><div class="managed-actions"><button class="edit-club" type="button" data-edit-club="${escapeHtml(club.id)}">แก้ไขข้อมูล</button><button class="delete-club" type="button" data-delete-club="${escapeHtml(club.id)}">ลบชมรม</button></div></article>`).join('');
  $('managedClubs').hidden = ownedClubs.length === 0;
}

function renderStats() {
  $('totalCount').textContent = applications.length;
  $('pendingCount').textContent = applications.filter(item => item.status === 'pending').length;
  $('approvedCount').textContent = applications.filter(item => item.status === 'approved').length;
  $('rejectedCount').textContent = applications.filter(item => item.status === 'rejected').length;
}

function renderApplications() {
  const keyword = $('searchInput').value.trim().toLowerCase();
  const filtered = applications.filter(application => {
    const profile = profiles[application.uid] || {};
    const haystack = [profile.email, profile.studentId, profile.faculty, application.uid, application.clubName].join(' ').toLowerCase();
    return (activeStatus === 'all' || application.status === activeStatus) && haystack.includes(keyword);
  }).sort((a, b) => String(b.appliedAt || '').localeCompare(String(a.appliedAt || '')));

  if (!filtered.length) {
    $('applicationList').innerHTML = `<div class="empty">${applications.length ? 'ไม่พบใบสมัครที่ตรงกับตัวกรอง' : 'ยังไม่มีใบสมัครสำหรับชมรมที่คุณดูแล'}</div>`;
    return;
  }
  $('applicationList').innerHTML = filtered.map(application => {
    const profile = profiles[application.uid] || {};
    const name = profile.displayName || profile.name || profile.email || application.uid || 'ไม่ทราบชื่อ';
    return `<article class="application-row">
      <div class="applicant"><div class="avatar">${escapeHtml(getInitials(name))}</div><div><h3>${escapeHtml(name)}</h3><div class="muted">${escapeHtml(profile.email || application.uid || '-')}</div></div></div>
      <div class="app-meta"><strong>${escapeHtml(application.clubName)}</strong>ส่งใบสมัคร ${escapeHtml(formatDate(application.appliedAt))}</div>
      <div class="row-actions"><span class="status ${escapeHtml(application.status)}">${escapeHtml(statusLabel(application.status))}</span><button class="action-button view" type="button" data-action="view" data-id="${escapeHtml(application.id)}">ดูข้อมูล</button>${application.status === 'pending' ? `<button class="action-button approve" type="button" data-action="approve" data-id="${escapeHtml(application.id)}">อนุมัติ</button><button class="action-button reject" type="button" data-action="reject" data-id="${escapeHtml(application.id)}">ไม่อนุมัติ</button>` : ''}</div>
    </article>`;
  }).join('');
}

function renderAll() { renderClubs(); renderStats(); renderApplications(); }

function openClubForm(club) {
  $('clubForm').reset();
  $('clubId').value = club ? club.id : '';
  $('clubDialogTitle').textContent = club ? 'แก้ไขข้อมูลชมรม' : 'เพิ่มชมรม';
  if (club) {
    $('clubName').value = club.name || '';
    $('clubCategory').value = club.category || '';
    $('clubDescription').value = club.description || '';
    $('clubDeadline').value = club.deadline || '';
    $('clubEmoji').value = club.emoji || '';
    $('clubContact').value = club.contact || '';
  }
  $('clubFormError').hidden = true;
  $('clubDialog').showModal();
}

async function saveClub(event) {
  event.preventDefault();
  if (!currentUser) return;
  const clubId = $('clubId').value;
  const clubRef = clubId ? doc(db, 'clubs', clubId) : doc(collection(db, 'clubs'));
  const clubData = {
    name: $('clubName').value.trim(),
    category: $('clubCategory').value.trim(),
    description: $('clubDescription').value.trim(),
    deadline: $('clubDeadline').value || '',
    emoji: $('clubEmoji').value.trim() || '🏷️',
    contact: $('clubContact').value.trim(),
    adminUid: currentUser.uid,
    updatedAt: serverTimestamp()
  };
  const submitButton = $('clubForm').querySelector('button[type="submit"]');
  submitButton.disabled = true;
  $('clubFormError').hidden = true;
  try {
    if (!clubId) clubData.createdAt = serverTimestamp();
    await setDoc(clubRef, clubData, { merge: true });
    const savedClub = { id: clubRef.id, ...clubData };
    ownedClubs = clubId ? ownedClubs.map(club => club.id === clubId ? { ...club, ...savedClub } : club) : [...ownedClubs, savedClub];
    $('clubDialog').close();
    renderAll();
    showFeedback(clubId ? 'บันทึกข้อมูลชมรมแล้ว' : 'เพิ่มชมรมแล้ว');
  } catch (error) {
    console.error(error);
    $('clubFormError').textContent = 'บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Firestore แล้วลองใหม่';
    $('clubFormError').hidden = false;
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteClub(clubId, button) {
  const club = ownedClubs.find(item => item.id === clubId);
  if (!club || !currentUser || club.adminUid !== currentUser.uid) return;
  if (!window.confirm(`ยืนยันลบชมรม “${club.name || 'ไม่มีชื่อชมรม'}” หรือไม่? ข้อมูลใบสมัครและการติดตามของชมรมนี้จะถูกลบด้วย`)) return;
  button.disabled = true;
  try {
    const [applicationsSnapshot, followsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'applications'), where('clubId', '==', clubId))),
      getDocs(query(collection(db, 'follows'), where('clubId', '==', clubId)))
    ]);
    await Promise.all([
      ...applicationsSnapshot.docs.map(item => deleteDoc(item.ref)),
      ...followsSnapshot.docs.map(item => deleteDoc(item.ref)),
      deleteDoc(doc(db, 'clubs', clubId))
    ]);
    ownedClubs = ownedClubs.filter(item => item.id !== clubId);
    applications = applications.filter(item => item.clubId !== clubId);
    renderAll();
    showFeedback('ลบชมรมและข้อมูลที่เกี่ยวข้องแล้ว');
  } catch (error) {
    console.error(error);
    showFeedback('ลบชมรมไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Firestore แล้วลองใหม่');
    button.disabled = false;
  }
}

function showDetails(application) {
  const profile = profiles[application.uid] || {};
  $('detailContent').innerHTML = `<div class="detail-body">
    <div class="detail-item"><label>ชื่อผู้สมัคร</label><div>${escapeHtml(profile.displayName || profile.name || profile.email || '-')}</div></div>
    <div class="detail-item"><label>อีเมล</label><div>${escapeHtml(profile.email || '-')}</div></div>
    <div class="detail-item"><label>รหัสนักศึกษา</label><div>${escapeHtml(profile.studentId || '-')}</div></div>
    <div class="detail-item"><label>คณะ</label><div>${escapeHtml(profile.faculty || '-')}</div></div>
    <div class="detail-item"><label>ชั้นปี</label><div>${escapeHtml(profile.year || '-')}</div></div>
    <div class="detail-item"><label>ชมรมที่สมัคร</label><div>${escapeHtml(application.clubName)}</div></div>
    <div class="detail-item"><label>ส่งใบสมัครเมื่อ</label><div>${escapeHtml(formatDate(application.appliedAt))}</div></div>
    <div class="detail-item"><label>UID ผู้สมัคร</label><div class="mono">${escapeHtml(application.uid || '-')}</div></div>
  </div>`;
  $('detailDialog').showModal();
}

async function updateApplicationStatus(id, status, button) {
  const application = applications.find(item => item.id === id);
  if (!application || !currentUser || application.status !== 'pending') return;
  const actionText = status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
  if (!window.confirm(`ยืนยันการ${actionText}ใบสมัครนี้หรือไม่?`)) return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'applications', id), { status, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
    application.status = status;
    application.reviewedBy = currentUser.uid;
    renderAll();
    showFeedback(`อัปเดตสถานะเป็น “${statusLabel(status)}” แล้ว`);
  } catch (error) {
    console.error(error);
    showFeedback('บันทึกสถานะไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Firestore แล้วลองใหม่');
    button.disabled = false;
  }
}

$('searchInput').addEventListener('input', renderApplications);
$('newClubBtn').addEventListener('click', () => openClubForm());
$('managedClubList').addEventListener('click', event => {
  const button = event.target.closest('[data-edit-club]');
  if (button) {
    openClubForm(ownedClubs.find(club => club.id === button.dataset.editClub));
    return;
  }
  const deleteButton = event.target.closest('[data-delete-club]');
  if (deleteButton) deleteClub(deleteButton.dataset.deleteClub, deleteButton);
});
$('clubForm').addEventListener('submit', saveClub);
$('cancelClubBtn').addEventListener('click', () => $('clubDialog').close());
$('closeClubDialog').addEventListener('click', () => $('clubDialog').close());
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  activeStatus = tab.dataset.status;
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  renderApplications();
}));
$('applicationList').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const application = applications.find(item => item.id === button.dataset.id);
  if (!application) return;
  if (button.dataset.action === 'view') showDetails(application);
  if (button.dataset.action === 'approve') updateApplicationStatus(application.id, 'approved', button);
  if (button.dataset.action === 'reject') updateApplicationStatus(application.id, 'rejected', button);
});
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
$('detailDialog').addEventListener('click', event => { if (event.target === $('detailDialog')) $('detailDialog').close(); });
$('logoutBtn').addEventListener('click', async () => { await signOut(auth); window.location.href = '../login/login.html'; });

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = '../login/login.html'; return; }
  currentUser = user;
  $('accountEmail').textContent = user.email || 'บัญชีแอดมินชมรม';
  try {
    ownedClubs = await loadOwnedClubs(user.uid);
    const adminProfile = await getDoc(doc(db, 'clubAdmins', user.uid));
    if (!ownedClubs.length && !adminProfile.exists()) { window.location.href = '../dashboard/dashboard.html'; return; }
    if (!ownedClubs.length) { renderClubs(); renderStats(); return; }
    await loadApplications();
    hideFeedback();
    renderAll();
  } catch (error) {
    console.error(error);
    $('applicationList').innerHTML = '<div class="empty">โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและ Firestore Rules</div>';
  }
});
