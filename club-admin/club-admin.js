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
let activeClubId = 'all';
let activities = [];
let activityResponses = {};

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
  $('clubFilter').innerHTML = `<option value="all">ทุกชมรม (${applications.length})</option>` + ownedClubs.map(club => {
    const count = applications.filter(application => application.clubId === club.id).length;
    return `<option value="${escapeHtml(club.id)}">${escapeHtml(club.name || 'ไม่มีชื่อชมรม')} (${count})</option>`;
  }).join('');
  $('clubFilter').value = activeClubId;
  $('newClubBtn').hidden = ownedClubs.length > 0;
  $('newClubBtn').disabled = false;
  $('newClubBtn').title = '';
}

function renderStats() {
  const selectedApplications = activeClubId === 'all' ? applications : applications.filter(item => item.clubId === activeClubId);
  $('totalCount').textContent = selectedApplications.length;
  $('pendingCount').textContent = selectedApplications.filter(item => item.status === 'pending').length;
  $('approvedCount').textContent = selectedApplications.filter(item => item.status === 'approved').length;
  $('rejectedCount').textContent = selectedApplications.filter(item => item.status === 'rejected').length;
}

function renderApplications() {
  const keyword = $('searchInput').value.trim().toLowerCase();
  const filtered = applications.filter(application => {
    const profile = profiles[application.uid] || {};
    const haystack = [profile.email, profile.studentId, profile.faculty, application.uid, application.clubName].join(' ').toLowerCase();
    return (activeClubId === 'all' || application.clubId === activeClubId) && (activeStatus === 'all' || application.status === activeStatus) && haystack.includes(keyword);
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

function renderAll() { renderClubs(); renderStats(); renderApplications(); renderActivities(); }

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
  if (!clubId && ownedClubs.length > 0) {
    $('clubFormError').textContent = 'บัญชีแอดมินหนึ่งบัญชีสร้างได้เพียงหนึ่งชมรม';
    $('clubFormError').hidden = false;
    return;
  }
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

async function loadActivityResponses() {
  const entries = await Promise.all(activities.map(async activity => {
    const snapshot = await getDocs(query(collection(db, 'activityAttendance'), where('activityId', '==', activity.id)));
    return [activity.id, snapshot.docs.map(item => item.data())];
  }));
  activityResponses = Object.fromEntries(entries);
}

function responseNames(activityId, status) {
  return (activityResponses[activityId] || []).filter(response => response.status === status).map(response => {
    const profile = profiles[response.uid] || {};
    return profile.displayName || profile.name || profile.email || response.uid;
  });
}

function renderActivities() {
  $('activitiesSection').hidden = ownedClubs.length === 0;
  $('activityAdminList').innerHTML = activities.length ? activities.map(activity => { const joined = responseNames(activity.id, 'joined'); const declined = responseNames(activity.id, 'declined'); return `<article class="activity-admin-card"><div><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p><small>${escapeHtml(formatDate(activity.date))} · ${escapeHtml(activity.location || 'ไม่ระบุสถานที่')}</small><div class="activity-response-summary"><span class="response-joined">เข้าร่วม ${joined.length} คน</span><span class="response-declined">ปฏิเสธ ${declined.length} คน</span></div><div class="activity-response-names"><div><b>ผู้เข้าร่วม:</b> ${escapeHtml(joined.length ? joined.join(', ') : 'ยังไม่มี')}</div><div><b>ผู้ปฏิเสธ:</b> ${escapeHtml(declined.length ? declined.join(', ') : 'ยังไม่มี')}</div></div></div><div class="managed-actions"><button class="edit-club" type="button" data-edit-activity="${escapeHtml(activity.id)}">แก้ไข</button><button class="delete-club" type="button" data-delete-activity="${escapeHtml(activity.id)}">ลบ</button></div></article>`; }).join('') : '<div class="empty">ยังไม่มีกิจกรรมของชมรม</div>';
}

function openActivityForm(activity) {
  $('activityForm').reset();
  $('activityId').value = activity ? activity.id : '';
  $('activityDialogTitle').textContent = activity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม';
  if (activity) {
    $('activityTitle').value = activity.title || '';
    $('activityDescription').value = activity.description || '';
    $('activityDate').value = activity.date ? new Date(activity.date).toISOString().slice(0, 16) : '';
    $('activityCapacity').value = activity.capacity || '';
    $('activityLocation').value = activity.location || '';
  }
  $('activityFormError').hidden = true;
  $('activityDialog').showModal();
}

async function saveActivity(event) {
  event.preventDefault();
  if (!currentUser || ownedClubs.length !== 1) return;
  const activityId = $('activityId').value;
  const activityRef = activityId ? doc(db, 'activities', activityId) : doc(collection(db, 'activities'));
  const activity = { clubId: ownedClubs[0].id, adminUid: currentUser.uid, title: $('activityTitle').value.trim(), description: $('activityDescription').value.trim(), date: $('activityDate').value, capacity: Number($('activityCapacity').value) || null, location: $('activityLocation').value.trim(), updatedAt: serverTimestamp() };
  const button = $('activityForm').querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (!activityId) activity.createdAt = serverTimestamp();
    await setDoc(activityRef, activity, { merge: true });
    activities = activityId ? activities.map(item => item.id === activityId ? { ...item, ...activity } : item) : [...activities, { id: activityRef.id, ...activity }];
    activityResponses[activityRef.id] = [];
    $('activityDialog').close();
    renderActivities();
    showFeedback(activityId ? 'บันทึกกิจกรรมแล้ว' : 'เพิ่มกิจกรรมแล้ว');
  } catch (error) {
    console.error(error);
    $('activityFormError').textContent = 'บันทึกกิจกรรมไม่สำเร็จ กรุณาลองใหม่';
    $('activityFormError').hidden = false;
  } finally { button.disabled = false; }
}

async function deleteActivity(activityId, button) {
  const activity = activities.find(item => item.id === activityId);
  if (!activity || !currentUser || activity.adminUid !== currentUser.uid || !window.confirm(`ยืนยันลบกิจกรรม “${activity.title}” หรือไม่?`)) return;
  button.disabled = true;
  try { await deleteDoc(doc(db, 'activities', activityId)); activities = activities.filter(item => item.id !== activityId); renderActivities(); showFeedback('ลบกิจกรรมแล้ว'); } catch (error) { console.error(error); showFeedback('ลบกิจกรรมไม่สำเร็จ'); button.disabled = false; }
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
$('clubFilter').addEventListener('change', event => {
  activeClubId = event.target.value;
  renderStats();
  renderApplications();
});
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
$('newActivityBtn').addEventListener('click', () => openActivityForm());
$('refreshActivitiesBtn').addEventListener('click', async event => {
  event.target.disabled = true;
  try { await loadActivityResponses(); renderActivities(); showFeedback('รีเฟรชการตอบรับแล้ว'); } catch (error) { console.error(error); showFeedback('โหลดการตอบรับไม่สำเร็จ'); } finally { event.target.disabled = false; }
});
$('activityForm').addEventListener('submit', saveActivity);
$('cancelActivityBtn').addEventListener('click', () => $('activityDialog').close());
$('closeActivityDialog').addEventListener('click', () => $('activityDialog').close());
$('activityAdminList').addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-activity]');
  if (editButton) { openActivityForm(activities.find(activity => activity.id === editButton.dataset.editActivity)); return; }
  const deleteButton = event.target.closest('[data-delete-activity]');
  if (deleteButton) deleteActivity(deleteButton.dataset.deleteActivity, deleteButton);
});
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
    const activitySnapshot = await getDocs(query(collection(db, 'activities'), where('clubId', '==', ownedClubs[0].id), where('adminUid', '==', user.uid)));
    activities = activitySnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    await loadActivityResponses();
    hideFeedback();
    renderAll();
    renderActivities();
  } catch (error) {
    console.error(error);
    $('applicationList').innerHTML = '<div class="empty">โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและ Firestore Rules</div>';
  }
});
