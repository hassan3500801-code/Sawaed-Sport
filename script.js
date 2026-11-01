// ===== البيانات التجريبية =====
const SPORTS = [
  {id:'football', name:'كرة القدم', icon:'ball'},
  {id:'volley', name:'كرة الطائرة', icon:'ball'},
  {id:'chess', name:'الشطرنج', icon:'chess'},
  {id:'billiard', name:'البلياردو', icon:'eight'},
  {id:'ps', name:'البلايستيشن', icon:'pad'}
];
let NEXT = null; // أقرب مباراة قادمة يضيفها المالك

// ===== الأيقونات (SVG مضمّنة) =====
const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const svg = (p, z=22) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" ${S} aria-hidden="true">${p}</svg>`;
const ICON = {
  bell:'<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:'<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  trophy:'<path d="M8 4h8v6a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 14v4M8 21h8"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="M12 8l4 3-1.5 5h-5L8 11zM12 3v5M20 10l-4 1M17 19l-2.500-3M7 19l2.500-3M4 10l4 1"/>',
  chess:'<path d="M9 3h6M12 3v3M8 21h8M9 21c0-6 6-6 6 0M9 12c-2 0-2-4 3-4s5 4 3 4"/>',
  eight:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.500"/><path d="M12 10.500v3"/>',
  pad:'<path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5 2l-1-1H8l-1 1a3 3 0 01-5-2v-2a4 4 0 014-4zM8 10v4M6 12h4M16 11h.01M18 13h.01"/>',
  home:'<path d="M3 11l9-8 9 8v10H3z"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function paintIcons(){ $$('[data-icon]').forEach(el => { el.innerHTML = svg(ICON[el.dataset.icon]); el.removeAttribute('data-icon'); el.style.display='contents'; }); }

// ===== الحالة =====
const state = { sport: localStorage.getItem('sport') || 'football', tab: 'home', slide: 0, admin: false };
window.state = state; // مشاركة حالة العرض مع طبقة التطوير الإضافية

// ===== الرياضات والترتيب =====
function renderSports(){
  $('#sportRow').innerHTML = SPORTS.map(s =>
    `<button class="sport" role="tab" data-id="${s.id}" aria-selected="${s.id===state.sport}">${svg(ICON[s.icon],26)}${s.name}</button>`).join('');
  $$('.sport').forEach(b => b.onclick = () => openSport(b.dataset.id));
}
function renderRank(){ window.SawaedBackend?.renderRank?.(); } // الترتيب يديره المالك/المشرفون

// ===== الأحداث والقوائم =====
function renderLists(){
  window.SawaedBackend?.renderFixtures?.(); // المباريات تضيفها الإدارة فقط
  $('#sportList').innerHTML = SPORTS.map(s => `<article class="ev" role="button" tabindex="0" data-sport="${s.id}"><div class="pic">${svg(ICON[s.icon],30)}</div><div><h4>${s.name}</h4><p>${FORMAT[s.id]==='groups' ? 'دور مجموعات • 7 فرق' : 'إقصائيات مباشرة • 14 لاعبًا'}</p></div></article>`).join('');
}

// ===== السلايدر (تلقائي + سحب) =====
function goSlide(i){
  const n = $$('.slide').length; state.slide = (i + n) % n;
  $('#slides').style.transform = `translateX(${state.slide*100}%)`; // RTL: الاتجاه معكوس
  $$('#dots button').forEach((d,k) => d.classList.toggle('on', k===state.slide));
}
function initSlider(){
  $('#dots').innerHTML = $$('.slide').map((_,i) => `<button aria-label="الشريحة ${i+1}"></button>`).join('');
  $$('#dots button').forEach((b,i) => b.onclick = () => { goSlide(i); restart(); });
  let timer, x0 = null;
  const restart = () => { clearInterval(timer); timer = setInterval(() => goSlide(state.slide+1), 4000); };
  const sl = $('#slider');
  sl.addEventListener('touchstart', e => x0 = e.touches[0].clientX, {passive:true});
  sl.addEventListener('touchend', e => { if(x0===null) return; const dx = e.changedTouches[0].clientX - x0; if(Math.abs(dx)>40){ goSlide(state.slide + (dx>0 ? 1 : -1)); restart(); } x0 = null; });
  goSlide(0); restart();
}

// ===== العد التنازلي =====
function tick(){
  if(!NEXT) return;
  if(NEXT.status === 'live'){ $('#count').textContent = 'جارية الآن'; return; }
  let d = new Date(NEXT.at) - Date.now();
  if(d <= 0){ $('#count').textContent = 'حان موعد المباراة'; if(!NEXT.started){ NEXT.started = true; setTimeout(() => window.SawaedBackend?.renderFixtures?.(), 60000); } return; }
  const p = n => String(n).padStart(2,'0');
  const days = Math.floor(d/864e5), h = Math.floor(d%864e5/36e5), m = Math.floor(d%36e5/6e4), s = Math.floor(d%6e4/1e3);
  $('#count').textContent = `${p(days)}:${p(h)}:${p(m)}:${p(s)}`;
}
const DAYS_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function setNextMatch(f){
  const valid = f && Number.isFinite(new Date(f.at).getTime());
  NEXT = valid ? {...f} : null;
  ['#mVs','#count','#mMeta','#details'].forEach(q => $(q).hidden = !valid);
  $('#mEmpty').hidden = !!valid;
  if(!valid){ $('#count').textContent=''; return; }
  const d = new Date(f.at), p = n => String(n).padStart(2,'0'), hr = d.getHours();
  $('#mtTitle').textContent = f.status === 'live' ? 'المباراة الجارية' : 'المباراة القادمة';
  $('#count').classList.toggle('live', f.status === 'live');
  $('#mA').textContent = f.a; $('#mB').textContent = f.b;
  $('#mDay').textContent = DAYS_AR[d.getDay()];
  $('#mDate').textContent = `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`;
  $('#mTime').textContent = `${hr%12||12}:${p(d.getMinutes())} ${hr<12?'ص':'م'}`;
  $('#mVenue').textContent = f.venue || 'الملعب غير محدد';
  tick();
}
window.setNextMatch = setNextMatch;

// ===== التنقل السفلي =====
const TABS = [['home','الرئيسية','home'],['sports','الفرق','ball'],['matches','المباريات','trophy'],['tournaments','البطولات','trophy'],['account','حسابي','user'],['settings','الإعدادات','gear']];
function renderBar(){
  $('#bar').innerHTML = $('#menuNav').innerHTML = TABS.map(t => `<button data-go="${t[0]}" ${t[0]===state.tab?'aria-current="page"':''}>${svg(ICON[t[2]])}${t[1]}</button>`).join('');
}
function go(tab, nav){
  state.tab = nav || tab; showPanel(null); if(!$('#sheet').hidden) sheet(false);
  $$('.view').forEach(v => v.classList.toggle('active', v.id===tab));
  renderBar(); bindGo(); window.scrollTo(0,0);
}
function bindGo(){ $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); }

