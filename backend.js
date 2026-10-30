/* سواعد — طبقة الحسابات والبطولات الجديدة.
   وضع العرض المحلي يعمل دون إعداد Supabase. المصادقة الحقيقية لا تعمل إلا بعد إدخال بيانات المشروع.
*/
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = window.SAWAED_SUPABASE || {url:'', anonKey:''};
  let sb = null, mode = 'login', currentUser = null, profile = null;
  if (window.supabase?.createClient && cfg.url && cfg.anonKey && !cfg.url.includes('YOUR_')) sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  const localKey = 'sawaed_custom_tournaments_v1';
  const seatKey = 'sawaed_approved_seats_v1';
  const getLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const putLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  let localTournaments = getLocal(localKey, []);
  if(!localTournaments.length && typeof window.SawaedLegacyTournamentExport==='function'){localTournaments=window.SawaedLegacyTournamentExport();putLocal(localKey,localTournaments);}
  let demoSeats = getLocal(seatKey, []);
  const sports = ['كرة القدم','كرة الطائرة','الشطرنج','البلياردو','البلايستيشن'];
  const isAdmin = () => !!(profile && ['admin','team_leader'].includes(profile.role) && profile.approved);
  const isRootAdmin = () => !!(profile && profile.role === 'admin' && profile.approved);
  const teamCatalogKey = 'sawaed_team_catalog_v1';
  let localTeams = getLocal(teamCatalogKey, []);
  const msg = (id, text, good=false) => { const el=$(id); if(el){el.textContent=text;el.className=good?'success-msg':'err';} };
  function setMode(next){ mode=next; document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.authMode===mode))); const su=mode==='signup';$('#authName').closest('label').hidden=!su;$('#authSeat').closest('label').hidden=!su;$('#authPassword').autocomplete=su?'new-password':'current-password';$('#authName').required=mode==='signup';$('#authSeat').required=mode==='signup';$('#authSubmit').textContent=mode==='signup'?'إنشاء الحساب':'تسجيل الدخول';msg('#authError',''); }
  async function refreshUser(){
    if(!sb){window.state && (window.state.admin=false);const sendBtn=$('#sendBtn');if(sendBtn)sendBtn.hidden=true;renderAuthState();renderTournaments();renderTeams();renderFixtures();renderRank();return;}
    const {data:{user}}=await sb.auth.getUser(); currentUser=user;
    profile=null;
    if(user){const {data}=await sb.from('profiles').select('full_name,seat_number,role,approved').eq('id',user.id).maybeSingle();profile=data;}
    window.state && (window.state.admin = isAdmin());
    const sendBtn=$('#sendBtn'); if(sendBtn) sendBtn.hidden=!isAdmin();
    if(isAdmin()&&localTournaments.some(t=>t.legacyImported)){for(const t of localTournaments.filter(t=>t.legacyImported)){try{await persistTournament(t);}catch(err){console.warn('تعذرت مزامنة بطولة قديمة',err);}}}
    injectAdminSeats();renderAuthState();renderTournaments();renderTeams();renderManagerTools();renderFixtures();renderRank();
  }
  function renderAuthState(){
    const host=$('#authApp'); if(!host)return;
    if(currentUser){host.innerHTML=`<div class="panel-card"><h3>مرحبًا ${esc(profile?.full_name||currentUser.email)}</h3><p class="muted">البريد: ${esc(currentUser.email)}</p><p class="muted">رقم الجلوس: ${esc(profile?.seat_number||'—')}</p><p class="status-pill">حساب موثّق ✓</p><button class="cta" id="signOutBtn">تسجيل الخروج</button></div>`;$('#signOutBtn').onclick=async()=>{await sb.auth.signOut();currentUser=null;profile=null;location.reload();};return;}
    // Keep the signup/login form from index.html visible.
    const form=$('#authForm'); if(form){form.hidden=false;}
  }
  async function authSubmit(e){e.preventDefault();if(!sb){msg('#authError','لم يتم ربط Supabase بعد. اتبع دليل SUPABASE_SETUP_AR.md ثم أعد تحميل الصفحة.');return;}
    const email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;
    if(mode==='signup'){
      const name=$('#authName').value.trim(),seat=$('#authSeat').value.trim();
      if(!/^\d{6}$/.test(seat)){msg('#authError','رقم الجلوس يجب أن يتكون من 6 أرقام بالضبط.');return;}
      const {data,error}=await sb.rpc('check_seat_available',{p_seat_number:seat});
      if(error||!data){msg('#authError','رقم الجلوس غير معتمد أو مستخدم مسبقًا. راجع المدير.');return;}
      const {data:signup,error:signErr}=await sb.auth.signUp({email,password,options:{data:{full_name:name,seat_number:seat}}});
      if(signErr){msg('#authError',signErr.message);return;}
      msg('#authError','تم إنشاء الحساب. بعد التحقق من البريد ستتمكن من الدخول مباشرة.',true);
    } else {const {error}=await sb.auth.signInWithPassword({email,password});if(error){msg('#authError','تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.');return;}await refreshUser();}
  }
  const uid = () => 't_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);

  // ===== نوافذ داخلية بديلة عن prompt/confirm/alert (تُحظر في بعض متصفحات الجوال) =====
  function toast(text){const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),3400);}
  function uiConfirm(text){return new Promise(res=>{const o=document.createElement('div');o.className='dlg-back';o.innerHTML=`<div class="dlg" role="alertdialog" aria-modal="true"><p>${esc(text)}</p><div class="action-row"><button class="danger" data-y>نعم، متابعة</button><button class="secondary" data-n>إلغاء</button></div></div>`;document.body.appendChild(o);const done=v=>{o.remove();res(v);};o.querySelector('[data-y]').onclick=()=>done(true);o.querySelector('[data-n]').onclick=()=>done(false);o.addEventListener('click',e=>{if(e.target===o)done(false);});o.querySelector('[data-n]').focus();});}

  function uiPrompt(text,val=''){return new Promise(res=>{const o=document.createElement('div');o.className='dlg-back';o.innerHTML=`<form class="dlg"><p>${esc(text)}</p><input class="plain-field" maxlength="40" value="${esc(val)}" aria-label="${esc(text)}"><div class="action-row"><button class="cta" type="submit">حفظ</button><button class="secondary" type="button" data-n>إلغاء</button></div></form>`;document.body.appendChild(o);const inp=o.querySelector('input'),done=v=>{o.remove();res(v);};o.querySelector('form').onsubmit=e=>{e.preventDefault();done(inp.value);};o.querySelector('[data-n]').onclick=()=>done(null);o.addEventListener('click',e=>{if(e.target===o)done(null);});inp.focus();inp.select();});}
  window.SawaedUI={confirm:uiConfirm,prompt:uiPrompt,toast};

  // ===== شعارات الفرق =====
  const safeLogo=l=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(l||''))?String(l):'';
  const avatarInner=(name,logo)=>logo?`<img src="${logo}" alt="">`:esc(([...String(name||'').trim()][0])||'؟');
  const avatar=(name,logo,cls='')=>`<span class="tc-badge ${cls}">${avatarInner(name,safeLogo(logo))}</span>`;
  function readLogo(file){return new Promise((res,rej)=>{if(!file||!/^image\//.test(file.type))return rej(new Error('اختر ملف صورة.'));if(file.size>8e6)return rej(new Error('الصورة كبيرة جدًا (الحد 8 ميجابايت).'));const fr=new FileReader();fr.onerror=()=>rej(new Error('تعذر قراءة الملف.'));fr.onload=()=>{const im=new Image();im.onerror=()=>rej(new Error('تعذر قراءة الصورة.'));im.onload=()=>{let out='';for(const s of [192,128,96]){const r=Math.min(1,s/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*r));c.height=Math.max(1,Math.round(im.height*r));c.getContext('2d').drawImage(im,0,0,c.width,c.height);out=c.toDataURL('image/png');if(out.length<150000)break;}res(out);};im.src=fr.result;};fr.readAsDataURL(file);});}
  function wireLogo(form){const file=form.querySelector('[name=logoFile]'),hid=form.querySelector('[name=logo]'),prev=form.querySelector('.logo-prev'),nm=form.querySelector('[name=name]');if(!file||!hid||!prev)return;const paint=()=>{prev.innerHTML=avatarInner(nm.value,hid.value);};file.onchange=async()=>{const f=file.files[0];if(!f)return;try{hid.value=await readLogo(f);paint();}catch(err){toast(err.message);}file.value='';};form.querySelector('[data-logo-clear]').onclick=()=>{hid.value='';paint();};nm.addEventListener('input',()=>{if(!hid.value)paint();});}

  // ===== البطولات: إنشاء ثم إضافة الفرق ثم البدء. الترتيب تلقائي حسب النقاط =====
  const FORMAT_NAMES={groups:'مجموعات ثم أدوار إقصائية',league:'دوري من دور واحد',knockout:'خروج المغلوب'};
  const STATUS_NAMES={registration:'التسجيل مفتوح',active:'جارية',completed:'مكتملة'};
  let tList=[],openTid=null,tEditing=false;
  const tn=(t,id)=>t.teams.find(x=>x.id===id)?.name||'يتحدد لاحقًا';
  const roundTitle=n=>n===1?'النهائي':n===2?'نصف النهائي':n===4?'ربع النهائي':'دور الـ'+(n*2);
  const normName=s=>String(s||'').trim().toLowerCase();
  const logoByName=name=>{const c=(teamsCache||[]).find(x=>normName(x.name)===normName(name));return c?{id:c.id,logo:safeLogo(c.logo)}:{id:null,logo:''};};
  function newTournament({name,sport,format,qualifiers}){
    name=String(name||'').trim();
    if(name.length<2)throw new Error('اكتب اسم البطولة (حرفان على الأقل).');
    return {id:uid(),name:name.slice(0,80),sport,format,qualifiers:Math.min(4,Math.max(1,Number(qualifiers)||2)),status:'registration',teams:[],matches:[],groups:[],rounds:[],createdAt:new Date().toISOString()};
  }
  // الترتيب التلقائي: النقاط ثم فارق الأهداف ثم الأهداف المسجلة ثم الاسم
  function standings(teams,matches){
    const tb={};teams.forEach(x=>tb[x.id]={id:x.id,name:x.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
    matches.filter(m=>m.sa!=null&&m.sb!=null&&tb[m.a]&&tb[m.b]).forEach(m=>{const a=tb[m.a],b=tb[m.b];a.p++;b.p++;a.gf+=m.sa;a.ga+=m.sb;b.gf+=m.sb;b.ga+=m.sa;if(m.sa>m.sb){a.w++;b.l++;a.pts+=3;}else if(m.sb>m.sa){b.w++;a.l++;b.pts+=3;}else{a.d++;b.d++;a.pts++;b.pts++;}});
    return Object.values(tb).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name,'ar'));
  }
  function generate(t){
    if(t.teams.length<2)throw new Error('أضف فريقين على الأقل قبل بدء البطولة.');
    t.matches=[];t.groups=[];t.rounds=[];delete t.champion;
    const ids=t.teams.map(x=>x.id);let k=1;
    const mk=(round,a,b,extra)=>({id:t.id+'_m'+(k++),round,a,b,sa:null,sb:null,winner:null,...(extra||{})});
    if(t.format==='league'){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)t.matches.push(mk('الدوري',ids[i],ids[j]));}
    else if(t.format==='groups'){
      const gc=Math.ceil(ids.length/4);t.groups=Array.from({length:gc},(_,i)=>({name:String.fromCharCode(65+i),teams:[]}));ids.forEach((id,i)=>t.groups[i%gc].teams.push(id));
      for(const g of t.groups)for(let i=0;i<g.teams.length;i++)for(let j=i+1;j<g.teams.length;j++)t.matches.push(mk('المجموعة '+g.name,g.teams[i],g.teams[j],{group:g.name}));
    } else {
      const round=[],n=Math.ceil(ids.length/2);
      for(let i=0;i<ids.length;i+=2){const b=ids[i+1]||null,m=mk(roundTitle(n),ids[i],b);if(!b)m.winner=ids[i];round.push(m);t.matches.push(m);}
      t.rounds.push(round.map(m=>m.id));
    }
    t.status='active';
    if(t.format!=='league')advance(t);
  }
  function advance(t){
    if(t.format==='groups'&&!t.rounds.length){
      const gm=t.matches.filter(m=>m.group);
      if(!gm.length||!gm.every(m=>m.sa!=null&&m.sb!=null))return;
      const k=Math.max(1,Math.min(4,Number(t.qualifiers)||2)),q=[];
      t.groups.forEach(g=>standings(g.teams.map(id=>t.teams.find(x=>x.id===id)).filter(Boolean),gm.filter(m=>m.group===g.name)).slice(0,k).forEach((r,i)=>q.push({id:r.id,group:g.name,rank:i+1})));
      if(q.length<2)return;
      const pool=[...q].sort((a,b)=>a.rank-b.rank||a.group.localeCompare(b.group)),pairs=[];
      while(pool.length>1){const a=pool.shift();let j=pool.length-1;while(j>0&&pool[j].group===a.group)j--;pairs.push([a.id,pool.splice(j,1)[0].id]);}
      if(pool.length)pairs.push([pool[0].id,null]);
      const ids=pairs.map(([a,b])=>{const m={id:uid(),round:roundTitle(pairs.length),a,b,sa:null,sb:null,winner:b?null:a};t.matches.push(m);return m.id;});
      t.rounds=[ids];t.status='active';
    }
    for(let ri=0;ri<t.rounds.length;ri++){
      const round=t.rounds[ri].map(id=>t.matches.find(m=>m.id===id)).filter(Boolean);
      if(!round.length||!round.every(m=>m.winner))return;
      if(round.length===1){t.champion=tn(t,round[0].winner);t.status='completed';return;}
      if(t.rounds[ri+1])continue;
      const w=round.map(m=>m.winner),cnt=Math.ceil(w.length/2),ids=[];
      for(let i=0;i<w.length;i+=2){const b=w[i+1]||null,m={id:uid(),round:roundTitle(cnt),a:w[i],b,sa:null,sb:null,winner:b?null:w[i]};t.matches.push(m);ids.push(m.id);}
      t.rounds.push(ids);
      if(cnt===1&&t.matches.find(m=>m.id===ids[0])?.winner){t.champion=tn(t,t.matches.find(m=>m.id===ids[0]).winner);t.status='completed';}
      return;
    }
  }
  function recompute(t){
    if(t.format==='league'){const done=t.matches.length&&t.matches.every(m=>m.sa!=null&&m.sb!=null);if(done){t.champion=standings(t.teams,t.matches)[0]?.name;t.status='completed';}else{delete t.champion;t.status='active';}}
    else advance(t);
  }
  const laterMatches=(t,m)=>{if(t.format==='league')return [];const flat=r=>r.flatMap(ids=>ids.map(id=>t.matches.find(x=>x.id===id)).filter(Boolean));if(m.group)return flat(t.rounds);const ri=t.rounds.findIndex(r=>r.includes(m.id));return ri<0?[]:flat(t.rounds.slice(ri+1));};
  function dropLater(t,m){const later=laterMatches(t,m),drop=new Set(later.map(x=>x.id));t.matches=t.matches.filter(x=>!drop.has(x.id));if(m.group)t.rounds=[];else{const ri=t.rounds.findIndex(r=>r.includes(m.id));if(ri>=0)t.rounds=t.rounds.slice(0,ri+1);}delete t.champion;t.status='active';}

  async function persistTournament(t){
    const payload={id:t.id,name:t.name,sport:t.sport,format:t.format,status:t.status,config:{qualifiers:t.qualifiers,groups:t.groups||[],rounds:t.rounds||[],champion:t.champion||null,teamOrder:t.teams.map(x=>x.id),matchOrder:t.matches.map(x=>x.id)},created_by:currentUser?.id};
    let r=await sb.from('tournaments').upsert(payload);if(r.error)throw r.error;
    const {data:oldTeams,error:e1}=await sb.from('teams').select('id').eq('tournament_id',t.id);if(e1)throw e1;
    const {data:oldMatches,error:e2}=await sb.from('matches').select('id').eq('tournament_id',t.id);if(e2)throw e2;
    const keepM=new Set(t.matches.map(x=>x.id)),keepT=new Set(t.teams.map(x=>x.id));
    const dm=(oldMatches||[]).filter(x=>!keepM.has(x.id)).map(x=>x.id);if(dm.length){r=await sb.from('matches').delete().in('id',dm);if(r.error)throw r.error;}
    const dt=(oldTeams||[]).filter(x=>!keepT.has(x.id)).map(x=>x.id);if(dt.length){r=await sb.from('teams').delete().in('id',dt);if(r.error)throw r.error;}
    if(t.teams.length){r=await sb.from('teams').upsert(t.teams.map(x=>({id:x.id,tournament_id:t.id,name:x.name})));if(r.error)throw r.error;}
    if(t.matches.length){r=await sb.from('matches').upsert(t.matches.map(m=>({id:m.id,tournament_id:t.id,round_name:m.round,group_name:m.group||null,team_a_id:m.a||null,team_b_id:m.b||null,score_a:m.sa??null,score_b:m.sb??null,winner_team_id:m.winner||null})));if(r.error)throw r.error;}
    const {data:oldScorers,error:e3}=await sb.from('match_scorers').select('id').eq('tournament_id',t.id);if(e3)throw e3;
    const allScorers=t.matches.flatMap(m=>(m.scorers||[]).map(x=>({...x,match_id:m.id,tournament_id:t.id})));
    const keepS=new Set(allScorers.map(x=>x.id));
    const ds=(oldScorers||[]).filter(x=>!keepS.has(x.id)).map(x=>x.id);
    if(ds.length){r=await sb.from('match_scorers').delete().in('id',ds);if(r.error)throw r.error;}
    if(allScorers.length){r=await sb.from('match_scorers').upsert(allScorers.map(x=>({id:x.id,match_id:x.match_id,tournament_id:t.id,team_id:keepT.has(x.team_id)?x.team_id:null,player_name:x.player_name,event_type:x.event_type,minute:x.minute??null,created_by:currentUser?.id||null})));if(r.error)throw r.error;}
  }
  async function saveT(t){
    if(!sb){putLocal(localKey,localTournaments);return null;}
    if(!isAdmin())return 'ليست لديك صلاحية التعديل.';
    try{await persistTournament(t);return null;}catch(e){return 'تعذر الحفظ: '+(e.message||e);}
  }
  async function loadTournaments(){
    if(!sb)return localTournaments;
    const {data,error}=await sb.from('tournaments').select('*').order('created_at',{ascending:false});if(error)throw error;
    const [tm,mt,sc]=await Promise.all([sb.from('teams').select('*'),sb.from('matches').select('*'),sb.from('match_scorers').select('*')]);if(tm.error)throw tm.error;if(mt.error)throw mt.error;if(sc.error)throw sc.error;
    const sortBy=(arr,order)=>{if(!Array.isArray(order))return arr;const ix=new Map(order.map((id,i)=>[id,i]));return [...arr].sort((a,b)=>(ix.has(a.id)?ix.get(a.id):1e9)-(ix.has(b.id)?ix.get(b.id):1e9));};
    return data.map(r=>{const c=r.config||{};return {id:r.id,name:r.name,sport:r.sport,format:r.format,status:r.status,qualifiers:c.qualifiers||2,groups:c.groups||[],rounds:c.rounds||[],champion:c.champion||undefined,
      teams:sortBy(tm.data.filter(x=>x.tournament_id===r.id).map(x=>({id:x.id,name:x.name})),c.teamOrder),
      matches:sortBy(mt.data.filter(x=>x.tournament_id===r.id).map(x=>({id:x.id,round:x.round_name,group:x.group_name||undefined,a:x.team_a_id,b:x.team_b_id,sa:x.score_a,sb:x.score_b,winner:x.winner_team_id,scorers:sc.data.filter(z=>z.match_id===x.id).map(z=>({id:z.id,team_id:z.team_id,player_name:z.player_name,event_type:z.event_type,minute:z.minute}))})),c.matchOrder)};});
  }
  const sportOptions=cur=>sports.map(s=>`<option${s===cur?' selected':''}>${esc(s)}</option>`).join('');
  async function renderTournaments(){
    const host=$('#tournamentApp');if(!host)return;
    try{tList=await loadTournaments();}catch(e){tList=localTournaments;toast('تعذر تحميل البطولات: '+(e.message||e));}
    try{teamsCache=await loadTeamCatalog();}catch(e){}
    const admin=isAdmin();let h='';
    if(admin)h+=`<div class="panel-card"><h3>إنشاء بطولة</h3><p class="muted">أنشئ البطولة أولًا ثم أضف إليها الفرق من صفحتها، وبعدها ابدأ البطولة لتُولَّد المباريات.</p><form id="createTournament" class="form-grid"><input class="plain-field" name="name" required maxlength="80" placeholder="اسم البطولة" aria-label="اسم البطولة"><select name="sport" aria-label="الرياضة">${sportOptions('')}</select><select name="format" aria-label="نظام البطولة">${Object.entries(FORMAT_NAMES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><label class="muted">عدد المتأهلين من كل مجموعة (لنظام المجموعات)</label><input class="plain-field" name="qualifiers" type="number" min="1" max="4" value="2"><button class="cta" type="submit">إنشاء البطولة</button><p id="tournamentError" class="err" role="alert"></p></form></div>`;
    if(!tList.length)h+='<div class="panel-card"><p class="muted">لا توجد بطولات حتى الآن.</p></div>';
    h+=tList.map(t=>`<article class="panel-card tournament-card" role="button" tabindex="0" data-t-open="${esc(t.id)}"><h3>${esc(t.name)}</h3><p class="muted">${esc(t.sport)} · ${FORMAT_NAMES[t.format]||''}</p><span class="status-pill">${STATUS_NAMES[t.status]||''}</span> <span class="muted">${t.teams.length} فريق</span>${t.champion?`<p class="champ-line">البطل: <b>${esc(t.champion)}</b></p>`:''}</article>`).join('');
    host.innerHTML=h;
    const form=$('#createTournament');
    if(form)form.onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;let t;try{const fd=new FormData(form);t=newTournament({name:fd.get('name'),sport:fd.get('sport'),format:fd.get('format'),qualifiers:fd.get('qualifiers')});}catch(err){msg('#tournamentError',err.message);return;}
      tList.unshift(t);const err=await saveT(t);if(err){tList.splice(tList.indexOf(t),1);msg('#tournamentError',err);return;}openT(t.id);};
    const open=el=>{if(el)openT(el.dataset.tOpen);};
    host.onclick=e=>open(e.target.closest('[data-t-open]'));
    host.onkeydown=e=>{if(e.key==='Enter')open(e.target.closest('[data-t-open]'));};
    if(openTid)renderTView();
  }
  function openT(id){openTid=id;tEditing=false;renderTView();if(typeof go==='function')go('tview','tournaments');}
  const teamRow=(t,x,editable)=>{const L=logoByName(x.name);return `<li class="t-team">${avatar(x.name,L.logo)}${editable?`<input class="nin" data-t-rename="${esc(x.id)}" value="${esc(x.name)}" maxlength="40" aria-label="اسم الفريق"><button class="danger" data-t-rm="${esc(x.id)}" aria-label="إزالة الفريق">✕</button>`:(L.id?`<button class="link tname" data-t-team="${esc(L.id)}">${esc(x.name)}</button>`:`<span class="tname">${esc(x.name)}</span>`)}</li>`;};
  function standingsTable(t,teams,matches,title,qual){
    const rows=standings(teams,matches);
    return `${title?`<h4 class="rh">${esc(title)}</h4>`:''}<div class="tbl-wrap"><table class="data-table"><tr><th>#</th><th>الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th></tr>${rows.map((r,i)=>`<tr class="${qual&&i<qual?'qual':''}"><td>${i+1}</td><td class="tm">${avatar(r.name,logoByName(r.name).logo,'sm')}<span>${esc(r.name)}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table></div>`;
  }
  function aggregateScorers(t){
    const totals={goals:new Map(),assists:new Map()};
    (t.matches||[]).forEach(m=>(m.scorers||[]).forEach(x=>{
      const key=String(x.player_name||'').trim();if(!key)return;
      const bucket=x.event_type==='goal'?totals.goals:totals.assists;
      bucket.set(key,(bucket.get(key)||0)+1);
    }));
    const sort=map=>[...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ar'));
    return {goals:sort(totals.goals),assists:sort(totals.assists)};
  }
  function scorerLeaders(rows,title){
    if(!rows.length)return '';
    return `<section class="panel-card scorer-leaders"><h3>${title}</h3><ol class="rank">${rows.map((x,i)=>`<li><span class="n">${i+1}</span><span class="nm">${esc(x.name)}</span><span class="pt">${x.count}</span></li>`).join('')}</ol></section>`;
  }
  async function openScorerDialog(t,m,existing){
    const old=existing||{},overlay=document.createElement('div');overlay.className='dlg-back';
    const opts=t.teams.map(x=>`<option value="${esc(x.id)}"${(old.team_id||m.a)===x.id?' selected':''}>${esc(x.name)}</option>`).join('');
    overlay.innerHTML=`<form class="dlg scorer-dialog"><h3>${old.id?'تعديل حدث':'إضافة هدف أو تمريرة'}</h3>
      <label>نوع الحدث<select name="event_type" class="plain-field"><option value="goal"${old.event_type!=='assist'?' selected':''}>هدف</option><option value="assist"${old.event_type==='assist'?' selected':''}>تمريرة حاسمة</option></select></label>
      <label>الفريق<select name="team_id" class="plain-field">${opts}</select></label>
      <label>اسم اللاعب<input name="player_name" class="plain-field" maxlength="40" required value="${esc(old.player_name||'')}"></label>
      <label>الدقيقة (اختياري)<input name="minute" class="plain-field" type="number" min="0" max="130" value="${old.minute??''}"></label>
      <div class="action-row"><button class="cta" type="submit">حفظ</button>${old.id?'<button class="danger" type="button" data-scorer-delete>حذف</button>':''}<button class="secondary" type="button" data-scorer-cancel>إلغاء</button></div></form>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('[data-scorer-cancel]').onclick=close;
    overlay.onclick=e=>{if(e.target===overlay)close();};
    overlay.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target),name=String(fd.get('player_name')).trim(),minute=String(fd.get('minute')).trim();
      if(!name||name.length>40){toast('أدخل اسم لاعب صحيحًا.');return;}
      if(minute!==''&&(!Number.isInteger(Number(minute))||Number(minute)<0||Number(minute)>130)){toast('الدقيقة يجب أن تكون بين 0 و130.');return;}
      const row={id:old.id||uid(),team_id:String(fd.get('team_id')||''),player_name:name,event_type:String(fd.get('event_type')),minute:minute===''?null:Number(minute)};
      m.scorers=m.scorers||[];if(old.id)m.scorers=m.scorers.map(x=>x.id===old.id?row:x);else m.scorers.push(row);
      close();const err=await saveT(t);if(err)toast(err);renderTView();
    };
    const del=overlay.querySelector('[data-scorer-delete]');if(del)del.onclick=async()=>{if(!await uiConfirm('حذف هذا الحدث؟'))return;m.scorers=(m.scorers||[]).filter(x=>x.id!==old.id);close();const err=await saveT(t);if(err)toast(err);renderTView();};
  }
  function matchCard(t,m,admin){
    const bye=!m.b,events=(m.scorers||[]);
    return `<div class="panel-card mcard"><div class="mrow"><span class="mtn">${esc(tn(t,m.a))}</span><span class="ms">${bye?'—':(m.sa??'-')+' : '+(m.sb??'-')}</span><span class="mtn">${bye?'يتأهل مباشرة':esc(tn(t,m.b))}</span></div>${admin&&!bye?`<div class="action-row"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-sc="a" data-m="${esc(m.id)}" value="${m.sa??''}" aria-label="نتيجة ${esc(tn(t,m.a))}"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-sc="b" data-m="${esc(m.id)}" value="${m.sb??''}" aria-label="نتيجة ${esc(tn(t,m.b))}"><button data-t-save="${esc(m.id)}">حفظ النتيجة</button>${t.format==='league'?`<button class="danger" data-t-delm="${esc(m.id)}">حذف</button>`:''}</div>`:''}${admin&&!bye?`<button class="chip scorer-add" data-scorer-add="${esc(m.id)}">+ هدف/تمريرة</button>`:''}${events.length?`<div class="scorer-events">${events.map(x=>`<button class="scorer-chip" data-scorer-edit="${esc(m.id)}" data-scorer-id="${esc(x.id)}">${x.event_type==='goal'?'⚽ هدف':'👟 تمريرة'} · ${esc(x.player_name)}${x.minute!=null?' · '+x.minute+'′':''}</button>`).join('')}</div>`:''}</div>`;
  }
  function renderTView(){
    const host=$('#tview');if(!host)return;const t=tList.find(x=>x.id===openTid);
    if(!t){openTid=null;host.innerHTML='';return;}
    const admin=isAdmin(),reg=t.status==='registration',back=typeof svg==='function'?svg('<path d="M9 6l6 6-6 6"/>',20):'';
    let h=`<button class="back-btn" data-t-back>${back}رجوع</button><div class="team-hero"><h2>${esc(t.name)}</h2><p>${esc(t.sport)} · ${FORMAT_NAMES[t.format]||''}</p><span class="hero-count">${STATUS_NAMES[t.status]||''}</span></div>`;
    if(t.champion)h+=`<div class="champ"><div><small>البطل</small><b>${esc(t.champion)}</b></div></div>`;
    if(admin)h+=tEditing
      ?`<form id="tEditForm" class="panel-card form-grid"><h3>تعديل البطولة</h3><input class="plain-field" name="name" required maxlength="80" value="${esc(t.name)}" aria-label="اسم البطولة"><select name="sport" aria-label="الرياضة">${sportOptions(t.sport)}</select>${t.format==='groups'&&reg?`<label class="muted">عدد المتأهلين من كل مجموعة</label><input class="plain-field" name="qualifiers" type="number" min="1" max="4" value="${t.qualifiers||2}">`:''}<button class="cta" type="submit">حفظ التعديلات</button><button class="link" type="button" data-t-cancel>إلغاء</button><p id="tEditMsg" class="err" role="alert"></p></form>`
      :`<div class="action-row"><button data-t-edit>تعديل البطولة</button><button class="danger" data-t-del>حذف البطولة</button></div>`;
    h+=`<section class="panel-card"><h3>الفرق المشاركة (${t.teams.length})</h3>${t.teams.length?`<ul class="t-teams">${t.teams.map(x=>teamRow(t,x,admin&&reg)).join('')}</ul>`:'<p class="muted">لم تُضف فرق إلى هذه البطولة بعد.</p>'}`;
    if(admin&&reg){
      const used=new Set(t.teams.map(x=>normName(x.name))),avail=(teamsCache||[]).filter(c=>!used.has(normName(c.name)));
      h+=`<div class="t-add"><select id="tCat" class="plain-field" aria-label="فريق من قائمة الفرق"><option value="">${avail.length?'اختر فريقًا من قائمة الفرق...':'لا توجد فرق أخرى في قائمة الفرق'}</option>${avail.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><div class="action-row"><button data-t-addcat>إضافة الفريق المحدد</button>${avail.length>1?`<button class="secondary" data-t-addall>إضافة كل الفرق (${avail.length})</button>`:''}</div><form id="tQuick" class="t-quick"><input class="nin" name="name" required maxlength="40" placeholder="أو اكتب اسم فريق جديد" aria-label="اسم فريق جديد"><button class="chip" type="submit">إضافة</button></form></div>`;
    }
    h+='</section>';
    if(admin&&reg)h+=`<button class="cta" data-t-start ${t.teams.length<2?'disabled':''}>بدء البطولة وتوليد المباريات</button><p class="muted">${t.teams.length<2?'أضف فريقين على الأقل لتتمكن من البدء.':'بعد البدء تُولَّد المباريات تلقائيًا حسب نظام البطولة ويُقفل تعديل الفرق.'}</p>`;
    if(!reg){
      if(admin)h+='<button class="secondary" data-t-reopen>إعادة فتح التسجيل (يحذف المباريات والنتائج)</button>';
      h+='<p class="note">الترتيب يتحدّث تلقائيًا حسب النقاط ثم فارق الأهداف.</p>';
      if(t.format==='league')h+=standingsTable(t,t.teams,t.matches,'ترتيب الدوري');
      if(t.format==='groups')h+=t.groups.map(g=>standingsTable(t,g.teams.map(id=>t.teams.find(x=>x.id===id)).filter(Boolean),t.matches.filter(m=>m.group===g.name),'المجموعة '+g.name,Number(t.qualifiers)||2)).join('')+'<p class="muted">الصفوف المظللة هي الفرق المتأهلة.</p>';
      const leaders=aggregateScorers(t);h+=scorerLeaders(leaders.goals,'هدافو البطولة')+scorerLeaders(leaders.assists,'صنّاع الأهداف');
      const rounds=[];t.matches.forEach(m=>{let r=rounds.find(x=>x.name===m.round);if(!r)rounds.push(r={name:m.round,list:[]});r.list.push(m);});
      h+='<h3 class="rh">المباريات والنتائج</h3>'+rounds.map(r=>`<h4 class="rh">${esc(r.name)}</h4>${r.list.map(m=>matchCard(t,m,admin)).join('')}`).join('');
      if(t.format!=='league'&&admin)h+='<p class="muted">في الأدوار الإقصائية لا يوجد تعادل، ويُولَّد الدور التالي تلقائيًا عند اكتمال نتائج الدور.</p>';
      if(admin&&t.format==='league')h+=`<form id="tMatchForm" class="panel-card form-grid"><h3>إضافة مباراة</h3><select name="a" aria-label="الفريق الأول">${t.teams.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><select name="b" aria-label="الفريق الثاني">${t.teams.map((x,i)=>`<option value="${esc(x.id)}"${i===1?' selected':''}>${esc(x.name)}</option>`).join('')}</select><button class="cta" type="submit">إضافة المباراة</button></form>`;
    } else if(!admin)h+='<p class="muted">لم تبدأ البطولة بعد. ستظهر المباريات والترتيب بعد بدئها.</p>';
    host.innerHTML=h;
    const commit=async fn=>{fn();const err=await saveT(t);if(err){toast(err);await renderTournaments();return;}renderTView();};
    const addTeam=name=>{name=String(name||'').trim().slice(0,40);if(!name)return 'اكتب اسم الفريق.';if(t.teams.some(x=>normName(x.name)===normName(name)))return 'هذا الفريق مضاف بالفعل.';if(t.teams.length>=64)return 'الحد الأقصى 64 فريقًا.';t.teams.push({id:uid(),name});return null;};
    host.onclick=async e=>{const q=s=>e.target.closest(s);
      if(q('[data-t-back]')){openTid=null;tEditing=false;await renderTournaments();go('tournaments');return;}
      if(q('[data-t-team]')){openTeam(q('[data-t-team]').dataset.tTeam);return;}
      if(!isAdmin())return;
      if(q('[data-t-edit]')){tEditing=true;renderTView();return;}
      if(q('[data-t-cancel]')){tEditing=false;renderTView();return;}
      if(q('[data-t-del]')){if(!await uiConfirm('حذف البطولة وجميع مبارياتها نهائيًا؟'))return;
        if(sb){const {error}=await sb.from('tournaments').delete().eq('id',t.id);if(error){toast('تعذر الحذف: '+error.message);return;}}
        else{localTournaments=localTournaments.filter(x=>x.id!==t.id);putLocal(localKey,localTournaments);}
        openTid=null;await renderTournaments();go('tournaments');return;}
      if(q('[data-t-rm]')&&reg){const id=q('[data-t-rm]').dataset.tRm;await commit(()=>{t.teams=t.teams.filter(x=>x.id!==id);});return;}
      if(q('[data-t-addcat]')&&reg){const c=(teamsCache||[]).find(x=>x.id===$('#tCat').value);if(!c){toast('اختر فريقًا من القائمة أولًا.');return;}let er=null;await commit(()=>{er=addTeam(c.name);});if(er)toast(er);return;}
      if(q('[data-t-addall]')&&reg){const used=new Set(t.teams.map(x=>normName(x.name)));await commit(()=>{(teamsCache||[]).filter(c=>!used.has(normName(c.name))).forEach(c=>addTeam(c.name));});return;}
      if(q('[data-t-start]')&&reg){let er=null;await commit(()=>{try{generate(t);}catch(x){er=x.message;}});if(er)toast(er);return;}
      if(q('[data-t-reopen]')){if(!await uiConfirm('سيتم حذف كل المباريات والنتائج وإعادة فتح التسجيل. متابعة؟'))return;await commit(()=>{t.status='registration';t.matches=[];t.groups=[];t.rounds=[];delete t.champion;});return;}
      if(q('[data-t-delm]')){if(!await uiConfirm('حذف هذه المباراة؟'))return;const id=q('[data-t-delm]').dataset.tDelm;await commit(()=>{t.matches=t.matches.filter(x=>x.id!==id);recompute(t);});return;}
      const addSc=q('[data-scorer-add]');if(addSc){const m=t.matches.find(x=>x.id===addSc.dataset.scorerAdd);if(m)openScorerDialog(t,m,null);return;}
      const editSc=q('[data-scorer-edit]');if(editSc){const m=t.matches.find(x=>x.id===editSc.dataset.scorerEdit),x=m?.scorers?.find(z=>z.id===editSc.dataset.scorerId);if(m&&x)openScorerDialog(t,m,x);return;}
      const sv=q('[data-t-save]');if(sv){
        const m=t.matches.find(x=>x.id===sv.dataset.tSave);if(!m)return;
        const ia=host.querySelector(`[data-sc="a"][data-m="${CSS.escape(m.id)}"]`),ib=host.querySelector(`[data-sc="b"][data-m="${CSS.escape(m.id)}"]`);
        const sa=Number(ia.value),sb2=Number(ib.value);
        if(ia.value===''||ib.value===''||!Number.isInteger(sa)||!Number.isInteger(sb2)||sa<0||sb2<0||sa>99||sb2>99){toast('أدخل نتيجتين صحيحتين (أرقام من 0 إلى 99).');return;}
        const knock=!m.group&&t.format!=='league';
        if(knock&&sa===sb2){toast('لا يوجد تعادل في الأدوار الإقصائية، حدّد فائزًا.');return;}
        const had=m.sa!=null,newWinner=sa>sb2?m.a:sb2>sa?m.b:null,later=laterMatches(t,m);
        const changes=had&&later.length&&(m.group||newWinner!==m.winner);
        if(changes&&later.some(x=>x.sa!=null)&&!await uiConfirm('تعديل هذه النتيجة سيحذف الأدوار التالية ونتائجها ويعيد توليدها. متابعة؟'))return;
        await commit(()=>{m.sa=sa;m.sb=sb2;m.winner=newWinner;if(changes)dropLater(t,m);recompute(t);});
      }
    };
    host.onchange=async e=>{const inp=e.target.closest('[data-t-rename]');if(!inp||!isAdmin()||!reg)return;const tm=t.teams.find(x=>x.id===inp.dataset.tRename),v=inp.value.trim().slice(0,40);
      if(!tm)return;if(!v||t.teams.some(x=>x!==tm&&normName(x.name)===normName(v))){toast(v?'يوجد فريق بنفس الاسم.':'اسم الفريق لا يمكن أن يكون فارغًا.');inp.value=tm.name;return;}
      await commit(()=>{tm.name=v;});};
    host.onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const f=e.target;
      if(f.id==='tQuick'&&reg){let er=null;await commit(()=>{er=addTeam(new FormData(f).get('name'));});if(er)toast(er);return;}
      if(f.id==='tEditForm'){const fd=new FormData(f),name=String(fd.get('name')).trim();if(name.length<2){msg('#tEditMsg','اكتب اسم البطولة (حرفان على الأقل).');return;}tEditing=false;await commit(()=>{t.name=name.slice(0,80);t.sport=String(fd.get('sport'));if(fd.get('qualifiers')!==null&&reg)t.qualifiers=Math.min(4,Math.max(1,Number(fd.get('qualifiers'))||2));});return;}
      if(f.id==='tMatchForm'){const fd=new FormData(f),a=fd.get('a'),b=fd.get('b');if(!a||!b||a===b){toast('اختر فريقين مختلفين.');return;}await commit(()=>{t.matches.push({id:uid(),round:'الدوري',a,b,sa:null,sb:null,winner:null});recompute(t);});}
    };
  }
  async function loadTeamCatalog(){
    if(sb){const {data,error}=await sb.from('team_catalog').select('*').order('name');if(!error&&data)return data;}
    return localTeams;
  }
  // ===== الفرق: قائمة + صفحة كاملة لكل فريق بكل لاعبيه =====
  let teamsCache=[],openTeamId=null,teamEditing=false;
  const parsePlayers=txt=>[...new Set(String(txt||'').split(/[\n,،]+/).map(x=>x.trim().slice(0,40)).filter(Boolean))].slice(0,60);
  const playersOf=t=>Array.isArray(t.players)?t.players:parsePlayers(t.players);
  const initial=n=>{const c=[...String(n).trim()][0];return c||'؟';};
  const teamFields=(t={})=>`<input class="plain-field" name="name" required maxlength="80" placeholder="اسم الفريق/النادي" value="${esc(t.name||'')}" aria-label="اسم الفريق"><input class="plain-field" name="sport" maxlength="60" placeholder="اللعبة أو الرياضة" value="${esc(t.sport||'')}" aria-label="الرياضة"><input class="plain-field" name="club" maxlength="80" placeholder="الكلية/القسم/الدفعة" value="${esc(t.club||'')}" aria-label="الكلية أو الدفعة"><div class="logo-pick"><span class="tc-badge big logo-prev">${avatarInner(t.name,safeLogo(t.logo))}</span><div class="logo-actions"><label class="chip file-btn">اختيار شعار الفريق<input class="vh" type="file" name="logoFile" accept="image/*"></label><button type="button" class="link" data-logo-clear>إزالة الشعار</button><input type="hidden" name="logo" value="${esc(safeLogo(t.logo))}"></div></div><label class="muted">اللاعبون — كل لاعب في سطر</label><textarea class="plain-field" name="players" rows="8" placeholder="محمد أحمد\nخالد علي\nسعيد حسن">${esc(playersOf(t).join('\n'))}</textarea><textarea class="plain-field" name="details" rows="3" maxlength="1500" placeholder="تفاصيل الفريق، الإنجازات، القائد...">${esc(t.details||'')}</textarea>`;
  async function saveTeam(id,fd){
    const patch={name:String(fd.get('name')).trim(),sport:String(fd.get('sport')||'').trim(),club:String(fd.get('club')||'').trim(),players:parsePlayers(fd.get('players')),details:String(fd.get('details')||'').trim(),logo:safeLogo(fd.get('logo'))};
    if(!patch.name)return 'اكتب اسم الفريق.';
    if(sb){const {error}=id?await sb.from('team_catalog').update(patch).eq('id',id):await sb.from('team_catalog').insert({id:uid(),...patch});if(error)return /logo/i.test(error.message)?'أضف عمود الشعار في قاعدة البيانات: شغّل آخر جزء في supabase_schema.sql ثم أعد المحاولة.':'تعذر الحفظ: '+error.message;}
    else if(id){localTeams=localTeams.map(x=>x.id===id?{...x,...patch}:x);putLocal(teamCatalogKey,localTeams);}
    else{localTeams.push({id:uid(),...patch});putLocal(teamCatalogKey,localTeams);}
    return null;
  }
  async function renderTeams(){
    const host=$('#teamsApp');if(!host)return;const teams=teamsCache=await loadTeamCatalog();let html='';
    if(isAdmin())html+=`<div class="panel-card"><h3>إضافة فريق أو نادٍ</h3><form id="teamForm" class="form-grid">${teamFields()}<button class="cta" type="submit">حفظ الفريق</button><p id="teamMsg" class="err" role="alert"></p></form></div>`;
    html+=`<p class="note">إجمالي الفرق المسجلة: ${teams.length}</p>`;
    if(!teams.length)html+='<div class="panel-card"><p class="muted">لا توجد فرق مضافة حتى الآن.</p></div>';
    html+=`<div class="team-grid">${teams.map(t=>{const pl=playersOf(t);return `<article class="panel-card team-card team-open" role="button" tabindex="0" data-team-open="${esc(t.id)}">${avatar(t.name,t.logo)}<div class="tc-body"><h3>${esc(t.name)}</h3><p class="muted">${esc(t.sport||'اللعبة غير محددة')} · ${esc(t.club||'—')}</p><p class="tc-count">${pl.length} لاعب${pl.length?' · '+esc(pl.slice(0,2).join('، '))+(pl.length>2?'…':''):''}</p></div></article>`;}).join('')}</div>`;
    host.innerHTML=html;
    const form=$('#teamForm');if(form)wireLogo(form);if(form)form.onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const err=await saveTeam(null,new FormData(form));if(err){msg('#teamMsg',err);return;}renderTeams();};
    const open=el=>{if(el)openTeam(el.dataset.teamOpen);};
    host.onclick=e=>open(e.target.closest('[data-team-open]'));
    host.onkeydown=e=>{if(e.key==='Enter')open(e.target.closest('[data-team-open]'));};
    if(openTeamId)renderTeamView();
  }
  function openTeam(id){openTeamId=id;teamEditing=false;renderTeamView();if(typeof go==='function')go('teamview','sports');}
  function renderTeamView(){
    const host=$('#teamview');if(!host)return;const t=teamsCache.find(x=>x.id===openTeamId);
    if(!t){openTeamId=null;host.innerHTML='';return;}
    const admin=isAdmin(),pl=playersOf(t),back=typeof svg==='function'?svg('<path d="M9 6l6 6-6 6"/>',20):'';
    let body;
    if(admin&&teamEditing)body=`<form id="teamEditForm" class="form-grid panel-card"><h3>تعديل الفريق</h3>${teamFields(t)}<button class="cta" type="submit">حفظ التعديلات</button><button class="link" type="button" data-team-cancel>إلغاء</button><p id="teamEditMsg" class="err" role="alert"></p></form>`;
    else body=`<section class="panel-card"><h3>عن الفريق</h3><p>${esc(t.details||'لا توجد تفاصيل إضافية.')}</p></section><section class="panel-card"><h3>اللاعبون (${pl.length})</h3>${pl.length?`<ol class="players">${pl.map((n,i)=>`<li><span class="pn">${i+1}</span><span class="pi">${esc(initial(n))}</span><span class="pname">${esc(n)}</span></li>`).join('')}</ol>`:'<p class="muted">لم تُضف أسماء اللاعبين بعد.</p>'}</section>`+(admin?`<div class="action-row"><button class="cta" data-team-edit>تعديل الفريق</button><button class="danger" data-team-delete>حذف الفريق</button></div>`:'');
    host.innerHTML=`<button class="back-btn" data-team-back>${back}رجوع</button><div class="team-hero">${avatar(t.name,t.logo,'big')}<h2>${esc(t.name)}</h2><p>${esc(t.sport||'اللعبة غير محددة')} · ${esc(t.club||'—')}</p><span class="hero-count">${pl.length} لاعب</span></div>${body}`;
    host.onclick=async e=>{const q=s=>e.target.closest(s);
      if(q('[data-team-back]')){openTeamId=null;teamEditing=false;go('sports');return;}
      if(!isAdmin())return;
      if(q('[data-team-edit]')){teamEditing=true;renderTeamView();return;}
      if(q('[data-team-cancel]')){teamEditing=false;renderTeamView();return;}
      if(q('[data-team-delete]')){if(!await uiConfirm('حذف الفريق وجميع بياناته نهائيًا؟'))return;
        if(sb){const {error}=await sb.from('team_catalog').delete().eq('id',t.id);if(error){toast('تعذر الحذف: '+error.message);return;}}
        else{localTeams=localTeams.filter(x=>x.id!==t.id);putLocal(teamCatalogKey,localTeams);}
        openTeamId=null;await renderTeams();go('sports');}};
    const f=$('#teamEditForm');if(f)wireLogo(f);if(f)f.onsubmit=async e=>{e.preventDefault();const err=await saveTeam(t.id,new FormData(f));if(err){msg('#teamEditMsg',err);return;}teamEditing=false;await renderTeams();renderTeamView();};
  }
  function renderManagerTools(){
    const settings=$('#settings');if(!settings)return;if($('#managerTools')){$('#managerTools').hidden=!isRootAdmin();return;}const card=document.createElement('div');card.id='managerTools';card.className='panel-card';card.innerHTML='<h3>إدارة صلاحيات البطولات والفرق</h3><p class="muted">تظهر هذه الأدوات للمدير فقط. أدخل رقم جلوس طالب معتمد لمنحه أو سحب صلاحية مشرف.</p><input id="managerSeat" class="field" inputmode="numeric" maxlength="6" placeholder="رقم جلوس الطالب (6 أرقام)"><div class="action-row"><button id="grantManager" class="cta">منح صلاحية مشرف</button><button id="revokeManager" class="secondary">سحب الصلاحية</button></div><p id="managerMsg" class="muted"></p>';settings.appendChild(card);card.hidden=!isRootAdmin();
    $('#grantManager').onclick=()=>changeManager(true);$('#revokeManager').onclick=()=>changeManager(false);
  }
  async function changeManager(grant){if(!isRootAdmin()||!sb){msg('#managerMsg','هذه العملية تتطلب حساب المدير الأساسي وربط قاعدة البيانات.');return;}const seat=$('#managerSeat').value.trim();if(!/^\d{6}$/.test(seat)){msg('#managerMsg','أدخل رقم جلوس صحيحًا من 6 أرقام.');return;}const {data,error}=await sb.from('profiles').select('id,full_name,role,approved').eq('seat_number',seat).maybeSingle();if(error||!data){msg('#managerMsg','لم يُعثر على حساب بهذا الرقم. يجب أن يكون الطالب قد أنشأ حسابه أولًا.');return;}if(!data.approved){msg('#managerMsg','لا يمكن منح الصلاحية قبل اعتماد الحساب.');return;}if(data.role==='admin'){msg('#managerMsg','هذا الحساب مدير أساسي بالفعل.');return;}const {error:updateError}=await sb.from('profiles').update({role:grant?'team_leader':'student'}).eq('id',data.id);if(updateError){msg('#managerMsg','تعذر تحديث الصلاحية: '+updateError.message);return;}msg('#managerMsg',grant?`تم منح ${data.full_name} صلاحية التحكم في الفرق والبطولات والمباريات.`:`تم سحب صلاحية المشرف من ${data.full_name}.`,true);}

  // إدارة قائمة أرقام الجلوس للمدير من إعدادات النظام، مع تخزين محلي مؤقت فقط قبل الربط.
  function injectAdminSeats(){const settings=$('#settings');if(!settings)return;if($('#seatAdminCard')){$('#seatAdminCard').hidden=!isRootAdmin();return;}const card=document.createElement('div');card.id='seatAdminCard';card.className='panel-card';card.hidden=!isRootAdmin();card.innerHTML='<h3>قائمة أرقام الجلوس المعتمدة</h3><p class="muted">أدخل الأرقام، رقمًا في كل سطر. هذه القائمة المحلية للتجربة فقط؛ بعد ربط Supabase ستُحفظ القائمة في قاعدة البيانات الآمنة.</p><textarea id="seatNumbers" class="plain-field" rows="7" placeholder="123456\n234567"></textarea><button class="cta" id="saveSeats">حفظ القائمة</button><p id="seatMsg" class="muted"></p>';settings.appendChild(card);$('#seatNumbers').value=demoSeats.join('\n');$('#saveSeats').onclick=()=>{if(!isRootAdmin()){msg('#seatMsg','هذه الوظيفة متاحة للمدير بعد إعداد تسجيل الدخول الآمن.');return;}const arr=$('#seatNumbers').value.split(/\s+/).filter(Boolean);const bad=arr.filter(x=>!/^[0-9]{6}$/.test(x));if(bad.length){msg('#seatMsg','الأرقام يجب أن تتكون من 6 أرقام بالضبط.');return;}demoSeats=[...new Set(arr)];putLocal(seatKey,demoSeats);if(sb&&isAdmin()){sb.rpc('admin_import_seat_numbers',{p_numbers:demoSeats}).then(({error})=>msg('#seatMsg',error?'تعذر حفظ القائمة في قاعدة البيانات: '+error.message:`تم استيراد ${demoSeats.length} رقم جلوس إلى قاعدة البيانات.`,!error));}else msg('#seatMsg',`تم حفظ ${demoSeats.length} رقمًا في هذا المتصفح فقط. اربط Supabase لحفظها بأمان ومشاركتها.`,true);};}


  // ===== ترتيب الفرق: يتحكم به المدير والمشرفون (الفرق، النقاط، الترتيب) =====
  const rankKey='sawaed_standings_v1';
  let localRank=getLocal(rankKey,[]);
  let rankRows=[],rankEdit=false;
  const curRankSport=()=>'overall'; // ترتيب إجمالي واحد لكل الفرق (المنتخبات/الدفعات)
  async function loadRank(){
    if(sb){const {data,error}=await sb.from('team_standings').select('*').order('pos',{ascending:true});if(!error&&data)return data.map(r=>({id:r.id,sport:r.sport,name:r.name,points:r.points,pos:r.pos}));}
    return localRank;
  }
  const rankOf=sp=>rankRows.filter(r=>r.sport===sp).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ar')); // ترتيب تلقائي حسب النقاط
  const renumber=list=>list.forEach((r,i)=>r.pos=i);
  const autoSort=sp=>{const l=rankOf(sp).sort((a,b)=>b.points-a.points||a.pos-b.pos);renumber(l);};
  async function persistRank(rows,delId){
    if(sb){try{
      if(delId){const {error}=await sb.from('team_standings').delete().eq('id',delId);if(error)throw error;}
      if(rows.length){const {error}=await sb.from('team_standings').upsert(rows.map(r=>({id:r.id,sport:r.sport,name:r.name,points:r.points,pos:r.pos,updated_by:currentUser?.id})));if(error)throw error;}
    }catch(err){toast('تعذر الحفظ: '+err.message);return false;}}
    else putLocal(rankKey,localRank);
    return true;
  }
  async function renderRank(){
    const list=$('#rank'),adm=$('#rankAdmin'),card=$('#rankCard');if(!list)return;
    rankRows=await loadRank();const sp=curRankSport(),admin=isAdmin(),rows=rankOf(sp);
    if(!admin)rankEdit=false;
    list.innerHTML=!rows.length?'<li class="rank-empty">لا توجد فرق في الترتيب حتى الآن.</li>':rows.map((r,i)=> rankEdit
      ?`<li class="rk-edit" data-id="${esc(r.id)}"><span class="n">${i+1}</span><input class="nin" data-rk="name" value="${esc(r.name)}" maxlength="40" aria-label="اسم الفريق"><input class="nin rk-pts" data-rk="points" type="number" inputmode="numeric" min="0" max="9999" value="${r.points}" aria-label="النقاط"><button data-rk-del aria-label="حذف الفريق">✕</button></li>`
      :`<li><span class="n">${i+1}</span><span class="nm">${esc(r.name)}</span><span class="pt">${r.points} نقطة</span></li>`).join('');
    if(adm){
      if(!admin){adm.innerHTML='';}
      else adm.innerHTML=`<button class="cta rk-toggle" data-rk-toggle>${rankEdit?'تم':'تعديل الترتيب'}</button>`+(rankEdit?`<form class="rk-add" id="rankAddForm"><input class="nin" name="name" required maxlength="40" placeholder="اسم فريق جديد" aria-label="اسم الفريق"><input class="nin rk-pts" name="points" type="number" inputmode="numeric" min="0" max="9999" value="0" aria-label="النقاط"><button class="chip" type="submit">إضافة</button></form><p class="muted">الترتيب تلقائي: يرتّب الفرق حسب النقاط، فاكتب النقاط وسيتغير الترتيب مباشرة.</p>`:'');
    }
    if(card&&!card.dataset.bound){card.dataset.bound='1';
      card.addEventListener('click',async e=>{const q=s=>e.target.closest(s);
        if(!isAdmin())return;
        if(q('[data-rk-toggle]')){rankEdit=!rankEdit;return renderRank();}
        const li=q('li[data-id]');if(!li)return;const sp=curRankSport(),l=rankOf(sp),i=l.findIndex(r=>r.id===li.dataset.id);if(i<0)return;
        if(q('[data-rk-del]')){if(!await uiConfirm('حذف "'+l[i].name+'" من الترتيب؟'))return;const [gone]=l.splice(i,1);rankRows=rankRows.filter(r=>r.id!==gone.id);if(!sb)localRank=rankRows;renumber(l);if(await persistRank(l,gone.id))renderRank();return;}
      });
      card.addEventListener('change',async e=>{if(!isAdmin())return;const inp=e.target.closest('[data-rk]'),li=e.target.closest('li[data-id]');if(!inp||!li)return;
        const sp=curRankSport(),row=rankRows.find(r=>r.id===li.dataset.id);if(!row)return;
        if(inp.dataset.rk==='name'){const v=inp.value.trim();if(!v){inp.value=row.name;return;}row.name=v.slice(0,40);if(await persistRank([row]))renderRank();}
        else{row.points=Math.min(9999,Math.max(0,Math.floor(Number(inp.value))||0));if(await persistRank([row]))renderRank();}
      });
      card.addEventListener('submit',async e=>{const f=e.target.closest('#rankAddForm');if(!f)return;e.preventDefault();if(!isAdmin())return;
        const fd=new FormData(f),name=String(fd.get('name')).trim().slice(0,40);if(!name)return;const sp=curRankSport();
        const pts=Math.min(9999,Math.max(0,Math.floor(Number(fd.get('points')))||0));
        if(rankOf(sp).some(r=>r.name===name)){toast('هذا الفريق موجود بالفعل في الترتيب.');return;}
        rankRows.push({id:uid(),sport:sp,name,points:pts,pos:rankOf(sp).length});if(!sb)localRank=rankRows;
        if(await persistRank(rankOf(sp)))renderRank();});
    }
  }
  // ===== المباريات: لا تظهر إلا ما يضيفه المدير/المشرف =====
  const fixtureKey='sawaed_fixtures_v1';
  let localFixtures=getLocal(fixtureKey,[]);
  let fixtures=[];
  const pad2=n=>String(n).padStart(2,'0');
  const fmtDate=d=>`${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;
  const fmtTime=d=>{const h=d.getHours();return `${h%12||12}:${pad2(d.getMinutes())} ${h<12?'ص':'م'}`;};
  const sportIcon=name=>{try{return (SPORTS.find(x=>x.name===name)||{}).icon||'trophy';}catch{return 'trophy';}};
  async function loadFixtures(){
    if(sb){const [{data,error},{data:scorers,error:scError}]=await Promise.all([sb.from('fixtures').select('*').order('scheduled_at',{ascending:true}),sb.from('fixture_scorers').select('*').order('created_at',{ascending:true})]);if(!error&&!scError)return (data||[]).map(r=>({id:r.id,sport:r.sport,a:r.team_a,b:r.team_b,at:r.scheduled_at,venue:r.venue||'',status:r.status||'upcoming',scorers:(scorers||[]).filter(x=>x.fixture_id===r.id)}));if(error)console.warn(error);if(scError)console.warn(scError);}
    return localFixtures;
  }
  // القادمة أولًا (الأقرب فالأبعد) ثم المنتهية (الأحدث فالأقدم)
  function sortFixtures(list){const now=Date.now();const up=list.filter(f=>+new Date(f.at)>=now).sort((x,y)=>new Date(x.at)-new Date(y.at));const past=list.filter(f=>+new Date(f.at)<now).sort((x,y)=>new Date(y.at)-new Date(x.at));return [...up,...past];}
  const FX_STATUS={upcoming:'لم تبدأ بعد',live:'جارية',finished:'انتهت'};
  function fixtureCard(f,admin){
    const d=new Date(f.at),ic=typeof svg==='function'?svg(ICON[sportIcon(f.sport)],30):'',cal=typeof svg==='function'?svg(ICON.calendar,14):'',st=f.status||'upcoming';
    const scorerList=(f.scorers||[]).map(x=>`<li>${esc(x.player_name)} — ${x.team_side==='a'?esc(f.a):esc(f.b)}${x.minute!=null?' · '+x.minute+'′':''}</li>`).join('');
    return `<article class="ev fixture-card"><div class="pic">${ic}</div><div style="flex:1;min-width:0"><h4>${esc(f.a)} × ${esc(f.b)}</h4><p>${esc(f.sport)}${f.venue?' · '+esc(f.venue):''}</p><time>${cal}${fmtDate(d)} · ${fmtTime(d)}</time><div class="fx-status">${admin?`<select class="status-select status-${st}" data-fx-status="${esc(f.id)}" aria-label="حالة المباراة"><option value="upcoming"${st==='upcoming'?' selected':''}>لم تبدأ بعد</option><option value="live"${st==='live'?' selected':''}>جارية</option><option value="finished"${st==='finished'?' selected':''}>انتهت</option></select>`:`<span class="status-badge status-${st}">${FX_STATUS[st]||'لم تبدأ بعد'}</span>`}</div>${scorerList?`<ul class="fixture-scorers">${scorerList}</ul>`:''}${admin?`<form class="fixture-scorer-form" data-fx-scorer="${esc(f.id)}"><input class="plain-field" name="player_name" required maxlength="50" placeholder="اسم مسجل الهدف"><select class="plain-field" name="team_side"><option value="a">${esc(f.a)}</option><option value="b">${esc(f.b)}</option></select><input class="plain-field" name="minute" type="number" min="0" max="130" placeholder="الدقيقة"><button class="chip" type="submit">إضافة هدف</button></form>`:''}</div>${admin?`<button class="danger fx-del" data-fx-del="${esc(f.id)}" aria-label="حذف المباراة">حذف</button>`:''}</article>`;
  }
  async function renderFixtures(){
    const evHost=$('#events'),listHost=$('#matchList'),adminHost=$('#fixtureAdmin');
    fixtures=sortFixtures(await loadFixtures());const admin=isAdmin();
    const empty='<div class="panel-card"><p class="muted">لا توجد مباريات مضافة حتى الآن.</p></div>';
    window.setNextMatch?.(fixtures.find(f=>+new Date(f.at)>=Date.now())||null);
    if(evHost)evHost.innerHTML=fixtures.length?fixtures.slice(0,2).map(f=>fixtureCard(f,false)).join(''):empty;
    if(listHost){listHost.innerHTML=fixtures.length?fixtures.map(f=>fixtureCard(f,admin)).join(''):empty;
      listHost.onclick=async e=>{const del=e.target.closest('[data-fx-del]');if(!del||!isAdmin())return;if(!await uiConfirm('حذف هذه المباراة؟'))return;const id=del.dataset.fxDel;
        if(sb){const {error}=await sb.from('fixtures').delete().eq('id',id);if(error){toast('تعذر الحذف: '+error.message);return;}}
        localFixtures=localFixtures.filter(x=>x.id!==id);putLocal(fixtureKey,localFixtures);renderFixtures();};
      listHost.onchange=async e=>{const sel=e.target.closest('[data-fx-status]');if(!sel||!isAdmin())return;const id=sel.dataset.fxStatus,status=sel.value;if(!['upcoming','live','finished'].includes(status))return;
        if(sb){const {error}=await sb.from('fixtures').update({status}).eq('id',id);if(error){toast('تعذر تحديث الحالة: '+error.message);renderFixtures();return;}}
        const row=localFixtures.find(x=>x.id===id);if(row)row.status=status;putLocal(fixtureKey,localFixtures);const f=fixtures.find(x=>x.id===id);if(f)f.status=status;renderFixtures();};
      listHost.onsubmit=async e=>{const form=e.target.closest('[data-fx-scorer]');if(!form||!isAdmin())return;e.preventDefault();const fd=new FormData(form),name=String(fd.get('player_name')).trim(),side=String(fd.get('team_side')),minute=fd.get('minute')===''?null:Number(fd.get('minute'));if(!name){toast('اكتب اسم اللاعب.');return;}const row={id:uid(),fixture_id:form.dataset.fxScorer,player_name:name,team_side:side,minute};if(sb){const {error}=await sb.from('fixture_scorers').insert(row);if(error){toast('تعذر حفظ الهدف: '+error.message);return;}}else{const f=localFixtures.find(x=>x.id===row.fixture_id);if(f){f.scorers=f.scorers||[];f.scorers.push(row);putLocal(fixtureKey,localFixtures);}}toast('تم تسجيل الهدف.');renderFixtures();};
    }
    if(adminHost){
      if(!admin){adminHost.innerHTML='';return;}
      if(!$('#fixtureForm')){
        adminHost.innerHTML=`<div class="panel-card"><h3>إضافة مباراة</h3><form id="fixtureForm" class="form-grid"><select name="sport" aria-label="الرياضة">${sports.map(x=>`<option>${x}</option>`).join('')}</select><input class="plain-field" name="a" required maxlength="40" placeholder="الفريق الأول"><input class="plain-field" name="b" required maxlength="40" placeholder="الفريق الثاني"><input class="plain-field" name="at" type="datetime-local" required aria-label="موعد المباراة"><input class="plain-field" name="venue" maxlength="60" placeholder="الملعب (اختياري)"><button class="cta" type="submit">إضافة المباراة</button><p id="fixtureMsg" class="err" role="alert"></p></form></div>`;
        $('#fixtureForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const fd=new FormData(e.target),a=String(fd.get('a')).trim(),b=String(fd.get('b')).trim(),when=new Date(fd.get('at'));
          if(!a||!b||isNaN(+when)){msg('#fixtureMsg','أكمل بيانات المباراة.');return;}
          if(a===b){msg('#fixtureMsg','اختر فريقين مختلفين.');return;}
          const row={id:uid(),sport:String(fd.get('sport')),team_a:a,team_b:b,scheduled_at:when.toISOString(),venue:String(fd.get('venue')||'').trim(),status:'upcoming'};
          if(sb){const {error}=await sb.from('fixtures').insert({...row,created_by:currentUser?.id});if(error){msg('#fixtureMsg','تعذر الحفظ: '+error.message);return;}}
          else{localFixtures.push({id:row.id,sport:row.sport,a,b,at:row.scheduled_at,venue:row.venue,status:'upcoming',scorers:[]});putLocal(fixtureKey,localFixtures);}
          e.target.reset();msg('#fixtureMsg','تمت إضافة المباراة.',true);renderFixtures();};
      }
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    window.__sawaedAdminDemo=false;
    document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));
    $('#authForm')?.addEventListener('submit',authSubmit);setMode('login');injectAdminSeats();renderManagerTools();
    if(sb)sb.auth.onAuthStateChange(()=>setTimeout(refreshUser,0));
    refreshUser();
    const oldGo=window.go;if(typeof oldGo==='function'){/* existing navigation remains in charge */}
  });
  // expose a safe refresh hook for the existing navigation and admin toggle
  window.SawaedBackend={renderFixtures,renderTournaments,renderRank,getClient:()=>sb,getUser:()=>currentUser,refresh:()=>{window.__sawaedAdminDemo=false;injectAdminSeats();renderTournaments();renderTeams();renderManagerTools();renderFixtures();renderRank();},isConfigured:()=>!!sb,isManager:isAdmin};
})();
