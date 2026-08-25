import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
  import {
    getAuth,
    onAuthStateChanged,
    signOut
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
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

  const facultyShort = {
    'นิติศาสตร์': 'นิติศาสตร์',
    'พาณิชยศาสตร์และการบัญชี': 'พาณิชยศาสตร์ฯ',
    'รัฐศาสตร์': 'รัฐศาสตร์',
    'เศรษฐศาสตร์': 'เศรษฐศาสตร์',
    'สังคมสงเคราะห์ศาสตร์': 'สังคมสงเคราะห์ศาสตร์',
    'ศิลปศาสตร์': 'ศิลปศาสตร์',
    'วารสารศาสตร์และสื่อสารมวลชน': 'วารสารศาสตร์ฯ',
    'วิทยาศาสตร์และเทคโนโลยี': 'วิทยาศาสตร์ฯ',
    'วิศวกรรมศาสตร์': 'วิศวกรรมศาสตร์',
    'แพทยศาสตร์': 'แพทยศาสตร์',
    'สหเวชศาสตร์': 'สหเวชศาสตร์',
    'สถาปัตยกรรมศาสตร์และการผังเมือง': 'สถาปัตยกรรมศาสตร์ฯ'
  };

  const bannerVariants = ['', 'alt2', 'alt3'];

  // ===== App state (populated after auth + Firestore fetch) =====
  let currentUid = null;
  let greetingName = 'สวัสดี';
  let clubsById = {};       // { clubId: clubData }
  let followsList = [];     // [{ clubId, followedAt }]
  let applicationsList = []; // [{ clubId, status, appliedAt }]
  let activitiesList = []; // [{ id, clubId, ...activity }]
  let activityAttendance = {}; // { activityId: 'joined' | 'declined' }

  // ===== Small helpers =====
  function initials(email) {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  }

  function formatThaiDate(isoString) {
    if (!isoString) return '-';
    const d = isoString.toDate ? isoString.toDate() : new Date(isoString);
    if (isNaN(d)) return '-';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  function dateValue(value) {
    if (!value) return 0;
    const date = value.toDate ? value.toDate() : new Date(value);
    return isNaN(date) ? 0 : date.getTime();
  }

  function daysUntil(isoDate) {
    if (!isoDate) return null;
    const target = isoDate.toDate ? isoDate.toDate() : new Date(isoDate);
    if (isNaN(target)) return null;
    const now = new Date();
    const diffMs = target.setHours(23,59,59,999) - now.getTime();
    return Math.ceil(diffMs / 86400000);
  }

  function urgencyLabel(days) {
    if (days === null) return { text: '-', cls: 'mid' };
    if (days < 0) return { text: 'ปิดรับแล้ว', cls: 'high' };
    if (days === 0) return { text: 'วันนี้', cls: 'high' };
    if (days <= 7) return { text: `เหลือ ${days} วัน`, cls: 'high' };
    return { text: `เหลือ ${days} วัน`, cls: 'mid' };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function emptyState(message, emoji) {
    return `<div class="empty-state"><span class="emoji">${emoji || '🗂️'}</span>${escapeHtml(message)}</div>`;
  }

  // ===== Firestore data access =====
  async function loadClubs() {
    const snap = await getDocs(collection(db, 'clubs'));
    const map = {};
    snap.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
    return map;
  }

  async function loadFollows(uid) {
    const q = query(collection(db, 'follows'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out;
  }

  async function loadApplications(uid) {
    const q = query(collection(db, 'applications'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out;
  }

  async function toggleFollow(clubId, uid) {
    const followId = `${uid}_${clubId}`;
    const existing = followsList.find(f => f.clubId === clubId);
    if (existing) {
      await deleteDoc(doc(db, 'follows', followId));
      followsList = followsList.filter(f => f.clubId !== clubId);
    } else {
      await setDoc(doc(db, 'follows', followId), {
        uid, clubId, followedAt: new Date().toISOString()
      });
      followsList.push({ id: followId, uid, clubId, followedAt: new Date().toISOString() });
    }
    renderEverything();
  }

  async function applyToClub(clubId, uid) {
    const appId = `${uid}_${clubId}`;
    if (applicationsList.find(a => a.clubId === clubId)) return; // already applied
    await setDoc(doc(db, 'applications', appId), {
      uid, clubId, status: 'pending', appliedAt: new Date().toISOString()
    });
    applicationsList.push({ id: appId, uid, clubId, status: 'pending', appliedAt: new Date().toISOString() });
    renderEverything();
  }

  async function loadActivities(uid) {
    const memberClubIds = applicationsList.filter(application => application.status === 'approved').map(application => application.clubId);
    const results = await Promise.all(memberClubIds.map(async clubId => {
      const snapshot = await getDocs(query(collection(db, 'activities'), where('clubId', '==', clubId)));
      return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    }));
    activitiesList = results.flat().sort((a, b) => dateValue(b.date) - dateValue(a.date));
    activityAttendance = {};
    await Promise.all(activitiesList.map(async activity => {
      const attendance = await getDoc(doc(db, 'activityAttendance', `${uid}_${activity.id}`));
      if (attendance.exists()) activityAttendance[activity.id] = attendance.data().status;
    }));
  }

  async function setActivityAttendance(activityId, status, button) {
    if (!currentUid || !activitiesList.some(activity => activity.id === activityId)) return;
    button.disabled = true;
    try {
      await setDoc(doc(db, 'activityAttendance', `${currentUid}_${activityId}`), { uid: currentUid, activityId, status, updatedAt: serverTimestamp() });
      activityAttendance[activityId] = status;
      renderActivities();
    } catch (error) {
      console.error('Failed to update activity attendance', error);
      button.disabled = false;
      showDataError('บันทึกการเข้าร่วมกิจกรรมไม่สำเร็จ กรุณาลองใหม่');
    }
  }

  function renderActivities() {
    const container = document.getElementById('memberActivities');
    if (!container) return;
    container.innerHTML = activitiesList.length ? activitiesList.map(activity => {
      const club = clubsById[activity.clubId];
      const attendance = activityAttendance[activity.id];
      const date = activity.date ? (activity.date.toDate ? activity.date.toDate() : new Date(activity.date)) : null;
      return `<article class="activity-card" data-activity-card="${escapeHtml(activity.id)}"><div class="activity-date"><b>${date && !isNaN(date) ? String(date.getDate()).padStart(2, '0') : '--'}</b><span>${date && !isNaN(date) ? date.toLocaleDateString('th-TH', { month: 'short' }) : '-'}</span></div><div class="activity-info"><span class="activity-club">${escapeHtml(club ? club.name : 'ชมรม')}</span><h3>${escapeHtml(activity.title || 'กิจกรรม')}</h3><p>${escapeHtml(activity.description || '')}</p><small>${escapeHtml(formatThaiDate(activity.date))} · ${escapeHtml(activity.location || 'ไม่ระบุสถานที่')}</small></div><div class="activity-actions">${attendance ? `<span class="activity-status ${attendance}">${attendance === 'joined' ? 'ยืนยันเข้าร่วมแล้ว' : 'ปฏิเสธแล้ว'}</span>` : `<button class="activity-join" type="button" data-activity-action="joined" data-activity-id="${escapeHtml(activity.id)}">เข้าร่วม</button><button class="activity-decline" type="button" data-activity-action="declined" data-activity-id="${escapeHtml(activity.id)}">ปฏิเสธ</button>`}</div></article>`;
    }).join('') : emptyState('ยังไม่มีกิจกรรมสำหรับชมรมที่คุณเป็นสมาชิก', '📅');
  }

  function showDataError(message) {
    const dashboard = document.getElementById('page-dashboard');
    if (!dashboard) return;
    const existing = dashboard.querySelector('.data-error');
    if (existing) existing.textContent = message;
    else dashboard.insertAdjacentHTML('afterbegin', `<div class="data-error">${escapeHtml(message)}</div>`);
  }

  function showClubDetails(club) {
    const dialog = document.getElementById('clubDetailDialog');
    if (!dialog || !club) return;
    const application = applicationsList.find(a => a.clubId === club.id);
    const status = application ? statusForClub(club.id) : null;
    document.getElementById('clubDetailContent').innerHTML = `
      <div class="club-detail-banner"><span>${escapeHtml(club.emoji || '🏷️')}</span></div>
      <div class="club-detail-body">
        <div class="club-detail-tag">${escapeHtml(club.category || 'ทั่วไป')}</div>
        <h2>${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</h2>
        <p>${escapeHtml(club.description || 'ชมรมนี้ยังไม่ได้เพิ่มรายละเอียด')}</p>
        <div class="club-detail-meta"><div><b>ปิดรับสมัคร</b><span>${escapeHtml(formatThaiDate(club.deadline))}</span></div><div><b>ช่องทางติดต่อ</b><span>${escapeHtml(club.contact || 'ยังไม่ระบุ')}</span></div></div>
        ${status ? `<div class="club-detail-status">สถานะของคุณ: <strong>${escapeHtml(status.label)}</strong></div>` : `<button class="welcome-cta js-detail-apply" data-club-id="${escapeHtml(club.id)}">สมัครเป็นสมาชิก</button>`}
      </div>`;
    dialog.showModal();
  }

  // ===== Card renderers =====
  function statusForClub(clubId) {
    const app = applicationsList.find(a => a.clubId === clubId);
    if (app) {
      if (app.status === 'approved') return { label: 'เป็นสมาชิกแล้ว', cls: 'approved' };
      if (app.status === 'rejected') return { label: 'ไม่ผ่านการคัดเลือก', cls: 'pending' };
      return { label: 'รอผลสมัคร', cls: 'pending' };
    }
    if (followsList.find(f => f.clubId === clubId)) return { label: 'กำลังติดตาม', cls: 'open' };
    return null;
  }

  function clubCardHtml(club, opts = {}) {
    const variant = bannerVariants[club.categoryIndex % 3 || 0] || '';
    const status = opts.forceStatus || statusForClub(club.id);
    const isFollowing = !!followsList.find(f => f.clubId === club.id);

    const viewLink = `<button class="club-link js-view-btn" data-club-id="${club.id}">ดูรายละเอียด</button>`;
    const applyButton = !applicationsList.find(a => a.clubId === club.id)
      ? `<button class="btn-apply js-apply-btn" data-club-id="${club.id}">สมัครสมาชิก</button>`
      : '';
    const followBtn = `<button class="btn-follow js-follow-btn" data-club-id="${club.id}" style="width:auto; padding:6px 14px;">${isFollowing ? 'เลิกติดตาม' : '+ ติดตาม'}</button>`;
    const statusPill = status ? `<span class="status-pill ${status.cls}">${escapeHtml(status.label)}</span>` : '';

    // left slot: status pill if we have one, otherwise the follow button (when offered)
    const leftSlot = statusPill || (opts.showFollowToggle ? followBtn : '<span></span>');
    // right slot: follow button when we already showed a status pill on the left, otherwise the view link
    const rightSlot = `<div class="club-actions">${statusPill && opts.showFollowToggle ? followBtn : ''}${applyButton}${viewLink}</div>`;

    return `
      <div class="club-card">
        <div class="club-banner ${variant}"><div class="club-emoji">${escapeHtml(club.emoji || '🏷️')}</div></div>
        <div class="club-body">
          <h3>${escapeHtml(club.name || 'ไม่มีชื่อ')}</h3>
          <div class="club-foot">
            ${leftSlot}
            ${rightSlot}
          </div>
        </div>
      </div>`;
  }

  function recCardHtml(club) {
    const isFollowing = !!followsList.find(f => f.clubId === club.id);
    return `
      <div class="rec-card">
        <span class="tag">${escapeHtml(club.category || 'ทั่วไป')}</span>
        <h3>${escapeHtml(club.name || 'ไม่มีชื่อ')}</h3>
        <div class="desc">${escapeHtml(club.description || '')}</div>
        <div class="rec-actions"><button class="btn-follow js-follow-btn" data-club-id="${club.id}">${isFollowing ? '✓ ติดตามแล้ว' : '+ ติดตาม'}</button><button class="btn-apply js-apply-btn" data-club-id="${club.id}">${applicationsList.find(a => a.clubId === club.id) ? 'ดูสถานะใบสมัคร' : 'สมัครสมาชิก'}</button></div>
      </div>`;
  }

  function deadlineRowHtml(club) {
    const days = daysUntil(club.deadline);
    const u = urgencyLabel(days);
    const d = club.deadline ? new Date(club.deadline) : null;
    const dayNum = d ? String(d.getDate()).padStart(2, '0') : '--';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const monthLabel = d ? months[d.getMonth()] : '-';
    return `
      <div class="deadline-row">
        <div class="datebox"><div class="d mono">${dayNum}</div><div class="m mono">${monthLabel}</div></div>
        <div class="info">
          <h3>ปิดรับสมัคร</h3>
          <div class="club">${escapeHtml(club.name || '-')}</div>
        </div>
        <span class="urgency ${u.cls}">${u.text}</span>
      </div>`;
  }

  function applicationRowHtml(app, club) {
    const isApproved = app.status === 'approved';
    const isRejected = app.status === 'rejected';
    const boxStyle = isApproved
      ? `background:var(--green-soft); color:var(--green);`
      : isRejected ? `background:var(--crimson-soft); color:var(--crimson);` : `background:var(--gold-soft); color:#8a651f;`;
    const label = isApproved ? 'ผ่าน' : (app.status === 'rejected' ? 'ไม่ผ่าน' : 'รอผล');
    const dateLabel = isApproved
      ? `อนุมัติเมื่อ ${formatThaiDate(app.reviewedAt || app.appliedAt)}`
      : isRejected ? `ส่งใบสมัครเมื่อ ${formatThaiDate(app.appliedAt)}` : `ส่งใบสมัครเมื่อ ${formatThaiDate(app.appliedAt)}`;
    return `
      <div class="deadline-row">
        <div class="datebox" style="${boxStyle}"><div class="d mono" style="font-size:12px;">${label}</div></div>
        <div class="info">
          <h3>${escapeHtml(club ? club.name : 'ชมรม (ไม่พบข้อมูล)')}</h3>
          <div class="club">${dateLabel}</div>
        </div>
        <span class="urgency ${isApproved ? '' : isRejected ? 'high' : 'mid'}" style="${isApproved ? 'background:var(--green-soft); color:var(--green);' : ''}">${isApproved ? 'อนุมัติแล้ว' : (isRejected ? 'ไม่ผ่าน' : 'รอผล')}</span>
      </div>`;
  }

  // ===== Master render function — call after any data change =====
  function renderEverything() {
    const followedClubs = followsList
      .map(f => clubsById[f.clubId])
      .filter(Boolean);

    const memberClubs = applicationsList
      .filter(a => a.status === 'approved')
      .map(a => clubsById[a.clubId])
      .filter(Boolean);

    const pendingCount = applicationsList.filter(a => a.status === 'pending').length;
    const approvedCount = applicationsList.filter(a => a.status === 'approved').length;
    const totalApps = applicationsList.length;
    const noAppCount = Math.max(followedClubs.length - totalApps, 0);

    // clubs with an upcoming deadline, from what the user follows or applied to
    const relevantClubIds = new Set([
      ...followsList.map(f => f.clubId),
      ...applicationsList.map(a => a.clubId)
    ]);
    const upcomingClubs = [...relevantClubIds]
      .map(id => clubsById[id])
      .filter(c => c && c.deadline && daysUntil(c.deadline) !== null && daysUntil(c.deadline) >= 0)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    // ---- stat cards ----
    setText('statFollowing', followsList.length);
    setText('statPending', pendingCount);
    setText('statUpcoming', upcomingClubs.length);
    setText('statApproved', approvedCount);
    setText('followingNavCount', followsList.length);
    setText('applicationNavCount', totalApps);
    renderNotifications();
    renderActivities();

    // ---- welcome banner ----
    const headline = document.getElementById('welcomeHeadline');
    const sub = document.getElementById('welcomeSub');
    if (headline && sub) {
      if (upcomingClubs.length > 0) {
        headline.textContent = `คุณมี ${upcomingClubs.length} กิจกรรมที่ต้องติดตาม`;
        const nearest = upcomingClubs[0];
        sub.textContent = `อย่าลืมเช็กกำหนดปิดรับสมัครของ ${nearest.name} ก่อนวันที่ ${formatThaiDate(nearest.deadline)}`;
      } else if (followsList.length === 0) {
        headline.textContent = 'ยังไม่ได้ติดตามชมรมไหนเลย';
        sub.textContent = 'ลองไปหน้า "ค้นหาชมรม" เพื่อเริ่มติดตามชมรมที่สนใจ';
      } else {
        headline.textContent = 'ตอนนี้ยังไม่มีกำหนดการที่ต้องรีบ';
        sub.textContent = 'เดี๋ยวจะแจ้งเตือนให้เมื่อมีวันปิดรับสมัครใกล้เข้ามา';
      }
    }

    // ---- deadlines (home, top 3) ----
    const deadlineListHome = document.getElementById('deadlineListHome');
    if (deadlineListHome) {
      deadlineListHome.innerHTML = upcomingClubs.length
        ? upcomingClubs.slice(0, 3).map(deadlineRowHtml).join('')
        : emptyState('ยังไม่มีกำหนดการที่ต้องติดตามตอนนี้', '🗓️');
    }

    // ---- deadlines (calendar page, full list) ----
    const deadlineListFull = document.getElementById('deadlineListFull');
    if (deadlineListFull) {
      deadlineListFull.innerHTML = upcomingClubs.length
        ? upcomingClubs.map(deadlineRowHtml).join('')
        : emptyState('ยังไม่มีกำหนดการในปฏิทินของคุณ ลองติดตามชมรมที่สนใจก่อน', '🗓️');
    }

    // ---- progress ring ----
    const ring = document.getElementById('progressRing');
    if (ring) {
      const circumference = 226;
      const approvedFrac = totalApps ? approvedCount / totalApps : 0;
      const pendingFrac = totalApps ? pendingCount / totalApps : 0;
      let svgCircles = `<circle cx="44" cy="44" r="36" fill="none" stroke="#EFE7D2" stroke-width="10"/>`;
      if (approvedCount > 0) {
        svgCircles += `<circle cx="44" cy="44" r="36" fill="none" stroke="#3E8A56" stroke-width="10" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - approvedFrac)}" stroke-linecap="round" transform="rotate(-90 44 44)"/>`;
      }
      if (pendingCount > 0) {
        svgCircles += `<circle cx="44" cy="44" r="36" fill="none" stroke="#C0912E" stroke-width="10" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pendingFrac)}" stroke-linecap="round" transform="rotate(${-90 + approvedFrac * 360} 44 44)"/>`;
      }
      ring.innerHTML = svgCircles;
    }
    setText('ringTotal', totalApps);
    setText('legendApproved', approvedCount);
    setText('legendPending', pendingCount);
    setText('legendNone', noAppCount);

    // ---- followed clubs (home preview, max 3) ----
    const followedClubsHome = document.getElementById('followedClubsHome');
    if (followedClubsHome) {
      followedClubsHome.innerHTML = followedClubs.length
        ? followedClubs.slice(0, 3).map(c => clubCardHtml(c)).join('')
        : emptyState('ยังไม่ได้ติดตามชมรมไหนเลย ลองไปที่หน้า "ค้นหาชมรม"', '📌');
    }
    const followedCountLink = document.getElementById('followedCountLink');
    if (followedCountLink) followedCountLink.textContent = `ดูทั้งหมด (${followedClubs.length}) →`;

    // ---- recommended ----
    const recommendedClubs = document.getElementById('recommendedClubs');
    if (recommendedClubs) {
      const followedIds = new Set(followsList.map(f => f.clubId));
      const candidates = Object.values(clubsById).filter(c => !followedIds.has(c.id));
      recommendedClubs.innerHTML = candidates.length
        ? candidates.slice(0, 6).map(recCardHtml).join('')
        : emptyState('ยังไม่มีชมรมในระบบให้แนะนำตอนนี้ (เร็วๆ นี้)', '✨');
    }

    // ---- my clubs page ----
    const followingClubsFull = document.getElementById('followingClubsFull');
    const followingCountLabel = document.getElementById('followingCountLabel');
    if (followingClubsFull) {
      followingClubsFull.innerHTML = followedClubs.length
        ? followedClubs.map(c => clubCardHtml(c, { showFollowToggle: true })).join('')
        : emptyState('ยังไม่ได้ติดตามชมรมไหนเลย', '📌');
    }
    if (followingCountLabel) followingCountLabel.textContent = `กำลังติดตาม (${followedClubs.length})`;

    const memberClubsFull = document.getElementById('memberClubsFull');
    const memberCountLabel = document.getElementById('memberCountLabel');
    if (memberClubsFull) {
      memberClubsFull.innerHTML = memberClubs.length
        ? memberClubs.map(c => clubCardHtml(c, { forceStatus: { label: 'เป็นสมาชิกแล้ว', cls: 'approved' } })).join('')
        : emptyState('ยังไม่ได้เป็นสมาชิกชมรมไหนเลย', '🎓');
    }
    if (memberCountLabel) memberCountLabel.textContent = `เป็นสมาชิกแล้ว (${memberClubs.length})`;

    // ---- search page ----
    renderSearchResults(document.getElementById('searchInput') ? document.getElementById('searchInput').value : '');

    // ---- applications page ----
    const applicationsListEl = document.getElementById('applicationsList');
    if (applicationsListEl) {
      applicationsListEl.innerHTML = applicationsList.length
        ? applicationsList
            .slice()
            .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
            .map(a => applicationRowHtml(a, clubsById[a.clubId]))
            .join('')
        : emptyState('ยังไม่เคยส่งใบสมัครชมรมไหนเลย', '📄');
    }
  }

  function renderSearchResults(keyword) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    const all = Object.values(clubsById);
    const kw = (keyword || '').trim().toLowerCase();
    const filtered = kw
      ? all.filter(c =>
          (c.name || '').toLowerCase().includes(kw) ||
          (c.category || '').toLowerCase().includes(kw))
      : all;

    if (all.length === 0) {
      searchResults.innerHTML = emptyState('ยังไม่มีชมรมในระบบตอนนี้ ระบบเพิ่มชมรมกำลังจะเปิดใช้งานเร็วๆ นี้', '🏗️');
      return;
    }
    searchResults.innerHTML = filtered.length
      ? filtered.map(c => clubCardHtml(c, { showFollowToggle: true })).join('')
      : emptyState('ไม่พบชมรมที่ตรงกับคำค้นหา', '🔍');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    const applicationNotifications = applicationsList.map(application => ({
      id: application.id,
      kind: 'application',
      sortDate: application.reviewedAt || application.appliedAt,
      club: clubsById[application.clubId],
      status: application.status === 'approved' ? 'อนุมัติแล้ว' : application.status === 'rejected' ? 'ไม่ผ่านการคัดเลือก' : 'รอผลสมัคร',
      type: application.status === 'approved' ? 'approved' : application.status === 'rejected' ? 'rejected' : 'pending'
    }));
    const activityNotifications = activitiesList.map(activity => {
      const attendance = activityAttendance[activity.id];
      const responseText = attendance === 'joined' ? 'คุณยืนยันเข้าร่วมแล้ว' : attendance === 'declined' ? 'คุณปฏิเสธการเข้าร่วมแล้ว' : 'กิจกรรมใหม่สำหรับสมาชิก';
      return { id: activity.id, kind: 'activity', sortDate: activity.updatedAt || activity.createdAt || activity.date, club: clubsById[activity.clubId], title: activity.title, status: responseText, type: 'activity' };
    });
    const notifications = [...applicationNotifications, ...activityNotifications]
      .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
    list.innerHTML = notifications.length
      ? notifications.map(notification => {
          const label = notification.kind === 'activity' ? notification.title : (notification.club ? notification.club.name : 'ชมรม');
          const detail = notification.kind === 'activity' ? `${notification.status} · ${formatThaiDate(notification.sortDate)}` : `${notification.status} · ${formatThaiDate(notification.sortDate)}`;
          const target = notification.kind === 'activity' ? `data-notification-activity="${escapeHtml(notification.id)}"` : `data-notification-app="${escapeHtml(notification.id)}"`;
          return `<button class="notification-item" type="button" ${target}><span class="notification-mark ${notification.type}"></span><span><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></span></button>`;
        }).join('')
      : '<div class="notification-empty">ยังไม่มีการแจ้งเตือน</div>';
  }

  function openSearchPage(keyword) {
    const searchInput = document.getElementById('searchInput');
    const searchNav = document.querySelector('.nav-item[data-page="search"]');
    if (searchInput) {
      searchInput.value = keyword || '';
      renderSearchResults(searchInput.value);
    }
    if (searchNav) searchNav.click();
    const topResults = document.getElementById('topSearchResults');
    if (topResults) topResults.hidden = true;
  }

  function renderTopSearchResults(keyword) {
    const results = document.getElementById('topSearchResults');
    if (!results) return;
    const normalized = (keyword || '').trim().toLowerCase();
    if (!normalized) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    const matches = Object.values(clubsById).filter(club =>
      [club.name, club.category, club.description].some(value => String(value || '').toLowerCase().includes(normalized))
    ).slice(0, 6);
    results.innerHTML = matches.length
      ? matches.map(club => `<button class="top-search-result" type="button" data-search-club="${escapeHtml(club.id)}"><span>${escapeHtml(club.emoji || '🏷️')}</span><span><b>${escapeHtml(club.name || 'ไม่มีชื่อชมรม')}</b><small>${escapeHtml(club.category || 'ทั่วไป')}</small></span></button>`).join('')
      : '<div class="top-search-empty">ไม่พบชมรมที่ตรงกับคำค้นหา</div>';
    results.hidden = false;
  }

  // ===== Event delegation for follow / apply / view buttons =====
  document.addEventListener('click', async (e) => {
    const followBtn = e.target.closest('.js-follow-btn');
    if (followBtn && currentUid) {
      e.preventDefault();
      followBtn.disabled = true;
      try {
        await toggleFollow(followBtn.dataset.clubId, currentUid);
      } catch (err) {
        console.error('Failed to update follow', err);
        followBtn.disabled = false;
        showDataError('บันทึกการติดตามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
      return;
    }
    const viewBtn = e.target.closest('.js-view-btn');
    if (viewBtn) {
      e.preventDefault();
      showClubDetails(clubsById[viewBtn.dataset.clubId]);
      return;
    }
    const applyBtn = e.target.closest('.js-apply-btn, .js-detail-apply');
    if (applyBtn && currentUid) {
      e.preventDefault();
      const clubId = applyBtn.dataset.clubId;
      if (applicationsList.find(a => a.clubId === clubId)) {
        showClubDetails(clubsById[clubId]);
        return;
      }
      applyBtn.disabled = true;
      try {
        await applyToClub(clubId, currentUid);
        const dialog = document.getElementById('clubDetailDialog');
        if (dialog && dialog.open) dialog.close();
      } catch (err) {
        console.error('Failed to apply to club', err);
        applyBtn.disabled = false;
        showDataError('ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
      return;
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-activity-action]');
    if (button) setActivityAttendance(button.dataset.activityId, button.dataset.activityAction, button);
  });

  // ===== Search input =====
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'searchInput') {
      renderSearchResults(e.target.value);
    }
    if (e.target && e.target.id === 'topSearchInput') {
      renderTopSearchResults(e.target.value);
    }
  });

  const topSearchInput = document.getElementById('topSearchInput');
  if (topSearchInput) {
    topSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        openSearchPage(topSearchInput.value);
      }
    });
  }
  document.addEventListener('click', (e) => {
    const result = e.target.closest('.top-search-result');
    if (result) {
      const club = clubsById[result.dataset.searchClub];
      openSearchPage(club ? club.name : topSearchInput.value);
      return;
    }
    if (!e.target.closest('.top-search-wrap')) {
      const topResults = document.getElementById('topSearchResults');
      if (topResults) topResults.hidden = true;
    }
  });

  // ===== Welcome CTA + "ดูทั้งหมด" buttons route through nav switcher =====
  document.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-page]');
    if (jump && !jump.classList.contains('nav-item')) {
      const target = jump.getAttribute('data-page');
      const navItem = document.querySelector(`.nav-item[data-page="${target}"]`);
      if (navItem) navItem.click();
    }
  });

  // ===== Settings toggles =====
  const defaultPrefs = { deadlineAlerts: true, newClubAlerts: true, publicProfile: false };
  let currentPrefs = { ...defaultPrefs };

  function renderToggle(id, field) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isOn = !!currentPrefs[field];
    btn.textContent = isOn ? 'เปิดอยู่' : 'ปิดอยู่';
    btn.classList.toggle('on', isOn);
    btn.classList.toggle('off', !isOn);
  }

  function renderAllToggles() {
    renderToggle('toggleDeadline', 'deadlineAlerts');
    renderToggle('toggleNewClub', 'newClubAlerts');
    renderToggle('togglePublicProfile', 'publicProfile');
  }

  document.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('.toggle-btn');
    if (!toggleBtn || !currentUid) return;
    const field = toggleBtn.dataset.field;
    const previousValue = !!currentPrefs[field];
    currentPrefs[field] = !currentPrefs[field];
    renderAllToggles();
    try {
      await setDoc(doc(db, 'students', currentUid), { preferences: currentPrefs }, { merge: true });
    } catch (err) {
      console.error('Failed to save preference', err);
      currentPrefs[field] = previousValue;
      renderAllToggles();
      showDataError('บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  });

  // ===== Logout =====
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = '/login/login.html';
    });
  }

  const notificationBtn = document.getElementById('notificationBtn');
  const notificationPanel = document.getElementById('notificationPanel');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (notificationPanel) notificationPanel.hidden = !notificationPanel.hidden;
    });
  }
  const closeNotifications = document.getElementById('closeNotifications');
  if (closeNotifications) closeNotifications.addEventListener('click', () => { notificationPanel.hidden = true; });
  document.addEventListener('click', (event) => {
    if (notificationPanel && !event.target.closest('.notification-panel, #notificationBtn')) notificationPanel.hidden = true;
  });
  document.addEventListener('click', (event) => {
    const notification = event.target.closest('[data-notification-activity]');
    if (!notification) return;
    notificationPanel.hidden = true;
    const activityCard = document.querySelector(`[data-activity-card="${notification.dataset.notificationActivity}"]`);
    if (activityCard) activityCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.addEventListener('click', (event) => {
    const notification = event.target.closest('[data-notification-app]');
    if (!notification) return;
    notificationPanel.hidden = true;
    const applicationsNav = document.querySelector('.nav-item[data-page="applications"]');
    if (applicationsNav) applicationsNav.click();
  });

  // ===== Sidebar nav page switching =====
  const pageTitles = {
    search: 'ค้นหาชมรม',
    myclubs: 'ชมรมของฉัน',
    calendar: 'ปฏิทินกิจกรรม',
    applications: 'ใบสมัครของฉัน',
    profile: 'โปรไฟล์',
    settings: 'ตั้งค่า',
    logout: 'ออกจากระบบ'
  };

  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pages = document.querySelectorAll('.page');
  const titleEl = document.getElementById('page-title');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-page');

      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(p => { p.style.display = 'none'; });
      const targetPage = document.getElementById('page-' + target);
      if (targetPage) targetPage.style.display = 'block';

      if (titleEl) titleEl.textContent = target === 'dashboard' ? greetingName : (pageTitles[target] || greetingName);

      document.querySelector('.content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ===== Auth guard + initial data load =====
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login/login.html';
      return;
    }
    currentUid = user.uid;

    const clubAdminNav = document.getElementById('clubAdminNav');
    if (clubAdminNav) clubAdminNav.hidden = true;

    let profile = null;
    try {
      const snapshot = await getDoc(doc(db, 'students', user.uid));
      profile = snapshot.exists() ? snapshot.data() : null;
      if (profile && profile.preferences) {
        currentPrefs = { ...defaultPrefs, ...profile.preferences };
      }
      renderAllToggles();
    } catch (err) {
      console.error('Failed to load student profile', err);
      showDataError('โหลดโปรไฟล์ไม่สำเร็จ แต่ยังสามารถใช้งาน Dashboard ต่อได้');
      renderAllToggles();
    }

    const email = user.email || (profile ? profile.email : '') || '';
    const shortAvatar = initials(email);
    const facultyLabel = profile && profile.faculty ? (facultyShort[profile.faculty] || profile.faculty) : 'ยังไม่ระบุคณะ';
    const yearLabel = profile && profile.year ? profile.year : '-';

    greetingName = 'สวัสดี';

    // sidebar
    setText('sidebarAvatar', shortAvatar);
    setText('sidebarName', email);
    setText('sidebarRole', `${facultyLabel} · ${yearLabel}`);

    // topbar
    setText('topbarAvatar', shortAvatar);
    setText('page-title', greetingName);
    const todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
      todayDateEl.textContent = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    // profile page
    setText('profileAvatar', shortAvatar);
    setText('profileName', email);
    setText('profileStudentId', 'รหัสนักศึกษา ' + (profile && profile.studentId ? profile.studentId : '-'));
    setText('profileEmail', email);
    setText('profileFaculty', profile && profile.faculty ? profile.faculty : '-');
    setText('profileYear', yearLabel);
    setText('profileCreatedAt', formatThaiDate(profile ? profile.createdAt : null));

    // load clubs / follows / applications, then render everything
    try {
      const [clubs, follows, applications] = await Promise.all([
        loadClubs(),
        loadFollows(user.uid),
        loadApplications(user.uid)
      ]);
      clubsById = clubs;
      followsList = follows;
      applicationsList = applications;
      await loadActivities(user.uid);
      const adminProfile = await getDoc(doc(db, 'clubAdmins', user.uid));
      const managesClub = Object.values(clubsById).some(club => club.adminUid === user.uid);
      if (clubAdminNav) clubAdminNav.hidden = !adminProfile.exists() && !managesClub;
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      if (clubAdminNav) clubAdminNav.hidden = true;
    }

    renderEverything();
  });