// ===== نافذة التفاصيل والإشعارات =====
function sheet(open){
  $('#sheet').hidden = $('#back').hidden = !open;
  if(open){
    const f = NEXT, d = f && new Date(f.at), p = n => String(n).padStart(2,'0');
    const evs = (f && f.events) || [], fmt = e => e.name + (e.minute != null ? ` (د${e.minute})` : ''), goals = evs.filter(e => e.type==='goal').map(fmt), assists = evs.filter(e => e.type==='assist').map(fmt);
    const ST = {upcoming:'لم تبدأ بعد', live:'جارية الآن', finished:'انتهت'};
    $('#sheetBody').textContent = f ? [`${f.sport}: ${f.a} ضد ${f.b}، ${DAYS_AR[d.getDay()]} ${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}، الساعة ${$('#mTime').textContent}${f.venue ? '، ' + f.venue : ''}.`, `الحالة: ${ST[f.status] || ST.upcoming}`, f.sa != null && f.sb != null ? `النتيجة: ${f.a} ${f.sa} : ${f.sb} ${f.b}` : '', goals.length ? `الأهداف: ${goals.join('، ')}` : '', assists.length ? `صنّاع الأهداف: ${assists.join('، ')}` : '', f.status === 'live' ? '' : 'يرجى الحضور قبل الموعد بنصف ساعة.'].filter(Boolean).join('\n') : 'لا توجد مباراة قادمة.';
    $('#closeSheet').focus();
  }
}
const seedN = () => [{id:1, title:'أهلًا بك في سواعد', text:'معاً نصنع الأفضل .. داخل وخارج الملعب', t:Date.now()}];
let NOTIFS, SEEN = 0;
try{ NOTIFS = JSON.parse(localStorage.getItem('notifs')); SEEN = +localStorage.getItem('notifSeen') || 0; }catch(e){}
if(!Array.isArray(NOTIFS)) NOTIFS = seedN();
const saveN = () => { try{ localStorage.setItem('notifs', JSON.stringify(NOTIFS)); localStorage.setItem('notifSeen', SEEN); }catch(e){} };
function badge(){ const b = $('#badge'), u = NOTIFS.filter(n => n.id > SEEN).length; b.textContent = u; b.classList.toggle('off', u===0 || !$('#notifToggle').checked); }
function showPanel(id){ $$('.panel').forEach(p => p.hidden = p.id !== id); $('#pBack').hidden = !id; }
function renderNotifs(){
  $('#nlist').innerHTML = NOTIFS.length ? NOTIFS.map(n => `<article class="nt${n.id>SEEN?' new':''}"><div><h4>${esc(n.title)}</h4><p>${esc(n.text)}</p><time>${new Date(n.t).toLocaleString('ar',{dateStyle:'medium',timeStyle:'short'})}</time></div>${state.admin ? `<button data-del="${n.id}" aria-label="حذف الإشعار">${svg('<path d="M6 6l12 12M18 6L6 18"/>',18)}</button>` : ''}</article>`).join('') : '<p class="note">لا توجد إشعارات.</p>';
}
function openNotifs(){ renderNotifs(); showPanel('notifSheet'); SEEN = Math.max(0, ...NOTIFS.map(n => n.id)); saveN(); badge(); }
function sendNotif(){
  if(!state.admin) return;
  const title = $('#nTitle').value.trim(), text = $('#nText').value.trim();
  if(!title || !text){ $('#nErr').textContent = 'اكتب العنوان والنص'; return; }
  const done = () => { $('#nTitle').value = $('#nText').value = ''; $('#nErr').textContent = ''; openNotifs(); };
  const local = () => { NOTIFS.unshift({id: Math.max(0, ...NOTIFS.map(n => n.id)) + 1, title, text, t: Date.now()}); saveN(); done(); };
  // مع Supabase يصل الإشعار لجميع المستخدمين؛ بدونه (أو قبل تشغيل ADMIN_SETUP.sql) يبقى محليًا كما كان
  if(window.SawaedRemote && window.SawaedRemote.hasRemote()){
    window.SawaedRemote.sendNotif(title, text).then(r => { if(r === 'LOCAL') local(); else if(r) $('#nErr').textContent = r; else done(); });
  } else local();
}

