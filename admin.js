/* سواعد — واجهة لوحة الإدارة. كل البيانات حقيقية من Supabase عبر AdminAPI (admin-backend.js).
   إخفاء الأقسام هنا للراحة فقط؛ الحماية الفعلية تتم في قاعدة البيانات (RLS + الدوال). */
(() => {
  'use strict';
  const API = window.AdminAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = API.norm;
  try { if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) { /* تجاهل */ }

  const SPORTS = ['كرة القدم', 'كرة الطائرة', 'الشطرنج', 'البلياردو', 'البلايستيشن'];
  const ST = { upcoming: 'لم تبدأ', live: 'مباشرة', finished: 'انتهت' };
  const ST_CLS = { upcoming: 'navy', live: 'bad', finished: 'ok' };
  const T_ST = { registration: 'التسجيل مفتوح', active: 'جارية', completed: 'مكتملة', cancelled: 'موقوفة' };
  const T_ST_CLS = { registration: 'warn', active: 'ok', completed: 'navy', cancelled: 'bad' };
  const T_FMT = { groups: 'مجموعات ثم أدوار إقصائية', league: 'دوري من دور واحد', knockout: 'خروج المغلوب' };
  const ROLE = { admin: 'مدير أعلى', team_leader: 'مشرف', student: 'طالب' };
  const I = {
    dashboard: '<path d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M17 11a3 3 0 100-6M21.5 20c0-2.6-1.7-4.6-4-5.5"/>',
    teams: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>',
    tournaments: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 21h8M10 17h4"/>',
    matches: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    scorers: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v5M20 10l-4.5.5M4 10l4.5.5M7 19l2.8-4.5M17 19l-2.8-4.5"/>',
    ann: '<path d="M4 13v-2a2 2 0 012-2h2l7-4v14l-7-4H6a2 2 0 01-2-2zM18 9a4 4 0 010 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  };
  I.rank = I.tournaments;
  const NAV = [
    { id: 'dashboard', t: 'الرئيسية' }, { id: 'users', t: 'المستخدمون', owner: true }, { id: 'teams', t: 'الفرق' }, { id: 'rank', t: 'ترتيب الفرق' },
    { id: 'tournaments', t: 'البطولات' }, { id: 'matches', t: 'المباريات' }, { id: 'scorers', t: 'الهدافون وصناع الأهداف' },
    { id: 'ann', t: 'الإعلانات والإشعارات' }, { id: 'settings', t: 'إعدادات التطبيق', owner: true },
  ];

  let P = null, isOwner = false, cur = 'dashboard', ctx = {}, modalCount = 0, renderTok = 0, stopLive = null, refreshT = null;

  // ───── أدوات عامة ─────
  const pad = n => String(n).padStart(2, '0');
  const fmtDT = iso => iso ? new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('ar', { dateStyle: 'medium' }) : '—';
  const toInput = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromInput = v => v ? new Date(v).toISOString() : null;
  const safeLogo = l => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(l || '')) ? String(l) : '';
  const avatar = (name, logo) => { const l = safeLogo(logo); return `<span class="avatar">${l ? `<img src="${l}" alt="">` : esc(([...String(name || '').trim()][0]) || '؟')}</span>`; };
  const numOrNull = v => (v === '' || v == null) ? null : Number(v);
  const okScore = v => v == null || (Number.isInteger(v) && v >= 0 && v <= 99);
  const uniq = arr => [...new Set(arr)];
  const parsePlayers = txt => uniq(String(txt || '').split(/[\n,،]+/).map(x => x.trim().slice(0, 40)).filter(Boolean)).slice(0, 60);
  const httpUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol); } catch (e) { return false; } };

  function toast(msg, ok = true) {
    const d = document.createElement('div'); d.className = 'toast' + (ok ? '' : ' bad'); d.textContent = msg;
    $('#toasts').appendChild(d); setTimeout(() => d.remove(), ok ? 3000 : 6000);
  }
  const fail = e => toast(e.message || String(e), false);

  function modal(html) {
    const back = document.createElement('div'); back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back); modalCount++;
    const close = () => { if (back.isConnected) { back.remove(); modalCount--; } document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') { close(); back.dispatchEvent(new Event('dismiss')); } };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', e => { if (e.target === back) { close(); back.dispatchEvent(new Event('dismiss')); } });
    return { back, box: back.firstElementChild, close };
  }
  function confirmBox(text, { typed = null, okText = 'نعم، متابعة' } = {}) {
    return new Promise(res => {
      const m = modal(`<h3>تأكيد العملية</h3><p>${esc(text)}</p>${typed ? `<div class="fld" style="margin-top:12px"><label>اكتب «${esc(typed)}» للتأكيد</label><input type="text" autocomplete="off"></div>` : ''}<div class="acts"><button class="btn bad" data-y${typed ? ' disabled' : ''}>${esc(okText)}</button><button class="btn sec" data-n>إلغاء</button></div>`);
      const y = m.box.querySelector('[data-y]'), inp = m.box.querySelector('input');
      if (inp) { inp.oninput = () => { y.disabled = inp.value.trim() !== typed; }; inp.focus(); } else m.box.querySelector('[data-n]').focus();
      y.onclick = () => { m.close(); res(true); }; m.box.querySelector('[data-n]').onclick = () => { m.close(); res(false); };
      m.back.addEventListener('dismiss', () => res(false));
    });
  }

  // ضغط الشعار إلى صورة صغيرة (نفس منطق التطبيق)
  function readImage(file) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('اختر ملف صورة.'));
      if (file.size > 8e6) return rej(new Error('الصورة كبيرة جدًا (الحد 8 ميجابايت).'));
      const fr = new FileReader(); fr.onerror = () => rej(new Error('تعذر قراءة الملف.'));
      fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('تعذر قراءة الصورة.'));
        im.onload = () => { let out = ''; for (const s of [192, 128, 96]) { const r = Math.min(1, s / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * r)); c.height = Math.max(1, Math.round(im.height * r)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/png'); if (out.length < 150000) break; } res(out); };
        im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }

  // ───── نماذج مولَّدة من تعريف حقول ─────
  function fieldHtml(f, v) {
    const id = 'f_' + f.name, val = v ?? f.def ?? '', req = f.req ? ' required' : '';
    if (f.type === 'checkbox') return `<div class="fld chk"><input type="checkbox" id="${id}" name="${f.name}"${val ? ' checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
    let ctl;
    if (f.type === 'textarea') ctl = `<textarea id="${id}" name="${f.name}" maxlength="${f.max || 2000}"${req} placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    else if (f.type === 'select') ctl = `<select id="${id}" name="${f.name}"${f.disabled ? ' disabled' : ''}>${f.options.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (f.type === 'image') ctl = `<div class="row"><span class="avatar" data-prev>${safeLogo(val) ? `<img src="${safeLogo(val)}" alt="">` : esc(([...String(f.initial || '').trim()][0]) || '؟')}</span><label class="btn sec sm">اختيار صورة<input type="file" accept="image/*" data-img="${f.name}" hidden></label><button type="button" class="btn sec sm" data-imgclear="${f.name}">إزالة</button><input type="hidden" name="${f.name}" value="${esc(safeLogo(val))}"></div>`;
    else ctl = `<input type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(val)}"${req}${f.max ? ` maxlength="${f.max}"` : ''}${f.min != null ? ` min="${f.min}"` : ''}${f.maxn != null ? ` max="${f.maxn}"` : ''}${f.list ? ` list="dl_${f.name}"` : ''} placeholder="${esc(f.ph || '')}" autocomplete="off">${f.list ? `<datalist id="dl_${f.name}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
    return `<div class="fld"><label for="${id}">${esc(f.label)}${f.req ? ' *' : ''}</label>${ctl}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
  }
  function readForm(form, fields) {
    const v = {};
    fields.forEach(f => {
      const el = form.elements[f.name]; if (!el) return;
      if (f.type === 'checkbox') v[f.name] = el.checked;
      else if (f.type === 'number') v[f.name] = numOrNull(el.value);
      else if (f.type === 'textarea' || f.type === 'image') v[f.name] = el.value;
      else v[f.name] = String(el.value).trim();
    });
    return v;
  }
  function wireImages(form) {
    form.querySelectorAll('[data-img]').forEach(inp => {
      const name = inp.dataset.img, hid = form.elements[name], prev = inp.closest('.row').querySelector('[data-prev]');
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { hid.value = await readImage(f); prev.innerHTML = `<img src="${hid.value}" alt="">`; } catch (e) { toast(e.message, false); } inp.value = ''; };
    });
    form.querySelectorAll('[data-imgclear]').forEach(b => { b.onclick = () => { const hid = form.elements[b.dataset.imgclear]; hid.value = ''; b.closest('.row').querySelector('[data-prev]').textContent = '؟'; }; });
  }
  // يعيد true عند الحفظ الناجح. save قد ترمي خطأ فيظهر داخل النافذة دون إغلاقها.
  function formBox({ title, fields, values = {}, okText = 'حفظ', note, save }) {
    return new Promise(resolve => {
      const m = modal(`<h3>${esc(title)}</h3>${note ? `<p class="note">${esc(note)}</p>` : ''}<form novalidate>${fields.map(f => fieldHtml(f, values[f.name])).join('')}<p class="err" role="alert"></p><div class="acts"><button class="btn" type="submit">${esc(okText)}</button><button class="btn sec" type="button" data-x>إلغاء</button></div></form>`);
      const form = m.box.querySelector('form'), err = m.box.querySelector('.err');
      wireImages(form);
      m.box.querySelector('[data-x]').onclick = () => { m.close(); resolve(false); };
      m.back.addEventListener('dismiss', () => resolve(false));
      form.onsubmit = async e => {
        e.preventDefault(); const v = readForm(form, fields);
        const missing = fields.find(f => f.req && (v[f.name] === '' || v[f.name] == null));
        if (missing) { err.textContent = `الحقل «${missing.label}» مطلوب.`; return; }
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true; err.textContent = '';
        try { await save(v); m.close(); resolve(true); } catch (ex) { err.textContent = ex.message || String(ex); btn.disabled = false; }
      };
      const first = form.querySelector('input:not([type=hidden]):not([type=file]),select,textarea'); if (first) first.focus();
    });
  }

  // ───── الهيكل والتنقل ─────
  function buildNav() {
    $('#nav').innerHTML = NAV.filter(n => !n.owner || isOwner).map(n =>
      `<button type="button" data-nav="${n.id}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n.id]}</svg><span>${esc(n.t)}</span></button>`).join('');
  }
  function openSide(v) { $('#side').classList.toggle('open', v); $('#scrim').hidden = !v; }
  function route() {
    let id = (location.hash || '#dashboard').slice(1);
    const item = NAV.find(n => n.id === id);
    if (!item || (item.owner && !isOwner)) { if (item) toast('هذا القسم للمدير الأعلى فقط.', false); id = 'dashboard'; }
    if (id !== cur) ctx = {};
    cur = id; render();
  }
  function setLive(st) {
    const el = $('#live'), on = st === 'SUBSCRIBED';
    el.classList.toggle('on', on); el.textContent = on ? 'متصل مباشرة' : (st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') ? 'غير متصل' : 'جارٍ الاتصال…';
  }
  function scheduleRefresh() {
    clearTimeout(refreshT);
    refreshT = setTimeout(function tick() {
      const a = document.activeElement;
      if (modalCount > 0 || (a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { refreshT = setTimeout(tick, 2500); return; }
      render(true);
    }, 700);
  }

  async function render(soft) {
    const tok = ++renderTok, view = $('#view'), y = window.scrollY;
    const item = NAV.find(n => n.id === cur); $('#pageTitle').textContent = item ? item.t : 'لوحة التحكم';
    document.querySelectorAll('#nav [data-nav]').forEach(b => b.toggleAttribute('aria-current', b.dataset.nav === cur) || (b.dataset.nav === cur ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    document.querySelectorAll('#nav [data-nav]').forEach(b => { if (b.dataset.nav === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (!soft) view.innerHTML = '<div class="grid stats"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
    try {
      const html = await VIEWS[cur]();
      if (tok !== renderTok) return;
      view.innerHTML = html; if (AFTER[cur]) AFTER[cur](); if (soft) window.scrollTo(0, y);
    } catch (e) {
      if (tok !== renderTok) return;
      view.innerHTML = `<div class="card empty"><p>تعذر تحميل البيانات.</p><p class="err">${esc(e.message || e)}</p><button class="btn" data-act="reload" style="margin-top:12px">إعادة المحاولة</button></div>`;
    }
  }

  // ───── العروض (VIEWS) ─────
  const VIEWS = {}, AFTER = {};
  const statCard = (label, value, sub = '') => `<div class="card stat"><small>${esc(label)}</small><b>${esc(value)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;

  // 1) الرئيسية
  VIEWS.dashboard = async () => {
    const c = API.count;
    const [uAll, uAct, tm, tAll, tAct, fx, fxLive, fxDone, mt, mtLive, mtDone, goalsF, goalsM, assF, assM, anns, fxList] = await Promise.all([
      isOwner ? c('profiles') : null, isOwner ? c('profiles', q => q.eq('approved', true)) : null,
      c('team_catalog'), c('tournaments'), c('tournaments', q => q.eq('status', 'active')),
      c('fixtures'), c('fixtures', q => q.eq('status', 'live')), c('fixtures', q => q.eq('status', 'finished')),
      c('matches'), c('matches', q => q.eq('status', 'live')), c('matches', q => q.eq('status', 'finished')),
      c('fixture_scorers', q => q.eq('event_type', 'goal')), c('match_scorers', q => q.eq('event_type', 'goal')),
      c('fixture_scorers', q => q.eq('event_type', 'assist')), c('match_scorers', q => q.eq('event_type', 'assist')),
      c('announcements', q => q.eq('active', true)), API.fixtures.list(),
    ]);
    const last = fxList.slice(0, 6);
    return `<div class="head-row"><h2>نظرة عامة</h2><button class="btn sec sm" data-act="reload">تحديث</button></div>
    <div class="grid stats">
      ${isOwner ? statCard('المستخدمون', uAll, `${uAct} مفعّل · ${uAll - uAct} معطّل`) : ''}
      ${statCard('الفرق', tm)}${statCard('البطولات', tAll, `${tAct} جارية`)}
      ${statCard('المباريات', fx + mt, `${fx} عامة · ${mt} في البطولات`)}
      ${statCard('مباشرة الآن', fxLive + mtLive)}${statCard('مباريات منتهية', fxDone + mtDone)}
      ${statCard('الأهداف المسجلة', goalsF + goalsM)}${statCard('التمريرات الحاسمة', assF + assM)}
      ${statCard('إعلانات مفعّلة', anns)}
    </div>
    <div class="head-row" style="margin-top:22px"><h2 style="font-size:18px">أحدث المباريات العامة</h2><button class="btn sec sm" data-go="matches">كل المباريات</button></div>
    ${last.length ? `<div class="grid cards">${last.map(fixtureCard).join('')}</div>` : '<div class="card empty">لا توجد مباريات عامة بعد.</div>'}`;
  };

  // 2) المستخدمون (للمالك)
  VIEWS.users = async () => {
    ctx.users = await API.users.list();
    return `<div class="head-row"><h2>المستخدمون (<span id="uCount"></span>)</h2><input class="search" id="uSearch" type="search" placeholder="بحث بالاسم أو رقم الجلوس" value="${esc(ctx.uq || '')}" aria-label="بحث"></div>
    <p class="muted" style="margin-bottom:12px">«تعطيل» يمنع الحساب من الوصول للبيانات فورًا. «حذف» يزيل الحساب نهائيًا ويُفرج عن رقم جلوسه. دور «مدير أعلى» لا يُمنح ولا يُسحب من هنا.</p>
    <div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>رقم الجلوس</th><th>الدور</th><th>الحالة</th><th>التسجيل</th><th>إجراءات</th></tr></thead><tbody id="uBody"></tbody></table></div>`;
  };
  function paintUsers() {
    const q = norm(ctx.uq || ''), me = API.S.user.id;
    const rows = ctx.users.filter(u => !q || norm(u.full_name).includes(q) || String(u.seat_number).includes(q));
    $('#uCount').textContent = rows.length;
    $('#uBody').innerHTML = rows.length ? rows.map(u => {
      const locked = u.id === me || u.role === 'admin';
      return `<tr><td><b>${esc(u.full_name || '—')}</b></td><td>${esc(u.seat_number)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'warn' : u.role === 'team_leader' ? 'navy' : ''}">${ROLE[u.role] || esc(u.role)}</span></td>
      <td><span class="badge ${u.approved ? 'ok' : 'bad'}">${u.approved ? 'مفعّل' : 'معطّل'}</span></td><td>${fmtD(String(u.created_at).slice(0, 10))}</td>
      <td><div class="row">${locked ? '<span class="muted">محمي</span>' : `<button class="btn sec sm" data-act="user-edit" data-id="${esc(u.id)}">تعديل</button><button class="btn sec sm" data-act="user-toggle" data-id="${esc(u.id)}">${u.approved ? 'تعطيل' : 'تفعيل'}</button><button class="btn bad sm" data-act="user-del" data-id="${esc(u.id)}">حذف</button>`}</div></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">لا نتائج.</td></tr>';
  }
  AFTER.users = () => { paintUsers(); $('#uSearch').oninput = e => { ctx.uq = e.target.value; paintUsers(); }; };

  // 3) الفرق (قائمة الفرق ولاعبوها)
  VIEWS.teams = async () => {
    ctx.teams = await API.teams.list();
    return `<div class="head-row"><h2>الفرق (${ctx.teams.length})</h2><button class="btn" data-act="team-add">+ إضافة فريق</button></div>
    ${ctx.teams.length ? `<div class="grid cards">${ctx.teams.map(t => {
      const pl = Array.isArray(t.players) ? t.players : [];
      return `<div class="card"><div class="row" style="gap:12px">${avatar(t.name, t.logo)}<div style="flex:1;min-width:0"><b>${esc(t.name)}</b><div class="muted">${esc([t.sport, t.club].filter(Boolean).join(' · ') || '—')}</div></div></div>
      ${t.details ? `<p class="muted" style="margin-top:8px">${esc(t.details)}</p>` : ''}
      <hr class="sep"><div class="row sp"><b style="font-size:14px">اللاعبون (${pl.length})</b><button class="btn sec sm" data-act="player-add" data-id="${esc(t.id)}">+ لاعب</button></div>
      <div class="chips" style="margin-top:8px">${pl.length ? pl.map((p, i) => `<span class="pchip">${esc(p)}<button type="button" title="إزالة" data-act="player-del" data-id="${esc(t.id)}" data-i="${i}">×</button></span>`).join('') : '<span class="muted">لا يوجد لاعبون.</span>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn sec sm" data-act="team-edit" data-id="${esc(t.id)}">تعديل</button><button class="btn bad sm" data-act="team-del" data-id="${esc(t.id)}">حذف</button></div></div>`;
    }).join('')}</div>` : '<div class="card empty">لا توجد فرق. أضف أول فريق.</div>'}`;
  };
  const teamFields = t => [
    { name: 'name', label: 'اسم الفريق/النادي', req: true, max: 80 },
    { name: 'sport', label: 'الرياضة', max: 60, list: SPORTS }, { name: 'club', label: 'الكلية/القسم/الدفعة', max: 80 },
    { name: 'players', label: 'اللاعبون (اسم في كل سطر)', type: 'textarea', max: 3000 },
    { name: 'details', label: 'تفاصيل', type: 'textarea', max: 600 }, { name: 'logo', label: 'الشعار', type: 'image', initial: t?.name },
  ];
  const teamPatch = v => ({ name: v.name.slice(0, 80), sport: v.sport || '', club: v.club || '', players: parsePlayers(v.players), details: (v.details || '').trim(), logo: safeLogo(v.logo) });

  // 4) البطولات
  VIEWS.tournaments = async () => {
    if (ctx.tid) return tournamentDetail();
    ctx.ts = await API.tournaments.list();
    return `<div class="head-row"><h2>البطولات (${ctx.ts.length})</h2><button class="btn" data-act="t-add">+ بطولة جديدة</button></div>
    <div class="note">توليد مباريات البطولة (المجموعات والأدوار الإقصائية) يتم من صفحة «البطولات» في التطبيق بعد إضافة الفرق وبدء البطولة. من هنا تُنشئ البطولة وتدير فرقها وبياناتها ونتائج مبارياتها.</div>
    ${ctx.ts.length ? `<div class="grid cards">${ctx.ts.map(t => `<div class="card"><div class="row sp"><b>${esc(t.name)}</b><span class="badge ${T_ST_CLS[t.status] || ''}">${T_ST[t.status] || esc(t.status)}</span></div>
      <p class="muted">${esc(t.sport)} · ${T_FMT[t.format] || ''}</p><p class="muted">${fmtD(t.start_date)} ← ${fmtD(t.end_date)}</p>
      <p class="muted">${t.teamCount} فريق · ${t.matchCount} مباراة</p>
      <div class="row" style="margin-top:12px"><button class="btn navy sm" data-act="t-open" data-id="${esc(t.id)}">إدارة</button><button class="btn sec sm" data-act="t-edit" data-id="${esc(t.id)}">تعديل</button><button class="btn sec sm" data-act="t-toggle" data-id="${esc(t.id)}">${t.status === 'cancelled' ? 'تفعيل' : 'إيقاف'}</button><button class="btn bad sm" data-act="t-del" data-id="${esc(t.id)}">حذف</button></div></div>`).join('')}</div>` : '<div class="card empty">لا توجد بطولات.</div>'}`;
  };
  async function tournamentDetail() {
    const [ts, tTeams, ms, catalog] = await Promise.all([API.tournaments.list(), API.tournaments.teams.list(ctx.tid), API.tournaments.matches.list(ctx.tid), API.teams.list()]);
    const t = ts.find(x => x.id === ctx.tid);
    if (!t) { ctx.tid = null; return VIEWS.tournaments(); }
    ctx.ts = ts; ctx.tt = tTeams; ctx.tm = ms; ctx.catalog = catalog;
    const reg = t.status === 'registration', nameOf = id => (tTeams.find(x => x.id === id) || {}).name || 'يُحدَّد لاحقًا';
    const used = new Set(tTeams.map(x => norm(x.name))), avail = catalog.filter(c => !used.has(norm(c.name)));
    const cf = cfgOf(t), plan = t.format === 'groups' ? reconcilePlan(t, tTeams) : null; ctx.cur = t; ctx.plan = plan;
    const tnm = id => (tTeams.find(x => x.id === id) || {}).name || '؟';
    let extra = '';
    if (reg && plan && tTeams.length >= 2) {
      const gopts = sel => plan.groups.map(g => `<option value="${g.name}"${g.name === sel ? ' selected' : ''}>المجموعة ${g.name}</option>`).join('');
      extra += `<div class="card" style="margin-top:14px"><div class="row sp"><b>شكل المجموعات</b><button class="btn sec sm" data-act="gp-auto">توزيع تلقائي</button></div>
        <div class="row" style="margin-top:10px"><label class="muted">عدد المجموعات</label><select class="search" style="max-width:100px" data-chg="gp-count" aria-label="عدد المجموعات">${Array.from({ length: maxGroups(tTeams.length) }, (_, i) => `<option value="${i + 1}"${plan.count === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
        <label class="muted">المتأهلون من كل مجموعة</label><select class="search" style="max-width:100px" data-chg="gp-q" aria-label="المتأهلون من كل مجموعة">${[1, 2, 3, 4].map(n => `<option value="${n}"${(Number(cf.qualifiers) || 2) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="gp-grid">${plan.groups.map(g => `<div class="gp-box"><b>المجموعة ${g.name}</b> <span class="muted">(${g.teams.length})</span>${g.teams.map((id, i) => `<div class="gp-row"><span class="gp-n">${i + 1}</span><span class="gp-nm">${esc(tnm(id))}</span><select class="search gp-sel" data-chg="gp-move" data-id="${esc(id)}" aria-label="نقل ${esc(tnm(id))} إلى مجموعة">${gopts(g.name)}</select><button class="btn sec sm" data-act="gp-up" data-id="${esc(id)}"${i === 0 ? ' disabled' : ''} aria-label="رفع">▲</button><button class="btn sec sm" data-act="gp-dn" data-id="${esc(id)}"${i === g.teams.length - 1 ? ' disabled' : ''} aria-label="خفض">▼</button></div>`).join('') || '<p class="muted">فارغة</p>'}</div>`).join('')}</div>
        <p class="muted" style="margin-top:8px">حدّد عدد المجموعات، وانقل كل فريق بين المجموعات وغيّر موقعه داخلها قبل بدء البطولة. تُقفل هذه الإعدادات عند البدء.</p></div>`;
    }
    if (reg) extra += `<div class="card" style="margin-top:14px"><button class="btn" data-act="t-start"${tTeams.length < 2 ? ' disabled' : ''}>بدء البطولة وتوليد المباريات</button><p class="muted" style="margin-top:8px">${tTeams.length < 2 ? 'أضف فريقين على الأقل لتتمكن من البدء.' : 'عند البدء تُولَّد المباريات حسب نظام البطولة، وتحدّد موعد أول مباراة والفاصل بين المباريات والملعب.'}</p></div>`;
    else {
      extra += `<div class="row" style="margin-top:14px"><button class="btn sm" data-act="t-resched">إعادة جدولة المباريات</button><button class="btn sec sm" data-act="t-reopen">إعادة فتح التسجيل</button></div>`;
      if (t.format === 'league') extra += standingsHtml(tTeams, liteOf(ms), 'ترتيب الدوري');
      if (t.format === 'groups') extra += cf.groups.map(g => standingsHtml(g.teams.map(id => tTeams.find(x => x.id === id)).filter(Boolean), liteOf(ms.filter(m => m.group_name === g.name)), 'المجموعة ' + g.name)).join('');
    }
    return `<div class="head-row"><button class="btn sec sm" data-act="t-back">← رجوع</button><h2>${esc(t.name)}</h2><span class="badge ${T_ST_CLS[t.status] || ''}">${T_ST[t.status] || ''}</span></div>
    <div class="card"><p class="muted">${esc(t.sport)} · ${T_FMT[t.format] || ''} · ${fmtD(t.start_date)} ← ${fmtD(t.end_date)}</p>${t.description ? `<p style="margin-top:6px">${esc(t.description)}</p>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn sec sm" data-act="t-edit" data-id="${esc(t.id)}">تعديل البطولة</button><button class="btn sec sm" data-act="t-toggle" data-id="${esc(t.id)}">${t.status === 'cancelled' ? 'تفعيل' : 'إيقاف'}</button><button class="btn bad sm" data-act="t-del" data-id="${esc(t.id)}">حذف</button></div></div>
    <div class="card" style="margin-top:14px"><div class="row sp"><b>الفرق المشاركة (${tTeams.length})</b>${reg ? '' : '<span class="muted">القفل بعد بدء البطولة</span>'}</div>
      <div class="chips" style="margin-top:10px">${tTeams.length ? tTeams.map(x => `<span class="pchip">${esc(x.name)}${reg ? `<button type="button" title="إزالة" data-act="tt-del" data-id="${esc(x.id)}">×</button>` : ''}</span>`).join('') : '<span class="muted">لم تُضف فرق.</span>'}</div>
      ${reg ? `<hr class="sep"><div class="row"><select id="ttCat" class="search" style="max-width:260px" aria-label="فريق من القائمة"><option value="">${avail.length ? 'اختر فريقًا من قائمة الفرق…' : 'لا فرق أخرى في القائمة'}</option>${avail.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-act="tt-addcat">إضافة</button><button class="btn sec sm" data-act="tt-addnew">فريق باسم جديد</button></div>` : ''}</div>
    ${extra}
    <div class="head-row" style="margin-top:18px"><h2 style="font-size:18px">مباريات البطولة (${ms.length})</h2>${t.format === 'league' && tTeams.length > 1 ? `<button class="btn sm" data-act="tm-add" data-id="${esc(t.id)}">+ مباراة</button>` : ''}</div>
    ${!reg && t.format !== 'league' ? '<div class="note">يُولَّد الدور التالي تلقائيًا (بنفس الفاصل الزمني) عند اكتمال نتائج الدور الحالي. لا يوجد تعادل في الأدوار الإقصائية.</div>' : ''}
    <div class="note">تظهر مباريات البطولة في صفحة «المباريات» بالتطبيق متزامنة مع المباريات العامة متى كان لها موعد وفريقان. عدّل موعد أي مباراة بزر «تعديل» أو أعد جدولتها كلها بزر «إعادة جدولة المباريات».</div>
    ${ms.length ? `<div class="grid cards">${ms.map(m => tMatchCard(m, nameOf, t)).join('')}</div>` : '<div class="card empty">لا توجد مباريات بعد.</div>'}`;
  }
  const tMatchCard = (m, nameOf, t, showT) => `<div class="card"><div class="row sp"><span class="badge navy">${showT && t ? esc(t.name) + ' · ' : ''}${esc(m.round_name)}${m.group_name ? ' · ' + esc(m.group_name) : ''}</span><span class="badge ${ST_CLS[m.status] || ''}">${ST[m.status] || ''}</span></div>
    <div class="match-row"><b>${esc(nameOf(m.team_a_id))}</b><span class="score">${m.score_a ?? '–'} : ${m.score_b ?? '–'}</span><b>${esc(nameOf(m.team_b_id))}</b></div>
    <p class="muted" style="text-align:center">${fmtDT(m.scheduled_at)}${m.venue ? ' · ' + esc(m.venue) : ''}</p>
    <div class="row" style="margin-top:10px;justify-content:center"><button class="btn sec sm" data-act="tm-edit" data-id="${esc(m.id)}" data-t="${esc(t.id)}">تعديل</button><button class="btn sec sm" data-act="ev-go" data-key="m:${esc(m.id)}">الأهداف</button>${t.format === 'league' ? `<button class="btn bad sm" data-act="tm-del" data-id="${esc(m.id)}">حذف</button>` : ''}</div></div>`;

  // 5) المباريات
  const fixtureCard = f => `<div class="card"><div class="row sp"><span class="badge navy">${esc(f.sport)}</span><span class="badge ${ST_CLS[f.status] || ''}">${ST[f.status] || ''}</span></div>
    <div class="match-row"><b>${esc(f.team_a)}</b><span class="score">${f.score_a ?? '–'} : ${f.score_b ?? '–'}</span><b>${esc(f.team_b)}</b></div>
    <p class="muted" style="text-align:center">${fmtDT(f.scheduled_at)}${f.venue ? ' · ' + esc(f.venue) : ''}</p>
    <div class="row" style="margin-top:10px;justify-content:center">
      ${['upcoming', 'live', 'finished'].filter(s => s !== f.status).map(s => `<button class="btn sec sm" data-act="fx-status" data-id="${esc(f.id)}" data-s="${s}">${ST[s]}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px;justify-content:center"><button class="btn sec sm" data-act="fx-edit" data-id="${esc(f.id)}">تعديل</button><button class="btn sec sm" data-act="ev-go" data-key="f:${esc(f.id)}">الأهداف</button><button class="btn bad sm" data-act="fx-del" data-id="${esc(f.id)}">حذف</button></div></div>`;
  VIEWS.matches = async () => {
    ctx.mtab = ctx.mtab || 'all';
    const tabs = `<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="${ctx.mtab === 'all'}" data-act="mtab" data-v="all">كل المباريات (متزامنة)</button><button class="tab" role="tab" aria-selected="${ctx.mtab === 'fixtures'}" data-act="mtab" data-v="fixtures">المباريات العامة</button><button class="tab" role="tab" aria-selected="${ctx.mtab === 'tourn'}" data-act="mtab" data-v="tourn">مباريات البطولات</button></div>`;
    if (ctx.mtab === 'all') {
      const [fx, ts, tt, ms] = await Promise.all([API.fixtures.list(), API.tournaments.list(), API.tournaments.allTeams(), API.tournaments.matches.all()]);
      Object.assign(ctx, { fixtures: fx, ts, ttAll: tt, tmAll: ms });
      const nameOf = id => (tt.find(x => x.id === id) || {}).name || 'يُحدَّد لاحقًا', when = s => s ? +new Date(s) : Infinity;
      const items = [...fx.map(f => ({ at: f.scheduled_at, h: fixtureCard(f) })),
        ...ms.filter(m => m.team_a_id && m.team_b_id).map(m => { const t = ts.find(x => x.id === m.tournament_id); return t ? { at: m.scheduled_at, h: tMatchCard(m, nameOf, t, true) } : null; }).filter(Boolean)].sort((a, b) => when(a.at) - when(b.at));
      return `${tabs}<div class="note">يجمع هذا الجدول المباريات العامة ومباريات البطولات (الدوري والمجموعات والإقصاء) بترتيب الموعد، وكلها تظهر في صفحة «المباريات» بالتطبيق. مباريات البطولات التي بلا موعد لا تظهر هناك حتى تحدّد موعدها.</div>${items.length ? `<div class="grid cards">${items.map(i => i.h).join('')}</div>` : '<div class="card empty">لا توجد مباريات.</div>'}`;
    }
    if (ctx.mtab === 'tourn') {
      const [ts, tt, ms] = await Promise.all([API.tournaments.list(), API.tournaments.allTeams(), API.tournaments.matches.all()]);
      ctx.ts = ts; ctx.tmAll = ms; ctx.ttAll = tt;
      if (!ctx.mt || !ts.some(t => t.id === ctx.mt)) ctx.mt = ts[0]?.id || null;
      const t = ts.find(x => x.id === ctx.mt), list = ms.filter(m => m.tournament_id === ctx.mt).sort((a, b) => String(a.scheduled_at || '9').localeCompare(String(b.scheduled_at || '9')));
      const nameOf = id => (tt.find(x => x.id === id) || {}).name || 'يُحدَّد لاحقًا';
      return `${tabs}${ts.length ? `<div class="head-row"><select class="search" id="mtSel" aria-label="البطولة">${ts.map(x => `<option value="${esc(x.id)}"${x.id === ctx.mt ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      ${t.format !== 'league' ? '<div class="note">من هنا تُعدَّل المواعيد والنتائج والحالة، ويُولَّد الدور التالي تلقائيًا عند اكتمال نتائج الدور.</div>' : ''}
      ${list.length ? `<div class="grid cards">${list.map(m => tMatchCard(m, nameOf, t)).join('')}</div>` : '<div class="card empty">لا توجد مباريات في هذه البطولة بعد.</div>'}` : '<div class="card empty">لا توجد بطولات.</div>'}`;
    }
    ctx.fixtures = await API.fixtures.list();
    const q = norm(ctx.fq || ''), fs = ctx.fs || '';
    const rows = ctx.fixtures.filter(f => (!fs || f.status === fs) && (!q || norm(f.team_a).includes(q) || norm(f.team_b).includes(q)));
    return `${tabs}<div class="head-row"><input class="search" id="fxSearch" type="search" placeholder="بحث باسم الفريق" value="${esc(ctx.fq || '')}" aria-label="بحث"><select class="search" id="fxStatus" style="max-width:170px" aria-label="الحالة"><option value="">كل الحالات</option>${Object.entries(ST).map(([k, l]) => `<option value="${k}"${fs === k ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn" data-act="fx-add" style="margin-inline-start:auto">+ مباراة</button></div>
    ${rows.length ? `<div class="grid cards">${rows.map(fixtureCard).join('')}</div>` : '<div class="card empty">لا توجد مباريات مطابقة.</div>'}`;
  };
  AFTER.matches = () => {
    const s = $('#mtSel'); if (s) s.onchange = () => { ctx.mt = s.value; render(); };
    const q = $('#fxSearch'); if (q) q.onchange = () => { ctx.fq = q.value; render(); };
    const st = $('#fxStatus'); if (st) st.onchange = () => { ctx.fs = st.value; render(); };
  };
  async function fixtureForm(f) {
    const cat = await API.teams.list().catch(() => []), names = cat.map(x => x.name);
    const fields = [
      { name: 'sport', label: 'الرياضة', type: 'select', options: SPORTS.map(s => [s, s]) },
      { name: 'team_a', label: 'الفريق الأول', req: true, max: 40, list: names }, { name: 'team_b', label: 'الفريق الثاني', req: true, max: 40, list: names },
      { name: 'at', label: 'موعد المباراة', type: 'datetime-local', req: true }, { name: 'venue', label: 'الملعب', max: 60 },
      { name: 'status', label: 'الحالة', type: 'select', options: Object.entries(ST) },
      { name: 'score_a', label: 'نتيجة الفريق الأول', type: 'number', min: 0, maxn: 99 }, { name: 'score_b', label: 'نتيجة الفريق الثاني', type: 'number', min: 0, maxn: 99 },
    ];
    return formBox({
      title: f ? 'تعديل المباراة' : 'مباراة جديدة', fields,
      values: f ? { sport: f.sport, team_a: f.team_a, team_b: f.team_b, at: toInput(f.scheduled_at), venue: f.venue, status: f.status, score_a: f.score_a ?? '', score_b: f.score_b ?? '' } : { sport: SPORTS[0], status: 'upcoming' },
      save: async v => {
        if (norm(v.team_a) === norm(v.team_b)) throw new Error('اختر فريقين مختلفين.');
        if (isNaN(+new Date(v.at))) throw new Error('موعد المباراة غير صحيح.');
        if (!okScore(v.score_a) || !okScore(v.score_b)) throw new Error('النتيجة أرقام صحيحة من 0 إلى 99.');
        if ((v.score_a == null) !== (v.score_b == null)) throw new Error('أدخل نتيجتي الفريقين معًا أو اتركهما فارغتين.');
        if (v.status === 'finished' && v.score_a == null) throw new Error('أدخل النتيجة لتحديد المباراة كمنتهية.');
        const row = { sport: v.sport, team_a: v.team_a, team_b: v.team_b, scheduled_at: fromInput(v.at), venue: v.venue, status: v.status, score_a: v.score_a, score_b: v.score_b };
        if (f) await API.fixtures.update(f.id, row); else await API.fixtures.create(row);
        toast(f ? 'تم حفظ المباراة.' : 'تمت إضافة المباراة.');
      },
    });
  }
  async function tMatchForm(m, t) {
    const hasTeams = m.team_a_id && m.team_b_id;
    return formBox({
      title: 'تعديل المباراة', note: hasTeams ? '' : 'لا يمكن تحديد النتيجة قبل تحديد الفريقين.',
      fields: [
        { name: 'at', label: 'الموعد', type: 'datetime-local' }, { name: 'venue', label: 'الملعب', max: 60 },
        { name: 'status', label: 'الحالة', type: 'select', options: Object.entries(ST) },
        { name: 'score_a', label: 'نتيجة الفريق الأول', type: 'number', min: 0, maxn: 99 }, { name: 'score_b', label: 'نتيجة الفريق الثاني', type: 'number', min: 0, maxn: 99 },
      ],
      values: { at: toInput(m.scheduled_at), venue: m.venue || '', status: m.status, score_a: m.score_a ?? '', score_b: m.score_b ?? '' },
      save: async v => {
        if (!okScore(v.score_a) || !okScore(v.score_b)) throw new Error('النتيجة أرقام صحيحة من 0 إلى 99.');
        if ((v.score_a == null) !== (v.score_b == null)) throw new Error('أدخل نتيجتي الفريقين معًا أو اتركهما فارغتين.');
        if (v.score_a != null && !hasTeams) throw new Error('حدّد الفريقين قبل إدخال النتيجة.');
        if (v.status === 'finished' && v.score_a == null) throw new Error('أدخل النتيجة لتحديد المباراة كمنتهية.');
        const knock = !m.group_name && t.format !== 'league';
        if (knock && v.score_a != null && v.score_a === v.score_b) throw new Error('لا يوجد تعادل في الأدوار الإقصائية.');
        const winner = v.score_a == null || v.score_a === v.score_b ? null : (v.score_a > v.score_b ? m.team_a_id : m.team_b_id);
        const status = v.score_a != null && v.status === 'upcoming' ? 'finished' : v.status;
        const fresh = (await API.tournaments.list()).find(x => x.id === t.id) || t;
        if (fresh.format !== 'league') {
          const rows = await API.tournaments.matches.list(t.id), later = laterRows(fresh, rows, m);
          const changed = m.group_name ? (m.score_a !== v.score_a || m.score_b !== v.score_b) : winner !== (m.winner_team_id || null);
          if (m.score_a != null && later.length && changed) {
            if (later.some(x => x.score_a != null) && !await confirmBox('تعديل هذه النتيجة سيحذف الأدوار التالية ونتائجها ويعيد توليدها. متابعة؟')) throw new Error('لم يُحفظ التعديل.');
            const drop = later.map(x => x.id), c = cfgOf(fresh), ri = m.group_name ? -1 : c.rounds.findIndex(r => r.includes(m.id));
            await API.tournaments.matches.removeMany(drop);
            await API.tournaments.update(t.id, { status: 'active', config: { ...c, rounds: m.group_name ? [] : c.rounds.slice(0, ri + 1), champion: null, matchOrder: (c.matchOrder || []).filter(id => !drop.includes(id)) } });
          }
        }
        await API.tournaments.matches.update(m.id, { scheduled_at: fromInput(v.at), venue: v.venue, status, score_a: v.score_a, score_b: v.score_b, winner_team_id: winner });
        await syncTournament(t.id);
        toast('تم حفظ المباراة.');
      },
    });
  }

  // 6) الهدافون وصناع الأهداف
  VIEWS.scorers = async () => {
    const [fx, ts, tt, ms, cat, ev] = await Promise.all([API.fixtures.list(), API.tournaments.list(), API.tournaments.allTeams(), API.tournaments.matches.all(), API.teams.list(), API.events.all()]);
    Object.assign(ctx, { fx, ts, tt, ms, cat, ev });
    const tn = id => (tt.find(x => x.id === id) || {}).name || '؟';
    const opts = `<optgroup label="المباريات العامة">${fx.map(f => `<option value="f:${esc(f.id)}"${ctx.sel === 'f:' + f.id ? ' selected' : ''}>${esc(f.team_a)} × ${esc(f.team_b)} — ${fmtDT(f.scheduled_at)}</option>`).join('')}</optgroup>`
      + ts.map(t => `<optgroup label="${esc(t.name)}">${ms.filter(m => m.tournament_id === t.id).map(m => `<option value="m:${esc(m.id)}"${ctx.sel === 'm:' + m.id ? ' selected' : ''}>${esc(tn(m.team_a_id))} × ${esc(tn(m.team_b_id))} — ${esc(m.round_name)}</option>`).join('')}</optgroup>`).join('');
    let panel = '<div class="card empty">اختر مباراة لإدارة أهدافها وتمريراتها الحاسمة.</div>';
    if (ctx.sel) {
      const [kind, id] = [ctx.sel[0] === 'f' ? 'fixture' : 'match', ctx.sel.slice(2)];
      const mt = kind === 'fixture' ? fx.find(x => x.id === id) : ms.find(x => x.id === id);
      if (mt) {
        const A = kind === 'fixture' ? mt.team_a : tn(mt.team_a_id), B = kind === 'fixture' ? mt.team_b : tn(mt.team_b_id);
        const list = (kind === 'fixture' ? ev.fixtureEvents.filter(e => e.fixture_id === id) : ev.matchEvents.filter(e => e.match_id === id)).sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
        const sideOf = e => kind === 'fixture' ? e.side : (e.team_id && e.team_id === mt.team_b_id ? 'b' : 'a');
        const players = uniq(cat.filter(c => norm(c.name) === norm(A) || norm(c.name) === norm(B)).flatMap(c => c.players || []));
        ctx.evCtx = { kind, id, A, B, mt };
        panel = `<div class="card"><div class="match-row"><b>${esc(A)}</b><span class="score">${mt.score_a ?? '–'} : ${mt.score_b ?? '–'}</span><b>${esc(B)}</b></div>
          <ul class="ev-list">${list.length ? list.map(e => `<li><span class="badge ${e.event_type === 'goal' ? 'ok' : 'navy'}">${e.event_type === 'goal' ? 'هدف' : 'تمريرة حاسمة'}</span><b>${esc(e.player_name)}</b><span class="muted">${esc(sideOf(e) === 'b' ? B : A)}${e.minute != null ? ' · د' + e.minute : ''}</span><span style="margin-inline-start:auto" class="row"><button class="btn sec sm" data-act="ev-edit" data-id="${esc(e.id)}">تعديل</button><button class="btn bad sm" data-act="ev-del" data-id="${esc(e.id)}">حذف</button></span></li>`).join('') : '<li class="muted">لم يُسجَّل شيء بعد.</li>'}</ul>
          <hr class="sep"><form id="evForm" class="row" style="align-items:flex-end"><div class="fld" style="margin:0"><label>النوع</label><select name="type"><option value="goal">هدف</option><option value="assist">تمريرة حاسمة</option></select></div>
          <div class="fld" style="margin:0"><label>الفريق</label><select name="side"><option value="a">${esc(A)}</option><option value="b">${esc(B)}</option></select></div>
          <div class="fld" style="margin:0"><label>اللاعب</label><input type="text" name="name" list="dl_pl" maxlength="80" required autocomplete="off"><datalist id="dl_pl">${players.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
          <div class="fld" style="margin:0;width:90px"><label>الدقيقة</label><input type="number" name="minute" min="0" max="150"></div><button class="btn" type="submit">إضافة</button></form><p class="err" id="evErr" role="alert"></p></div>`;
      }
    }
    const scope = ctx.scope || 'all';
    return `<div class="head-row"><h2>الأهداف والتمريرات الحاسمة</h2></div>
    <div class="card"><div class="fld" style="margin:0"><label for="evSel">المباراة</label><select id="evSel"><option value="">— اختر مباراة —</option>${opts}</select></div></div>
    <div style="margin-top:14px">${panel}</div>
    <div class="head-row" style="margin-top:22px"><h2 style="font-size:18px">ترتيب الهدافين وصناع الأهداف</h2><select class="search" id="lbScope" style="max-width:260px" aria-label="النطاق"><option value="all"${scope === 'all' ? ' selected' : ''}>كل المباريات</option><option value="fixtures"${scope === 'fixtures' ? ' selected' : ''}>المباريات العامة</option>${ts.map(t => `<option value="t:${esc(t.id)}"${scope === 't:' + t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <p class="muted" style="margin-bottom:10px">يُحسب الترتيب تلقائيًا من التسجيلات أعلاه ويظهر مباشرة في التطبيق.</p>
    <div class="grid cards"><div class="card"><b>الهدافون</b><div style="margin-top:10px">${board('goal', scope)}</div></div><div class="card"><b>صنّاع الأهداف</b><div style="margin-top:10px">${board('assist', scope)}</div></div></div>`;
  };
  function board(type, scope) {
    const { fx, tt, ms, ev } = ctx, m = new Map();
    const add = (name, team, tid) => { const k = norm(name) + '|' + norm(team); const r = m.get(k) || { name, team, n: 0 }; r.n++; m.set(k, r); };
    if (scope === 'all' || scope === 'fixtures') ev.fixtureEvents.filter(e => e.event_type === type).forEach(e => { const f = fx.find(x => x.id === e.fixture_id); if (f) add(e.player_name, e.side === 'b' ? f.team_b : f.team_a); });
    if (scope === 'all' || scope.startsWith('t:')) ev.matchEvents.filter(e => e.event_type === type && (scope === 'all' || scope === 't:' + e.tournament_id)).forEach(e => add(e.player_name, (tt.find(x => x.id === e.team_id) || {}).name || '—'));
    const rows = [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ar')).slice(0, 10);
    return rows.length ? `<ol class="lb">${rows.map(r => `<li><b>${esc(r.name)}<small class="muted" style="font-weight:400"> · ${esc(r.team)}</small></b><em>${r.n}</em></li>`).join('')}</ol>` : '<p class="muted">لا توجد بيانات.</p>';
  }
  AFTER.scorers = () => {
    $('#evSel').onchange = e => { ctx.sel = e.target.value || null; render(); };
    $('#lbScope').onchange = e => { ctx.scope = e.target.value; render(); };
    const f = $('#evForm'); if (f) f.onsubmit = async e => { e.preventDefault(); await addEvent(f); };
  };
  async function addEvent(f) {
    const { kind, id, mt } = ctx.evCtx, v = new FormData(f), err = $('#evErr'); err.textContent = '';
    const name = String(v.get('name')).trim(), type = v.get('type'), side = v.get('side'), minute = numOrNull(v.get('minute'));
    if (!name) { err.textContent = 'اكتب اسم اللاعب.'; return; }
    if (minute != null && (!Number.isInteger(minute) || minute < 0 || minute > 150)) { err.textContent = 'الدقيقة من 0 إلى 150.'; return; }
    const same = (kind === 'fixture' ? ctx.ev.fixtureEvents.filter(e => e.fixture_id === id) : ctx.ev.matchEvents.filter(e => e.match_id === id))
      .some(e => norm(e.player_name) === norm(name) && e.event_type === type && (kind === 'fixture' ? e.side === side : (e.team_id === (side === 'b' ? mt.team_b_id : mt.team_a_id))) && (e.minute ?? null) === minute);
    if (same) { err.textContent = 'هذا التسجيل موجود بالفعل (نفس اللاعب والنوع والدقيقة).'; return; }
    try {
      if (kind === 'fixture') await API.events.add('fixture', { fixture_id: id, side, player_name: name, event_type: type, minute });
      else { const team_id = side === 'b' ? mt.team_b_id : mt.team_a_id; if (!team_id) { err.textContent = 'حدّد فريقَي المباراة أولًا.'; return; } await API.events.add('match', { match_id: id, tournament_id: mt.tournament_id, team_id, player_name: name, event_type: type, minute }); }
      toast('تم التسجيل.'); render(true);
    } catch (ex) { err.textContent = ex.message; }
  }

  // 7) الإعلانات والإشعارات
  VIEWS.ann = async () => {
    ctx.atab = ctx.atab || 'ann';
    const tabs = `<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="${ctx.atab === 'ann'}" data-act="atab" data-v="ann">الإعلانات</button><button class="tab" role="tab" aria-selected="${ctx.atab === 'notif'}" data-act="atab" data-v="notif">الإشعارات</button></div>`;
    if (ctx.atab === 'notif') {
      ctx.notifs = await API.notifications.list();
      return `${tabs}<div class="head-row"><h2>الإشعارات (${ctx.notifs.length})</h2><button class="btn" data-act="n-add">+ إرسال إشعار</button></div><p class="muted" style="margin-bottom:12px">تظهر الإشعارات لجميع المستخدمين في جرس التطبيق فور إرسالها.</p>
      ${ctx.notifs.length ? `<div class="grid cards">${ctx.notifs.map(n => `<div class="card"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><p class="muted">${fmtDT(n.created_at)}</p><div class="row" style="margin-top:8px"><button class="btn bad sm" data-act="n-del" data-id="${n.id}">حذف</button></div></div>`).join('')}</div>` : '<div class="card empty">لا توجد إشعارات.</div>'}`;
    }
    ctx.anns = await API.announcements.list();
    const now = Date.now(), state = a => !a.active ? ['معطّل', 'bad'] : new Date(a.starts_at) > now ? ['مجدول', 'warn'] : (a.ends_at && new Date(a.ends_at) <= now) ? ['منتهٍ', ''] : ['ظاهر الآن', 'ok'];
    return `${tabs}<div class="head-row"><h2>الإعلانات (${ctx.anns.length})</h2><button class="btn" data-act="a-add">+ إعلان جديد</button></div>
    ${ctx.anns.length ? `<div class="grid cards">${ctx.anns.map(a => { const [l, c] = state(a); return `<div class="card"><div class="row sp"><b>${esc(a.title)}</b><span class="badge ${c}">${l}</span></div><p>${esc(a.body)}</p><p class="muted">من ${fmtDT(a.starts_at)}<br>إلى ${a.ends_at ? fmtDT(a.ends_at) : 'بدون نهاية'}</p><div class="row" style="margin-top:10px"><button class="btn sec sm" data-act="a-edit" data-id="${esc(a.id)}">تعديل</button><button class="btn sec sm" data-act="a-toggle" data-id="${esc(a.id)}">${a.active ? 'إيقاف' : 'تفعيل'}</button><button class="btn bad sm" data-act="a-del" data-id="${esc(a.id)}">حذف</button></div></div>`; }).join('')}</div>` : '<div class="card empty">لا توجد إعلانات.</div>'}`;
  };
  const annFields = [
    { name: 'title', label: 'العنوان', req: true, max: 80 }, { name: 'body', label: 'النص', type: 'textarea', max: 500 },
    { name: 'starts_at', label: 'يبدأ الظهور', type: 'datetime-local', req: true }, { name: 'ends_at', label: 'ينتهي الظهور (اختياري)', type: 'datetime-local', help: 'اتركه فارغًا ليبقى الإعلان ظاهرًا حتى تُوقفه.' },
    { name: 'active', label: 'مفعّل', type: 'checkbox' },
  ];

  // ───── منطق البطولات (نُقل من التطبيق إلى اللوحة): المجموعات والجدولة وتوليد الأدوار ─────
  const roundTitle = n => n === 1 ? 'النهائي' : n === 2 ? 'نصف النهائي' : n === 4 ? 'ربع النهائي' : 'دور الـ' + (n * 2);
  const cfgOf = t => ({ qualifiers: 2, groups: [], rounds: [], champion: null, matchOrder: [], ...((t && t.config) || {}) });
  const GN = i => String.fromCharCode(65 + i);
  const maxGroups = n => Math.max(1, Math.min(8, Math.floor(n / 2)));
  const pairsOf = ids => ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b]));
  const interleave = lists => { const out = [], n = Math.max(0, ...lists.map(l => l.length)); for (let i = 0; i < n; i++) lists.forEach(l => { if (l[i]) out.push(l[i]); }); return out; };
  // الترتيب: النقاط ثم فارق الأهداف ثم الأهداف المسجلة ثم الاسم (نفس التطبيق)
  function standingsOf(teams, ms) {
    const tb = {}; teams.forEach(x => tb[x.id] = { id: x.id, name: x.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    ms.filter(m => m.sa != null && m.sb != null && tb[m.a] && tb[m.b]).forEach(m => {
      const a = tb[m.a], b = tb[m.b]; a.p++; b.p++; a.gf += m.sa; a.ga += m.sb; b.gf += m.sb; b.ga += m.sa;
      if (m.sa > m.sb) { a.w++; b.l++; a.pts += 3; } else if (m.sb > m.sa) { b.w++; a.l++; b.pts += 3; } else { a.d++; b.d++; a.pts++; b.pts++; }
    });
    return Object.values(tb).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name, 'ar'));
  }
  // خطة المجموعات قبل البدء: عدد المجموعات + مكان كل فريق ضمنها. تُحفظ في config.groupPlan وتُصحَّح تلقائيًا إن تغيّرت الفرق.
  function reconcilePlan(t, teams, over = {}) {
    const ids = teams.map(x => x.id), p = { ...(cfgOf(t).groupPlan || {}), ...over };
    const count = Math.max(1, Math.min(maxGroups(ids.length), Number(p.count) || Math.ceil(ids.length / 4)));
    const groups = Array.from({ length: count }, (_, i) => ({ name: GN(i), teams: [] })), placed = new Set();
    (p.groups || []).forEach(g => { const tg = groups.find(x => x.name === g.name); if (!tg) return; (g.teams || []).forEach(id => { if (ids.includes(id) && !placed.has(id)) { tg.teams.push(id); placed.add(id); } }); });
    ids.filter(id => !placed.has(id)).forEach(id => { [...groups].sort((a, b) => a.teams.length - b.teams.length)[0].teams.push(id); });
    return { count, groups };
  }
  // توليد مباريات البداية مع الجدولة (أول موعد + فاصل بالدقائق + ملعب)
  function buildStart(t, teams, { at, gap, venue }) {
    const ids = teams.map(x => x.id), c = cfgOf(t), schedule = { gap: gap || 60, venue: venue || '' };
    const mk = (round, a, b, extra) => ({ id: API.uid(), tournament_id: t.id, round_name: round, group_name: null, team_a_id: a, team_b_id: b, scheduled_at: null, venue: schedule.venue, status: 'upcoming', winner_team_id: b ? null : a, ...extra });
    let list = [], groups = [], rounds = [];
    if (t.format === 'league') list = pairsOf(ids).map(([a, b]) => mk('الدوري', a, b));
    else if (t.format === 'groups') {
      groups = reconcilePlan(t, teams).groups.filter(g => g.teams.length);
      list = interleave(groups.map(g => pairsOf(g.teams).map(([a, b]) => mk('المجموعة ' + g.name, a, b, { group_name: g.name }))));
    } else {
      const n = Math.ceil(ids.length / 2);
      for (let i = 0; i < ids.length; i += 2) list.push(mk(roundTitle(n), ids[i], ids[i + 1] || null));
      rounds = [list.map(m => m.id)];
    }
    if (at) list.filter(m => m.team_b_id).forEach((m, i) => { m.scheduled_at = new Date(+new Date(at) + i * schedule.gap * 60000).toISOString(); });
    return { list, config: { ...c, groups, rounds, champion: null, schedule, teamOrder: ids, matchOrder: list.map(m => m.id) } };
  }
  const rowOf = (tid, m) => ({ id: m.id, tournament_id: tid, round_name: m.round, group_name: m.group || null, team_a_id: m.a || null, team_b_id: m.b || null, scheduled_at: m.at || null, venue: m.venue || '', status: 'upcoming', winner_team_id: m.winner || null });
  const toModel = (t, teams, rows) => { const c = cfgOf(t); return { format: t.format, teams, groups: c.groups, rounds: c.rounds.map(r => [...r]), qualifiers: c.qualifiers, schedule: c.schedule || null, champion: c.champion, status: t.status, fresh: [],
    matches: rows.map(r => ({ id: r.id, round: r.round_name, group: r.group_name || undefined, a: r.team_a_id, b: r.team_b_id, sa: r.score_a, sb: r.score_b, winner: r.winner_team_id, at: r.scheduled_at, venue: r.venue || '' })) }; };
  const tName = (M, id) => (M.teams.find(x => x.id === id) || {}).name || '';
  // مباراة جديدة في الدور التالي: تُجدوَل بعد آخر موعد موجود بنفس الفاصل
  function addMatch(M, round, a, b) {
    let at = null;
    if (M.schedule && M.schedule.gap && b) {
      if (M.cursor == null) { const last = Math.max(0, ...M.matches.map(m => m.at ? +new Date(m.at) : 0)); M.cursor = last ? last + M.schedule.gap * 60000 : null; }
      if (M.cursor != null) { at = new Date(M.cursor).toISOString(); M.cursor += M.schedule.gap * 60000; }
    }
    const m = { id: API.uid(), round, group: undefined, a, b, sa: null, sb: null, winner: b ? null : a, at, venue: (M.schedule && M.schedule.venue) || '' };
    M.matches.push(m); M.fresh.push(m); return m;
  }
  function advance(M) {
    if (M.format === 'groups' && !M.rounds.length) {
      const gm = M.matches.filter(m => m.group);
      if (!gm.length || !gm.every(m => m.sa != null && m.sb != null)) return;
      const k = Math.max(1, Math.min(4, Number(M.qualifiers) || 2)), q = [];
      M.groups.forEach(g => standingsOf(g.teams.map(id => M.teams.find(x => x.id === id)).filter(Boolean), gm.filter(m => m.group === g.name)).slice(0, k).forEach((r, i) => q.push({ id: r.id, group: g.name, rank: i + 1 })));
      if (q.length < 2) return;
      const pool = [...q].sort((a, b) => a.rank - b.rank || a.group.localeCompare(b.group)), pairs = [];
      while (pool.length > 1) { const a = pool.shift(); let j = pool.length - 1; while (j > 0 && pool[j].group === a.group) j--; pairs.push([a.id, pool.splice(j, 1)[0].id]); }
      if (pool.length) pairs.push([pool[0].id, null]);
      M.rounds = [pairs.map(([a, b]) => addMatch(M, roundTitle(pairs.length), a, b).id)]; M.status = 'active';
    }
    for (let ri = 0; ri < M.rounds.length; ri++) {
      const round = M.rounds[ri].map(id => M.matches.find(m => m.id === id)).filter(Boolean);
      if (!round.length || !round.every(m => m.winner)) return;
      if (round.length === 1) { M.champion = tName(M, round[0].winner); M.status = 'completed'; return; }
      if (M.rounds[ri + 1]) continue;
      const w = round.map(m => m.winner), cnt = Math.ceil(w.length / 2), ids = [];
      for (let i = 0; i < w.length; i += 2) ids.push(addMatch(M, roundTitle(cnt), w[i], w[i + 1] || null).id);
      M.rounds.push(ids);
      if (cnt === 1) { const f = M.matches.find(m => m.id === ids[0]); if (f && f.winner) { M.champion = tName(M, f.winner); M.status = 'completed'; } }
      return;
    }
  }
  function recompute(M) {
    if (M.format === 'league') {
      const done = M.matches.length && M.matches.every(m => m.sa != null && m.sb != null);
      if (done) { M.champion = (standingsOf(M.teams, M.matches)[0] || {}).name || null; M.status = 'completed'; }
      else { M.champion = null; if (M.status !== 'cancelled') M.status = 'active'; }
    } else advance(M);
  }
  const flatRounds = (rows, rounds) => rounds.flatMap(ids => ids.map(id => rows.find(x => x.id === id)).filter(Boolean));
  function laterRows(t, rows, m) {
    const c = cfgOf(t); if (t.format === 'league') return [];
    if (m.group_name) return flatRounds(rows, c.rounds);
    const ri = c.rounds.findIndex(r => r.includes(m.id)); return ri < 0 ? [] : flatRounds(rows, c.rounds.slice(ri + 1));
  }
  // بعد أي تغيير في النتائج: يولّد الدور التالي ويحدّث البطل وحالة البطولة في قاعدة البيانات
  async function syncTournament(tid) {
    const [ts, teams, rows] = await Promise.all([API.tournaments.list(), API.tournaments.teams.list(tid), API.tournaments.matches.list(tid)]);
    const t = ts.find(x => x.id === tid); if (!t || t.status === 'registration' || t.status === 'cancelled') return;
    const M = toModel(t, teams, rows), c = cfgOf(t); recompute(M);
    if (M.fresh.length) await API.tournaments.matches.createMany(M.fresh.map(m => rowOf(t.id, m)));
    if (M.fresh.length || M.status !== t.status || (M.champion || null) !== (c.champion || null))
      await API.tournaments.update(t.id, { status: M.status, config: { ...c, rounds: M.rounds, champion: M.champion || null, matchOrder: [...(c.matchOrder || []), ...M.fresh.map(m => m.id)] } });
  }
  const liteOf = ms => ms.map(m => ({ a: m.team_a_id, b: m.team_b_id, sa: m.score_a, sb: m.score_b, group: m.group_name }));
  const standingsHtml = (teams, lite, title) => `<div class="head-row" style="margin-top:18px"><h2 style="font-size:18px">${esc(title)}</h2></div><div class="tbl-wrap"><table><thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>فرق</th><th>نقاط</th></tr></thead><tbody>${standingsOf(teams, lite).map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`;

  // 7.5) ترتيب الفرق (الصفحة الرئيسية في التطبيق)
  const rkFields = [{ name: 'name', label: 'اسم الفريق', req: true, max: 40 }, { name: 'points', label: 'النقاط', type: 'number', req: true, min: 0, maxn: 9999 }];
  const rkCheck = v => { if (v.points == null || !Number.isInteger(v.points) || v.points < 0 || v.points > 9999) throw new Error('النقاط أرقام صحيحة من 0 إلى 9999.'); };
  VIEWS.rank = async () => {
    const rows = ctx.rank = (await API.standings.list()).sort((a, b) => b.points - a.points || a.pos - b.pos);
    return `<div class="head-row"><h2>ترتيب الفرق (${rows.length})</h2><button class="btn" data-act="rk-add">+ فريق</button></div>
    <div class="note">هذا هو الترتيب الذي يظهر في الصفحة الرئيسية للتطبيق، ويُرتَّب تلقائيًا حسب النقاط.</div>
    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>الفريق</th><th>النقاط</th><th>إجراءات</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${r.points}</td><td><div class="row"><button class="btn sec sm" data-act="rk-edit" data-id="${esc(r.id)}">تعديل</button><button class="btn bad sm" data-act="rk-del" data-id="${esc(r.id)}">حذف</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">لا توجد فرق في الترتيب بعد.</div>'}`;
  };

  // 8) الإعدادات (للمالك)
  VIEWS.settings = async () => {
    const s = await API.settings.get(); ctx.set = s; ctx.seats = await API.seats.list().catch(() => null);
    const links = Array.isArray(s.social_links) ? s.social_links.map(l => `${l.label} | ${l.url}`).join('\n') : '';
    return `<div class="head-row"><h2>إعدادات التطبيق</h2></div>
    <form id="setForm" class="card" novalidate style="max-width:720px">
      ${fieldHtml({ name: 'app_name', label: 'اسم التطبيق', max: 40 }, s.app_name ?? 'سواعد')}
      ${fieldHtml({ name: 'app_tagline', label: 'الشعار النصي', max: 90 }, s.app_tagline ?? 'معاً نصنع الأفضل .. داخل وخارج الملعب')}
      ${fieldHtml({ name: 'app_description', label: 'وصف التطبيق', type: 'textarea', max: 300 }, s.app_description ?? '')}
      ${fieldHtml({ name: 'show_slider', label: 'إظهار شريط الشرائح في الصفحة الرئيسية', type: 'checkbox' }, s.show_slider !== false)}
      ${fieldHtml({ name: 'social_links', label: 'روابط التواصل (سطر لكل رابط: الاسم | الرابط)', type: 'textarea', max: 800, help: 'مثال: انستغرام | https://instagram.com/…' }, links)}
      <hr class="sep"><b>تحميل تطبيق الأندرويد (APK)</b>
      ${fieldHtml({ name: 'apk_enabled', label: 'إظهار خيار تحميل التطبيق في الإعدادات العامة', type: 'checkbox' }, !!s.apk_enabled)}
      ${fieldHtml({ name: 'apk_url', label: 'رابط ملف APK', type: 'url', max: 500, ph: 'https://…' }, s.apk_url ?? '')}
      ${fieldHtml({ name: 'apk_version', label: 'رقم الإصدار (اختياري)', max: 20 }, s.apk_version ?? '')}
      <p class="err" id="setErr" role="alert"></p><button class="btn" type="submit">حفظ الإعدادات</button></form>
      ${ctx.seats ? `<form id="seatForm" class="card" novalidate style="max-width:720px;margin-top:14px"><b>أرقام الجلوس المعتمدة (${ctx.seats.length})</b><p class="muted">رقم في كل سطر (6 أرقام). الحفظ يضيف الأرقام الجديدة فقط ولا يحذف الموجودة.</p><textarea id="seatList" rows="8" style="width:100%;margin:8px 0;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--surface)" aria-label="أرقام الجلوس">${esc(ctx.seats.join('\n'))}</textarea><p class="err" id="seatErr" role="alert"></p><button class="btn" type="submit">حفظ القائمة</button></form>` : '<div class="note">تعذّرت قراءة قائمة أرقام الجلوس (راجع صلاحيات قاعدة البيانات).</div>'}`;
  };
  AFTER.settings = () => {
    const form = $('#setForm'); form.onsubmit = async e => {
      e.preventDefault(); const g = n => form.elements[n], err = $('#setErr'); err.textContent = '';
      const links = []; for (const line of g('social_links').value.split('\n').map(x => x.trim()).filter(Boolean)) {
        const i = line.lastIndexOf('|'), label = (i > 0 ? line.slice(0, i) : '').trim(), url = (i > 0 ? line.slice(i + 1) : line).trim();
        if (!httpUrl(url)) { err.textContent = `رابط غير صالح: ${line}`; return; }
        links.push({ label: (label || url).slice(0, 40), url });
      }
      const apk = g('apk_url').value.trim();
      if (apk && !httpUrl(apk)) { err.textContent = 'رابط الـ APK يجب أن يبدأ بـ https://'; return; }
      if (g('apk_enabled').checked && !apk) { err.textContent = 'أدخل رابط الـ APK أو أوقف الخيار.'; return; }
      const name = g('app_name').value.trim(); if (!name) { err.textContent = 'اسم التطبيق مطلوب.'; return; }
      try {
        await API.settings.save({ app_name: name, app_tagline: g('app_tagline').value.trim(), app_description: g('app_description').value.trim(), show_slider: g('show_slider').checked, social_links: links, apk_enabled: g('apk_enabled').checked, apk_url: apk, apk_version: g('apk_version').value.trim() });
        toast('تم حفظ الإعدادات وستظهر للمستخدمين فورًا.');
      } catch (ex) { err.textContent = ex.message; }
    };
  };

  const digits = s => String(s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
  const _afterSettings = AFTER.settings;
  AFTER.settings = () => {
    _afterSettings();
    const f = $('#seatForm'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault(); const err = $('#seatErr'); err.textContent = '';
      const arr = uniq(digits($('#seatList').value).split(/\s+/).filter(Boolean));
      if (!arr.length) { err.textContent = 'أدخل رقمًا واحدًا على الأقل.'; return; }
      const bad = arr.find(x => !/^[0-9]{6}$/.test(x)); if (bad) { err.textContent = `رقم غير صالح: ${bad} (يجب 6 أرقام).`; return; }
      try { await API.seats.add(arr); toast('تم حفظ قائمة أرقام الجلوس.'); render(true); } catch (ex) { err.textContent = ex.message; }
    };
  };

  // ───── الإجراءات (تفويض نقرات) ─────
  const byId = (arr, id) => arr.find(x => String(x.id) === String(id));
  const T_STATUS_NEXT = t => t.status === 'cancelled' ? (t.matchCount > 0 ? 'active' : 'registration') : 'cancelled';
  const ACT = {
    reload: () => render(),
    async 'user-edit'(el) { const u = byId(ctx.users, el.dataset.id); if (!u) return;
      await formBox({ title: 'تعديل المستخدم', note: `رقم الجلوس: ${u.seat_number} (لا يتغير)`, fields: [{ name: 'full_name', label: 'الاسم', req: true, max: 80 }, { name: 'role', label: 'الدور', type: 'select', options: [['student', 'طالب'], ['team_leader', 'مشرف (إدارة المحتوى)']] }, { name: 'approved', label: 'الحساب مفعّل', type: 'checkbox' }],
        values: { full_name: u.full_name, role: u.role, approved: u.approved }, save: async v => { await API.users.update(u.id, { full_name: v.full_name, role: v.role, approved: v.approved }); toast('تم حفظ بيانات المستخدم.'); } }) && render(); },
    async 'user-toggle'(el) { const u = byId(ctx.users, el.dataset.id); if (!u) return; try { await API.users.update(u.id, { approved: !u.approved }); toast(u.approved ? 'تم تعطيل الحساب.' : 'تم تفعيل الحساب.'); render(true); } catch (e) { fail(e); } },
    async 'user-del'(el) { const u = byId(ctx.users, el.dataset.id); if (!u) return;
      if (!await confirmBox(`سيُحذف حساب «${u.full_name}» نهائيًا مع ملفه وعضوياته، ويُفرَج عن رقم جلوسه. البطولات والمباريات التي أنشأها تبقى. لا يمكن التراجع.`, { typed: u.seat_number, okText: 'حذف الحساب' })) return;
      try { await API.users.remove(u.id); toast('تم حذف الحساب.'); render(true); } catch (e) { fail(e); } },

    async 'team-add'() { await formBox({ title: 'فريق جديد', fields: teamFields(), save: async v => { await API.teams.create(teamPatch(v)); toast('تمت إضافة الفريق.'); } }) && render(); },
    async 'team-edit'(el) { const t = byId(ctx.teams, el.dataset.id); if (!t) return;
      await formBox({ title: 'تعديل الفريق', fields: teamFields(t), values: { ...t, players: (t.players || []).join('\n') }, save: async v => { await API.teams.update(t.id, teamPatch(v)); toast('تم حفظ الفريق.'); } }) && render(); },
    async 'team-del'(el) { const t = byId(ctx.teams, el.dataset.id); if (!t) return;
      if (!await confirmBox(`حذف الفريق «${t.name}» وقائمة لاعبيه من قائمة الفرق؟ (فرق البطولات الحالية لا تتأثر).`, { okText: 'حذف الفريق' })) return;
      try { await API.teams.remove(t.id); toast('تم حذف الفريق.'); render(true); } catch (e) { fail(e); } },
    async 'player-add'(el) { const t = byId(ctx.teams, el.dataset.id); if (!t) return;
      await formBox({ title: `لاعب جديد في ${t.name}`, fields: [{ name: 'p', label: 'اسم اللاعب', req: true, max: 40 }], save: async v => {
        const pl = t.players || []; if (pl.some(x => norm(x) === norm(v.p))) throw new Error('اللاعب موجود بالفعل في هذا الفريق.'); if (pl.length >= 60) throw new Error('الحد الأقصى 60 لاعبًا.');
        await API.teams.update(t.id, { players: [...pl, v.p] }); toast('تمت إضافة اللاعب.'); } }) && render(true); },
    async 'player-del'(el) { const t = byId(ctx.teams, el.dataset.id); if (!t) return; const i = +el.dataset.i, name = (t.players || [])[i];
      if (name == null || !await confirmBox(`إزالة اللاعب «${name}» من ${t.name}؟`)) return;
      try { await API.teams.update(t.id, { players: t.players.filter((_, k) => k !== i) }); toast('تمت إزالة اللاعب.'); render(true); } catch (e) { fail(e); } },

    async 't-add'() { await formBox({ title: 'بطولة جديدة', fields: [
        { name: 'name', label: 'اسم البطولة', req: true, max: 80 }, { name: 'sport', label: 'الرياضة', type: 'select', options: SPORTS.map(s => [s, s]) },
        { name: 'format', label: 'نظام البطولة', type: 'select', options: Object.entries(T_FMT), help: 'لا يمكن تغيير النظام بعد الإنشاء.' },
        { name: 'start_date', label: 'تاريخ البداية', type: 'date' }, { name: 'end_date', label: 'تاريخ النهاية', type: 'date' }, { name: 'description', label: 'وصف', type: 'textarea', max: 500 }],
      values: { sport: SPORTS[0], format: 'groups' }, save: async v => {
        if (v.name.length < 2) throw new Error('اسم البطولة حرفان على الأقل.'); if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error('تاريخ النهاية قبل البداية.');
        await API.tournaments.create({ name: v.name, sport: v.sport, format: v.format, start_date: v.start_date || null, end_date: v.end_date || null, description: v.description || '' }); toast('تم إنشاء البطولة. أضف فرقها وحدّد شكل المجموعات ثم ابدأها.'); } }) && render(); },
    async 't-edit'(el) { const t = byId(ctx.ts, el.dataset.id); if (!t) return;
      const stOpts = (t.matchCount > 0 ? ['active', 'completed', 'cancelled'] : ['registration', 'cancelled']).map(k => [k, T_ST[k]]);
      await formBox({ title: 'تعديل البطولة', fields: [
        { name: 'name', label: 'اسم البطولة', req: true, max: 80 }, { name: 'sport', label: 'الرياضة', type: 'select', options: SPORTS.map(s => [s, s]) },
        { name: 'status', label: 'الحالة', type: 'select', options: stOpts, help: 'إعادة فتح التسجيل بعد بدء البطولة تتم من صفحة البطولة بزر «إعادة فتح التسجيل» (لأنها تحذف المباريات).' },
        { name: 'start_date', label: 'تاريخ البداية', type: 'date' }, { name: 'end_date', label: 'تاريخ النهاية', type: 'date' }, { name: 'description', label: 'وصف', type: 'textarea', max: 500 }],
      values: { name: t.name, sport: t.sport, status: stOpts.some(o => o[0] === t.status) ? t.status : stOpts[0][0], start_date: t.start_date || '', end_date: t.end_date || '', description: t.description || '' },
      save: async v => { if (v.name.length < 2) throw new Error('اسم البطولة حرفان على الأقل.'); if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error('تاريخ النهاية قبل البداية.');
        await API.tournaments.update(t.id, { name: v.name, sport: v.sport, status: v.status, start_date: v.start_date || null, end_date: v.end_date || null, description: v.description || '' }); toast('تم حفظ البطولة.'); } }) && render(); },
    async 't-toggle'(el) { const t = byId(ctx.ts, el.dataset.id); if (!t) return; const next = T_STATUS_NEXT(t);
      try { await API.tournaments.update(t.id, { status: next }); toast(next === 'cancelled' ? 'تم إيقاف البطولة.' : 'تم تفعيل البطولة.'); render(true); } catch (e) { fail(e); } },
    async 't-del'(el) { const t = byId(ctx.ts, el.dataset.id); if (!t) return;
      try { const im = await API.tournaments.impact(t.id);
        if (!await confirmBox(`سيُحذف نهائيًا مع كل ما يرتبط بها: ${im.teams} فريقًا، ${im.matches} مباراة، ${im.events} تسجيل (أهداف/تمريرات). لا يمكن التراجع.`, { typed: t.name, okText: 'حذف البطولة' })) return;
        await API.tournaments.remove(t.id); ctx.tid = null; toast('تم حذف البطولة.'); render(); } catch (e) { fail(e); } },
    'e-open'() {},
    't-open'(el) { ctx.tid = el.dataset.id; render(); },
    't-back'() { ctx.tid = null; render(); },
    async 'tt-addcat'() { const c = byId(ctx.catalog, $('#ttCat').value); if (!c) { toast('اختر فريقًا من القائمة أولًا.', false); return; }
      try { await API.tournaments.teams.add(ctx.tid, c.name.slice(0, 40)); toast('تمت إضافة الفريق.'); render(true); } catch (e) { fail(e); } },
    async 'tt-addnew'() { await formBox({ title: 'فريق جديد في البطولة', fields: [{ name: 'n', label: 'اسم الفريق', req: true, max: 40 }], save: async v => { await API.tournaments.teams.add(ctx.tid, v.n); toast('تمت إضافة الفريق.'); } }) && render(true); },
    async 'tt-del'(el) { const t = byId(ctx.tt, el.dataset.id); if (!t || !await confirmBox(`إزالة «${t.name}» من البطولة؟`)) return;
      try { await API.tournaments.teams.remove(t.id); toast('تمت إزالة الفريق.'); render(true); } catch (e) { fail(e); } },
    async 'tm-add'() { const ts = ctx.tt; await formBox({ title: 'مباراة جديدة في الدوري', fields: [
        { name: 'a', label: 'الفريق الأول', type: 'select', options: ts.map(x => [x.id, x.name]) }, { name: 'b', label: 'الفريق الثاني', type: 'select', options: ts.map(x => [x.id, x.name]) },
        { name: 'at', label: 'الموعد', type: 'datetime-local' }, { name: 'venue', label: 'الملعب', max: 60 }], values: { b: ts[1]?.id },
      save: async v => { if (v.a === v.b) throw new Error('اختر فريقين مختلفين.'); await API.tournaments.matches.create({ tournament_id: ctx.tid, round_name: 'الدوري', team_a_id: v.a, team_b_id: v.b, scheduled_at: fromInput(v.at), venue: v.venue, status: 'upcoming' }); await syncTournament(ctx.tid); toast('تمت إضافة المباراة.'); } }) && render(true); },
    async 'tm-edit'(el) { const list = ctx.tm || ctx.tmAll || [], m = byId(list, el.dataset.id), t = byId(ctx.ts, el.dataset.t); if (m && t) await tMatchForm(m, t) && render(true); },
    async 'tm-del'(el) { if (!await confirmBox('حذف هذه المباراة وتسجيلاتها؟')) return; try { await API.tournaments.matches.remove(el.dataset.id); await syncTournament(ctx.tid || ctx.mt); toast('تم حذف المباراة.'); render(true); } catch (e) { fail(e); } },

    mtab(el) { ctx.mtab = el.dataset.v; render(); },
    async 'fx-add'() { await fixtureForm(null) && render(true); },
    async 'fx-edit'(el) { const f = byId(ctx.fixtures, el.dataset.id); if (f) await fixtureForm(f) && render(true); },
    async 'fx-status'(el) { const f = byId(ctx.fixtures, el.dataset.id); if (!f) return; const s = el.dataset.s;
      try { await API.fixtures.update(f.id, { status: s }); toast(s === 'finished' && f.score_a == null ? 'تم التحديث. أضف النتيجة عبر «تعديل».' : 'تم تحديث الحالة.'); render(true); } catch (e) { fail(e); } },
    async 'fx-del'(el) { const f = byId(ctx.fixtures, el.dataset.id); if (!f) return;
      if (!await confirmBox(`حذف مباراة «${f.team_a} × ${f.team_b}» مع أهدافها وتمريراتها المسجلة؟`)) return;
      try { await API.fixtures.remove(f.id); toast('تم حذف المباراة.'); render(true); } catch (e) { fail(e); } },

    // ── شكل المجموعات قبل البدء ──
    async 'gp-up'(el) { await gpEdit(p => gpSwap(p, el.dataset.id, -1)); },
    async 'gp-dn'(el) { await gpEdit(p => gpSwap(p, el.dataset.id, 1)); },
    async 'gp-auto'() { await gpEdit(p => { p.groups = []; }); },
    // ── بدء البطولة وجدولة المباريات ──
    async 't-start'() {
      const t = ctx.cur, teams = ctx.tt; if (!t || teams.length < 2) return;
      await formBox({ title: 'بدء البطولة', note: 'ستُولَّد المباريات الآن وتُقفل قائمة الفرق وتوزيع المجموعات.', okText: 'بدء البطولة',
        fields: [{ name: 'at', label: 'موعد أول مباراة (اختياري)', type: 'datetime-local', help: 'اتركه فارغًا لتحديد المواعيد لاحقًا مباراة مباراة.' }, { name: 'gap', label: 'الفاصل بين المباريات (بالدقائق)', type: 'number', min: 5, maxn: 1440 }, { name: 'venue', label: 'الملعب (اختياري)', max: 60 }],
        values: { gap: (cfgOf(t).schedule || {}).gap || 60 },
        save: async v => {
          if (v.at && isNaN(+new Date(v.at))) throw new Error('الموعد غير صحيح.');
          if (v.gap != null && (v.gap < 5 || v.gap > 1440)) throw new Error('الفاصل بين 5 و1440 دقيقة.');
          const { list, config } = buildStart(t, teams, { at: v.at, gap: v.gap || 60, venue: v.venue });
          await API.tournaments.matches.createMany(list);
          try { await API.tournaments.update(t.id, { status: 'active', config }); }
          catch (e) { await API.tournaments.matches.removeMany(list.map(m => m.id)).catch(() => {}); throw e; }
          await syncTournament(t.id); toast('بدأت البطولة وتولّدت المباريات.');
        } }) && render(true);
    },
    async 't-resched'() {
      const t = ctx.cur, rows = (ctx.tm || []).filter(m => m.status !== 'finished' && m.team_a_id && m.team_b_id);
      if (!rows.length) { toast('لا توجد مباريات غير منتهية لجدولتها.', false); return; }
      const c = cfgOf(t), first = rows.map(m => m.scheduled_at).filter(Boolean).sort()[0];
      await formBox({ title: 'إعادة جدولة المباريات', note: `سيُعاد تحديد موعد ${rows.length} مباراة غير منتهية بترتيبها الحالي، وتبقى المباريات المنتهية كما هي.`, okText: 'تطبيق',
        fields: [{ name: 'at', label: 'موعد أول مباراة', type: 'datetime-local', req: true }, { name: 'gap', label: 'الفاصل بين المباريات (بالدقائق)', type: 'number', req: true, min: 5, maxn: 1440 }, { name: 'venue', label: 'الملعب (اتركه فارغًا لإبقاء الحالي)', max: 60 }],
        values: { at: toInput(first), gap: (c.schedule || {}).gap || 60, venue: '' },
        save: async v => {
          if (isNaN(+new Date(v.at))) throw new Error('الموعد غير صحيح.');
          if (!v.gap || v.gap < 5 || v.gap > 1440) throw new Error('الفاصل بين 5 و1440 دقيقة.');
          const ord = new Map((c.matchOrder || []).map((id, i) => [id, i])), when = m => m.scheduled_at ? +new Date(m.scheduled_at) : Infinity;
          const sorted = [...rows].sort((a, b) => (when(a) - when(b)) || ((ord.get(a.id) ?? 1e9) - (ord.get(b.id) ?? 1e9)));
          for (let i = 0; i < sorted.length; i++) { const p = { scheduled_at: new Date(+new Date(v.at) + i * v.gap * 60000).toISOString() }; if (v.venue) p.venue = v.venue; await API.tournaments.matches.update(sorted[i].id, p); }
          await API.tournaments.update(t.id, { config: { ...c, schedule: { gap: v.gap, venue: v.venue || (c.schedule || {}).venue || '' } } });
          toast('تمت إعادة الجدولة.');
        } }) && render(true);
    },
    async 't-reopen'() {
      const t = ctx.cur; if (!t) return;
      if (!await confirmBox(`سيتم حذف كل مباريات «${t.name}» ونتائجها وتسجيلاتها وإعادة فتح التسجيل. لا يمكن التراجع.`, { typed: t.name, okText: 'حذف وإعادة الفتح' })) return;
      try { const c = cfgOf(t); if ((ctx.tm || []).length) await API.tournaments.matches.removeMany(ctx.tm.map(m => m.id));
        await API.tournaments.update(t.id, { status: 'registration', config: { ...c, groups: [], rounds: [], champion: null, matchOrder: [] } }); toast('أُعيد فتح التسجيل.'); render(true); } catch (e) { fail(e); }
    },
    // ── ترتيب الفرق ──
    async 'rk-add'() { await formBox({ title: 'فريق في الترتيب', fields: rkFields, values: { points: 0 }, save: async v => {
        rkCheck(v); if (ctx.rank.some(r => norm(r.name) === norm(v.name))) throw new Error('هذا الفريق موجود بالفعل في الترتيب.');
        await API.standings.save([{ id: API.uid(), sport: 'overall', name: v.name.slice(0, 40), points: v.points, pos: ctx.rank.length }]); toast('تمت الإضافة.'); } }) && render(true); },
    async 'rk-edit'(el) { const r = byId(ctx.rank, el.dataset.id); if (!r) return;
      await formBox({ title: 'تعديل الفريق في الترتيب', fields: rkFields, values: { name: r.name, points: r.points }, save: async v => {
        rkCheck(v); if (ctx.rank.some(x => x.id !== r.id && norm(x.name) === norm(v.name))) throw new Error('يوجد فريق بنفس الاسم في الترتيب.');
        await API.standings.save([{ ...r, name: v.name.slice(0, 40), points: v.points }]); toast('تم الحفظ.'); } }) && render(true); },
    async 'rk-del'(el) { const r = byId(ctx.rank, el.dataset.id); if (!r || !await confirmBox(`حذف «${r.name}» من الترتيب؟`)) return;
      try { await API.standings.remove(r.id); toast('تم الحذف.'); render(true); } catch (e) { fail(e); } },

    'ev-go'(el) { ctx.sel = el.dataset.key; location.hash = '#scorers'; },
    async 'ev-edit'(el) { const { kind, A, B, mt } = ctx.evCtx, list = kind === 'fixture' ? ctx.ev.fixtureEvents : ctx.ev.matchEvents, e = byId(list, el.dataset.id); if (!e) return;
      const side = kind === 'fixture' ? e.side : (e.team_id && e.team_id === mt.team_b_id ? 'b' : 'a');
      await formBox({ title: 'تعديل التسجيل', fields: [{ name: 'type', label: 'النوع', type: 'select', options: [['goal', 'هدف'], ['assist', 'تمريرة حاسمة']] }, { name: 'side', label: 'الفريق', type: 'select', options: [['a', A], ['b', B]] }, { name: 'name', label: 'اللاعب', req: true, max: 80 }, { name: 'minute', label: 'الدقيقة', type: 'number', min: 0, maxn: 150 }],
        values: { type: e.event_type, side, name: e.player_name, minute: e.minute ?? '' }, save: async v => {
          if (v.minute != null && (!Number.isInteger(v.minute) || v.minute < 0 || v.minute > 150)) throw new Error('الدقيقة من 0 إلى 150.');
          const patch = { player_name: v.name, event_type: v.type, minute: v.minute };
          if (kind === 'fixture') patch.side = v.side; else { patch.team_id = v.side === 'b' ? mt.team_b_id : mt.team_a_id; if (!patch.team_id) throw new Error('حدّد فريقَي المباراة أولًا.'); }
          await API.events.update(kind, e.id, patch); toast('تم حفظ التعديل.'); } }) && render(true); },
    async 'ev-del'(el) { if (!await confirmBox('حذف هذا التسجيل؟')) return; try { await API.events.remove(ctx.evCtx.kind, el.dataset.id); toast('تم الحذف.'); render(true); } catch (e) { fail(e); } },

    atab(el) { ctx.atab = el.dataset.v; render(); },
    async 'a-add'() { const now = toInput(new Date().toISOString()); await formBox({ title: 'إعلان جديد', fields: annFields, values: { starts_at: now, active: true }, save: saveAnn(null) }) && render(true); },
    async 'a-edit'(el) { const a = byId(ctx.anns, el.dataset.id); if (a) await formBox({ title: 'تعديل الإعلان', fields: annFields, values: { title: a.title, body: a.body, starts_at: toInput(a.starts_at), ends_at: toInput(a.ends_at), active: a.active }, save: saveAnn(a) }) && render(true); },
    async 'a-toggle'(el) { const a = byId(ctx.anns, el.dataset.id); if (!a) return; try { await API.announcements.update(a.id, { active: !a.active }); toast(a.active ? 'تم إيقاف الإعلان.' : 'تم تفعيل الإعلان.'); render(true); } catch (e) { fail(e); } },
    async 'a-del'(el) { if (!await confirmBox('حذف هذا الإعلان نهائيًا؟')) return; try { await API.announcements.remove(el.dataset.id); toast('تم حذف الإعلان.'); render(true); } catch (e) { fail(e); } },
    async 'n-add'() { await formBox({ title: 'إشعار جديد', note: 'سيصل إلى جميع مستخدمي التطبيق.', okText: 'إرسال', fields: [{ name: 'title', label: 'العنوان', req: true, max: 60 }, { name: 'body', label: 'النص', type: 'textarea', req: true, max: 240 }],
      save: async v => { if (!v.body.trim()) throw new Error('اكتب نص الإشعار.'); await API.notifications.create({ title: v.title, body: v.body.trim() }); toast('تم إرسال الإشعار.'); } }) && render(true); },
    async 'n-del'(el) { if (!await confirmBox('حذف هذا الإشعار من جميع المستخدمين؟')) return; try { await API.notifications.remove(el.dataset.id); toast('تم حذف الإشعار.'); render(true); } catch (e) { fail(e); } },
  };
  // ── تعديل خطة المجموعات (تُحفظ في config.groupPlan) ──
  const gpSwap = (p, id, d) => { const g = p.groups.find(x => x.teams.includes(id)); if (!g) return; const i = g.teams.indexOf(id), k = i + d; if (k < 0 || k >= g.teams.length) return; [g.teams[i], g.teams[k]] = [g.teams[k], g.teams[i]]; };
  async function gpEdit(fn) {
    const t = ctx.cur; if (!t || !ctx.plan) return;
    const plan = JSON.parse(JSON.stringify(ctx.plan)); fn(plan);
    try { const next = reconcilePlan(t, ctx.tt, plan); await API.tournaments.update(t.id, { config: { ...cfgOf(t), groupPlan: next } }); render(true); } catch (e) { fail(e); }
  }
  const CHG = {
    'gp-count'(el) { gpEdit(p => { p.count = Number(el.value); p.groups = []; }); },
    'gp-move'(el) { const id = el.dataset.id; gpEdit(p => { p.groups.forEach(g => { g.teams = g.teams.filter(x => x !== id); }); const tg = p.groups.find(g => g.name === el.value); if (tg) tg.teams.push(id); }); },
    async 'gp-q'(el) { const t = ctx.cur; try { await API.tournaments.update(t.id, { config: { ...cfgOf(t), qualifiers: Number(el.value) } }); toast('تم حفظ عدد المتأهلين.'); render(true); } catch (e) { fail(e); } },
  };
  const saveAnn = a => async v => {
    const s = fromInput(v.starts_at), e = fromInput(v.ends_at); if (!s) throw new Error('حدّد وقت بدء الظهور.');
    if (e && new Date(e) <= new Date(s)) throw new Error('وقت الانتهاء يجب أن يكون بعد وقت البدء.');
    const row = { title: v.title, body: v.body || '', starts_at: s, ends_at: e, active: v.active };
    if (a) await API.announcements.update(a.id, row); else await API.announcements.create(row);
    toast(a ? 'تم حفظ الإعلان.' : 'تم نشر الإعلان.');
  };

  // ───── الإقلاع ─────
  function deny(reason) {
    const msg = { config: 'لم يتم ربط Supabase.', auth: 'سجّل الدخول من التطبيق أولًا.', role: 'ليست لديك صلاحية الإدارة.' }[reason] || 'تعذر التحقق.';
    $('#gateMsg').textContent = msg + ' جارٍ التحويل إلى الصفحة الرئيسية…';
    setTimeout(() => location.replace('index.html'), 1200);
  }
  async function boot() {
    if (!API || !API.configured) return deny('config');
    let g; try { g = await API.guard(); } catch (e) { return deny('auth'); }
    if (!g.ok) return deny(g.reason);
    P = g.profile; isOwner = P.role === 'admin';
    $('#whoName').textContent = P.full_name || 'حساب';
    $('#whoRole').textContent = ROLE[P.role] || '';
    buildNav();
    $('#gate').hidden = true; $('#shell').hidden = false;
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'); if (nav) { location.hash = '#' + nav.dataset.nav; openSide(false); return; }
      const go = e.target.closest('[data-go]'); if (go) { location.hash = '#' + go.dataset.go; return; }
      const el = e.target.closest('[data-act]'); if (!el || !ACT[el.dataset.act]) return;
      if (el.disabled) return; ACT[el.dataset.act](el);
    });
    document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
    $('#menuBtn').onclick = () => openSide(true); $('#scrim').onclick = () => openSide(false);
    $('#signOut').onclick = async () => { await API.signOut(); location.replace('index.html'); };
    API.onSignOut(() => location.replace('index.html'));
    window.addEventListener('hashchange', route);
    stopLive = API.live(['profiles', 'team_catalog', 'tournaments', 'teams', 'matches', 'fixtures', 'match_scorers', 'fixture_scorers', 'team_standings', 'announcements', 'notifications', 'app_settings'].filter(t => t !== 'profiles' || isOwner), (t, st) => { if (t === '__status') setLive(st); else scheduleRefresh(); });
    route();
  }
  boot();
})();