// ===== نظام البطولات =====
const FORMAT = {football:'groups', volley:'groups', chess:'ko', billiard:'ko', ps:'ko'};
const GROUPS = [{id:'A', teams:[0,1,2,3]}, {id:'B', teams:[4,5,6]}];
const defaultNames = id => FORMAT[id]==='groups'
  ? ['سواعد','الفريق الثاني','الفريق الثالث','الفريق الرابع','الفريق الخامس','الفريق السادس','الفريق السابع']
  : Array.from({length:14}, (_,i) => `اللاعب ${i+1}`);
// أدوار إقصائية: p = رقم مشارك مباشر، win = الفائز من مباراة، grp/pos = ترتيب مجموعة
const KO_G = [
  {key:'sf', title:'نصف النهائي', m:[{id:'sf-0', a:{grp:0,pos:0}, b:{grp:1,pos:1}}, {id:'sf-1', a:{grp:1,pos:0}, b:{grp:0,pos:1}}]},
  {key:'f', title:'النهائي', m:[{id:'f-0', a:{win:'sf-0'}, b:{win:'sf-1'}}]}
];
const KO_I = [
  {key:'r1', title:'الدور الأول', m:[0,1,2,3,4,5].map(k => ({id:`r1-${k}`, a:{p:2+2*k}, b:{p:3+2*k}}))},
  {key:'qf', title:'ربع النهائي', m:[
    {id:'qf-0', a:{p:0}, b:{win:'r1-0'}}, {id:'qf-1', a:{win:'r1-1'}, b:{win:'r1-2'}},
    {id:'qf-2', a:{win:'r1-3'}, b:{win:'r1-4'}}, {id:'qf-3', a:{win:'r1-5'}, b:{p:1}}]},
  {key:'sf', title:'نصف النهائي', m:[{id:'sf-0', a:{win:'qf-0'}, b:{win:'qf-1'}}, {id:'sf-1', a:{win:'qf-2'}, b:{win:'qf-3'}}]},
  {key:'f', title:'النهائي', m:[{id:'f-0', a:{win:'sf-0'}, b:{win:'sf-1'}}]}
];
const koOf = id => FORMAT[id]==='groups' ? KO_G : KO_I;
const allM = id => koOf(id).flatMap(r => r.m);

let DB = {};
try{ DB = JSON.parse(localStorage.getItem('tourney') || '{}'); }catch(e){ DB = {}; }
const saveDB = () => { try{ localStorage.setItem('tourney', JSON.stringify(DB)); }catch(e){} };
const T = id => { const t = DB[id] || (DB[id] = {names:defaultNames(id), res:{}}); if(!t.order) t.order = {}; return t; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => (v===null || v===undefined || v==='' || isNaN(+v)) ? null : Math.max(0, Math.floor(+v));
const played = r => !!(r && r.s && num(r.s[0])!==null && num(r.s[1])!==null);
const pairs = a => a.flatMap((x,i) => a.slice(i+1).map(y => [x,y]));

function standings(id, g){
  const t = T(id), by = {};
  const rows = g.teams.map(i => by[i] = {i, name:t.names[i], p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0});
  pairs(g.teams).forEach(([a,b]) => {
    const r = t.res[`g${a}-${b}`]; if(!played(r)) return;
    const x = num(r.s[0]), y = num(r.s[1]), A = by[a], B = by[b];
    A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
    if(x>y){ A.w++; B.l++; A.pts += 3; } else if(y>x){ B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  });
  rows.sort((a,b) => b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.i-b.i);
  return rows;
}
const groupDone = (id, g) => pairs(g.teams).every(([a,b]) => played(T(id).res[`g${a}-${b}`]));
const groupReady = (id, g) => groupDone(id,g) || !!T(id).order[g.id];
const sig = id => JSON.stringify(GROUPS.map(g => groupReady(id,g) ? standings(id,g).slice(0,2).map(r => r.i) : null));

function who(id, s){
  if('p' in s) return T(id).names[s.p];
  if('grp' in s){ const g = GROUPS[s.grp]; return groupReady(id,g) ? standings(id,g)[s.pos].name : null; }
  return winnerOf(id, s.win);
}
function winnerOf(id, mid){
  const m = allM(id).find(x => x.id===mid), a = who(id,m.a), b = who(id,m.b), r = T(id).res[mid];
  if(a==null || b==null || !r) return null;
  if(r.p===0) return a; if(r.p===1) return b;
  if(!played(r)) return null;
  const x = num(r.s[0]), y = num(r.s[1]);
  return x>y ? a : y>x ? b : null;
}
function clearAfter(id, mid){
  allM(id).forEach(m => { if(m.a.win===mid || m.b.win===mid){ delete T(id).res[m.id]; clearAfter(id, m.id); } });
}
function setResult(id, mid, vals){
  const t = T(id), isG = mid[0]==='g', old = t.res[mid], wasDone = played(old);
  const key = () => isG ? sig(id) : winnerOf(id, mid), before = key();
  const ns = [num(vals[0]), num(vals[1])];
  t.res[mid] = {s:ns, p:(ns[0]!==null && ns[0]===ns[1] && old && old.p!=null) ? old.p : null};
  if(key() !== before){ if(isG) allM(id).forEach(m => delete t.res[m.id]); else clearAfter(id, mid); }
  saveDB();
  return wasDone || played(t.res[mid]);
}
function setTie(id, mid, p){
  const r = T(id).res[mid] || (T(id).res[mid] = {s:[null,null], p:null});
  const before = winnerOf(id, mid); r.p = r.p===p ? null : p;
  if(winnerOf(id, mid) !== before) clearAfter(id, mid);
  saveDB();
}

// ===== واجهة الرياضة =====
let SV = {id:null, tab:null};
function openSport(id){
  // Competition records and match results are managed only in the dedicated Tournaments view.
  state.sport = id; localStorage.setItem('sport', id);
  go('tournaments');
  window.SawaedBackend?.refresh?.();
}
function card(id, mid, A, B, ko){
  const r = T(id).res[mid] || {}, ok = A.n!=null && B.n!=null;
  const x = r.s ? num(r.s[0]) : null, y = r.s ? num(r.s[1]) : null;
  const done = ok && x!==null && y!==null, tie = done && x===y;
  const win = (ko && ok && r.p!=null) ? r.p : done ? (x>y ? 0 : y>x ? 1 : -1) : -1;
  const side = (S, k, v) => {
    const nm = S.n==null ? '<span class="nm">يُحدَّد لاحقًا</span>'
      : (state.admin && S.i!=null) ? `<button class="nm edit" data-rename="${S.i}">${esc(S.n)}</button>` : `<span class="nm">${esc(S.n)}</span>`;
    const sc = !ok ? '' : state.admin ? `<input class="sc" type="number" inputmode="numeric" min="0" aria-label="نتيجة ${esc(S.n)}" value="${v ?? ''}">` : `<b class="scv">${v ?? '–'}</b>`;
    return `<div class="tm${win===k ? ' win' : ''}${S.n==null ? ' tbd' : ''}">${nm}${sc}</div>`;
  };
  let tr = '';
  if(ko && ok && (tie || state.admin)) tr = state.admin
    ? `<div class="tie"><span>${tie ? 'تعادل — حدد الفائز:' : 'المتأهل يدويًا:'}</span><button data-tie="0" class="${r.p===0?'on':''}">${esc(A.n)}</button><button data-tie="1" class="${r.p===1?'on':''}">${esc(B.n)}</button></div>`
    : (r.p==null ? '<div class="tie"><span>تعادل — بانتظار تحديد الفائز</span></div>' : '');
  return `<div class="mt" data-id="${mid}">${side(A,0,x)}${side(B,1,y)}${tr}</div>`;
}
function koHtml(id, rounds){
  return rounds.map(r => `<h4 class="rh">${r.title}</h4>` + r.m.map(m =>
    card(id, m.id, {n:who(id,m.a), i:'p' in m.a ? m.a.p : null}, {n:who(id,m.b), i:'p' in m.b ? m.b.p : null}, true)).join('')).join('');
}
function champHtml(id){
  const w = winnerOf(id, 'f-0');
  return w ? `<div class="champ">${svg(ICON.trophy,34)}<div><small>البطل</small><b>${esc(w)}</b></div></div>` : '';
}
function groupHtml(id, g){
  const t = T(id), rows = standings(id, g), ad = state.admin, ex = '';
  const th = `<div class="tr th${ex}"><span>#</span><span class="nm">الفريق</span><span>لعب</span><span>ف</span><span>ت</span><span>خ</span><span>فارق</span><span>نقاط</span></div>`;
  const tb = rows.map((r,k) => { const d = r.gf-r.ga;
    const nm = ad ? `<button class="nm edit" data-rename="${r.i}">${esc(r.name)}</button>` : `<span class="nm">${esc(r.name)}</span>`;
    return `<div class="tr${k<2?' q':''}${ex}" data-k="${k}"><span>${k+1}</span>${nm}<span>${r.p}</span><span>${r.w}</span><span>${r.d}</span><span>${r.l}</span><span dir="ltr">${d>0?'+':''}${d}</span><b class="pts">${r.pts}</b></div>`; }).join('');
  const ms = pairs(g.teams).map(([a,b]) => card(id, `g${a}-${b}`, {n:t.names[a], i:a}, {n:t.names[b], i:b}, false)).join('');
  return `<div class="tbl" data-g="${g.id}">${th}${tb}</div><p class="note">المظلّلان يتأهلان. الترتيب: النقاط ثم الفارق ثم المسجَّل، تلقائيًا.</p><h4 class="rh">المباريات</h4>${ms}`;
}
function pplHtml(id){
  const t = T(id), g = FORMAT[id]==='groups', last = t.names.length-1;
  const tag = i => g ? (i<4 ? 'المجموعة أ' : 'المجموعة ب') : (i<2 ? 'متأهل مسبقًا' : 'الدور الأول');
  return '<p class="note">غيّر الاسم مباشرة، أو انقل المشارك بالأسهم لتغيير مجموعته أو موقعه في الجدول (النقل يمسح نتائج هذه الرياضة).</p>' +
    t.names.map((n,i) => `<div class="mt prow" data-i="${i}"><span class="tag">${tag(i)}</span><input class="nin" value="${esc(n)}" maxlength="24" aria-label="الاسم"><button data-mv="-1" aria-label="أعلى" ${i===0?'disabled':''}>▲</button><button data-mv="1" aria-label="أسفل" ${i===last?'disabled':''}>▼</button></div>`).join('');
}
function groupChanged(id, before){ if(sig(id) !== before) allM(id).forEach(m => delete T(id).res[m.id]); saveDB(); }
function moveOrd(id, gid, k, d){
  const g = GROUPS.find(x => x.id===gid), list = standings(id,g).map(r => r.i), j = k+d;
  if(j<0 || j>=list.length) return;
  const before = sig(id); [list[k], list[j]] = [list[j], list[k]]; T(id).order[gid] = list; groupChanged(id, before);
}
function autoOrd(id, gid){ const before = sig(id); delete T(id).order[gid]; groupChanged(id, before); }
async function movePerson(id, i, d){
  const t = T(id), j = i+d; if(j<0 || j>=t.names.length) return;
  if(Object.keys(t.res).length && !(await window.SawaedUI.confirm('نقل المشارك سيمسح نتائج هذه الرياضة. متابعة؟'))) return;
  [t.names[i], t.names[j]] = [t.names[j], t.names[i]]; t.res = {}; t.order = {}; saveDB();
}
function renderSport(){
  const id = SV.id; if(!id) return;
  const sp = SPORTS.find(s => s.id===id), grp = FORMAT[id]==='groups', t = T(id);
  const tabs = grp ? [['A','المجموعة أ'],['B','المجموعة ب'],['ko','الأدوار الإقصائية']] : KO_I.map(r => [r.key, r.title]);
  if(state.admin) tabs.push(['ppl','المشاركون']);
  if(SV.tab==='ppl' && !state.admin) SV.tab = grp ? 'A' : 'r1';
  const info = grp ? 'دور مجموعات: 7 فرق في مجموعتين (4 و3). يتأهل المتصدر والوصيف من كل مجموعة إلى الأدوار الإقصائية.'
    : `إقصائيات مباشرة: 14 لاعبًا. المتأهلان مسبقًا: ${esc(t.names[0])} و${esc(t.names[1])}، والـ12 الباقون يتنافسون في الدور الأول للتأهل إلى ربع النهائي.`;
  let body;
  if(SV.tab==='ppl') body = pplHtml(id);
  else if(grp){
    if(SV.tab==='ko') body = (GROUPS.every(g => groupReady(id,g)) ? '' : '<p class="note">تتحدد الفرق المتأهلة بعد انتهاء جميع مباريات المجموعتين.</p>') + koHtml(id, KO_G) + champHtml(id);
    else body = groupHtml(id, GROUPS.find(g => g.id===SV.tab));
  } else body = koHtml(id, [KO_I.find(r => r.key===SV.tab)]) + (SV.tab==='f' ? champHtml(id) : '');
  const bar = ''; // إدارة كل بيانات المنافسات تتم من صفحة البطولات فقط.
  $('#sportview').innerHTML = `<button class="back-btn" data-back>${svg('<path d="M9 6l6 6-6 6"/>',20)}رجوع</button>
    <h2 class="title">${sp.name}</h2><p class="note">${info}</p>${bar}
    <div class="chips" role="tablist">${tabs.map(([k,n]) => `<button class="chip" role="tab" data-chip="${k}" aria-selected="${k===SV.tab}">${n}</button>`).join('')}</div>${body}`;
}
function initSportView(){
  const sv = $('#sportview');
  sv.addEventListener('click', async e => {
    const q = s => e.target.closest(s);
    if(q('[data-back]')) return go('sports');
    if(q('[data-chip]')){ SV.tab = q('[data-chip]').dataset.chip; return renderSport(); }
    if(!state.admin) return;
    if(q('[data-rename]')){
      const i = +q('[data-rename]').dataset.rename, v = await window.SawaedUI.prompt('اكتب الاسم الجديد', T(SV.id).names[i]);
      if(v && v.trim()){ T(SV.id).names[i] = v.trim().slice(0,24); saveDB(); renderSport(); }
    } else if(q('[data-ord]')){ moveOrd(SV.id, q('[data-g]').dataset.g, +q('.tr').dataset.k, +q('[data-ord]').dataset.ord); renderSport();
    } else if(q('[data-autoord]')){ autoOrd(SV.id, q('.chip[data-autoord]').previousElementSibling.dataset.g); renderSport();
    } else if(q('[data-mv]')){ await movePerson(SV.id, +q('.prow').dataset.i, +q('[data-mv]').dataset.mv); renderSport();
    } else if(q('[data-tie]')){ setTie(SV.id, q('.mt').dataset.id, +q('[data-tie]').dataset.tie); renderSport(); }
    else if(q('[data-reset]')){ if(await window.SawaedUI.confirm('سيتم مسح كل النتائج وإعادة الأسماء الافتراضية لهذه الرياضة. هل أنت متأكد؟')){ delete DB[SV.id]; saveDB(); renderSport(); } }
  });
  sv.addEventListener('change', e => {
    if(state.admin && e.target.classList.contains('nin')){ const v = e.target.value.trim(); if(v){ T(SV.id).names[+e.target.closest('.prow').dataset.i] = v.slice(0,24); saveDB(); } renderSport(); return; }
    if(!state.admin || !e.target.classList.contains('sc')) return;
    const m = e.target.closest('.mt'), ins = m.querySelectorAll('.sc');
    if(setResult(SV.id, m.dataset.id, [ins[0].value, ins[1].value])) renderSport();
  });
  const open = x => { SV.id = null; openSport(x); };
  $('#sportList').addEventListener('click', e => { const a = e.target.closest('[data-sport]'); if(a) open(a.dataset.sport); });
  $('#sportList').addEventListener('keydown', e => { const a = e.target.closest('[data-sport]'); if(a && e.key==='Enter') open(a.dataset.sport); });
}

// ===== الوضع الداكن =====
function applyTheme(dark){ document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }
(function(){
  let saved = null; try{ saved = localStorage.getItem('theme'); }catch(e){}
  applyTheme(saved ? saved==='dark' : matchMedia('(prefers-color-scheme: dark)').matches);
})();

// ===== التشغيل =====
document.addEventListener('DOMContentLoaded', () => {
  paintIcons(); renderSports(); renderRank(); renderLists(); initSlider(); renderBar(); bindGo();
  tick(); setInterval(tick, 1000);
  $('#details').onclick = () => sheet(true);
  $('#closeSheet').onclick = $('#back').onclick = () => sheet(false);
  document.addEventListener('keydown', e => { if(e.key==='Escape'){ showPanel(null); sheet(false); } });
  $('#bell').onclick = openNotifs;
  $('#notifToggle').onchange = badge;
  badge();
  const dt = $('#darkToggle');
  dt.checked = document.documentElement.dataset.theme === 'dark';
  dt.onchange = () => { applyTheme(dt.checked); try{ localStorage.setItem('theme', dt.checked ? 'dark' : 'light'); }catch(e){} };
  state.admin = false;
  initSportView();
  $('#menuBtn').onclick = () => showPanel('menuDrawer');
  $('#pBack').onclick = () => showPanel(null);
  document.addEventListener('click', e => { if(e.target.closest('[data-close]')) showPanel(null); });
  $('#nlist').onclick = async e => { const d = e.target.closest('[data-del]'); if(!(d && state.admin)) return;
    const n = NOTIFS.find(x => x.id === +d.dataset.del);
    if(n && n.rid && window.SawaedRemote){ const r = await window.SawaedRemote.delNotif(n.rid); if(r === null){ renderNotifs(); badge(); return; } if(r !== 'LOCAL'){ if(typeof toast === 'function') toast(r); else alert(r); return; } }
    NOTIFS = NOTIFS.filter(x => x.id !== +d.dataset.del); saveN(); renderNotifs(); badge(); };
});
