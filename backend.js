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
    injectAdminSeats();injectAdminLink();renderAuthState();renderTournaments();renderTeams();renderManagerTools();renderFixtures();renderRank();
  }
  // شارة «حساب موثق» تظهر للمالك والمشرفين فقط
  function accountPill(){const staff=profile&&['admin','team_leader'].includes(profile.role)&&profile.approved;if(staff)return `<p class="status-pill verified">✓ حساب موثق · ${profile.role==='admin'?'المالك':'مشرف'}</p>`;return '';}
  function renderAuthState(){
    const host=$('#authApp'); if(!host)return;
    if(currentUser){host.innerHTML=`<div class="panel-card"><h3>مرحبًا ${esc(profile?.full_name||currentUser.email)}</h3><p class="muted">البريد: ${esc(currentUser.email)}</p><p class="muted">رقم الجلوس: ${esc(profile?.seat_number||'—')}</p>${accountPill()}<button class="cta" id="signOutBtn">تسجيل الخروج</button></div>`;$('#signOutBtn').onclick=async()=>{await sb.auth.signOut();currentUser=null;profile=null;location.reload();};return;}
    // Keep the signup/login form from index.html visible.
    const form=$('#authForm'); if(form){form.hidden=false;}
  }
  async function authSubmit(e){e.preventDefault();if(!sb){msg('#authError','لم يتم ربط Supabase بعد. اتبع دليل SUPABASE_SETUP_AR.md ثم أعد تحميل الصفحة.');return;}
    const email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;
    if(mode==='signup'){
      const name=$('#authName').value.trim(),seat=$('#authSeat').value.trim();
      if(!/^\d{6}$/.test(seat)){msg('#authError','رقم الجلوس يجب أن يتكون من 6 أرقام بالضبط.');return;}
      const {data,error}=await sb.rpc('check_seat_available',{p_seat_number:seat});
      if(error||!data){msg('#authError','رقم الجلوس غير معتمد أو مستخدم مسبقًا. راجع المالك.');return;}
      if(name.length<2){msg('#authError','يرجى إدخال الاسم الكامل.');return;}
      const btn=$('#authSubmit');btn.disabled=true;
      try{
        const {data:signup,error:signErr}=await sb.auth.signUp({email,password,options:{data:{full_name:name,seat_number:seat}}});
        if(signErr){
          const m=signErr.message||'';
          msg('#authError',/already registered|already been registered/i.test(m)?'هذا البريد مسجّل مسبقًا. سجّل الدخول بدل إنشاء حساب جديد.':/database error|seat|جلوس/i.test(m)?'رقم الجلوس غير معتمد أو مستخدم مسبقًا. راجع المالك.':/password/i.test(m)?'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.':m);
          return;
        }
        if(signup?.user && Array.isArray(signup.user.identities) && !signup.user.identities.length){msg('#authError','هذا البريد مسجّل مسبقًا. سجّل الدخول بدل إنشاء حساب جديد.');return;}
        if(!signup?.session){
          const {error:inErr}=await sb.auth.signInWithPassword({email,password});
          if(inErr){msg('#authError','تم إنشاء الحساب لكن تعذر الدخول تلقائيًا: يبدو أن تأكيد البريد ما زال مفعّلًا في Supabase (Authentication ← Providers ← Email ← عطّل Confirm email).');return;}
        }
        await refreshUser();toast('تم إنشاء حسابك وتفعيله ✓');
      }finally{btn.disabled=false;}
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

  // ===== حالة المباراة والمسجلون (مشتركة بين مباريات البطولات والمباريات العامة) =====
  const ST_NAMES={upcoming:'لم تبدأ بعد',live:'جارية',finished:'انتهت'};
  const ST_ORDER=['upcoming','live','finished'];
  const normStatus=s=>ST_NAMES[s]?s:'upcoming';
  const stPill=s=>`<span class="st-pill ${normStatus(s)}">${ST_NAMES[normStatus(s)]}</span>`;
  const stButtons=(s,id)=>`<div class="fx-ctl" role="group" aria-label="حالة المباراة">${ST_ORDER.map(k=>`<button type="button" class="st-btn${k===normStatus(s)?' on':''}" data-stfor="${esc(id)}" data-st="${k}">${ST_NAMES[k]}</button>`).join('')}</div>`;
  const EV_NAMES={goal:'هدف',assist:'صناعة هدف'};
  const minTxt=m=>m==null||m===''?'':` · د${m}`;
  let evEditing=null; // {mid,eid} سجل قيد التعديل
  function detailsHtml(m,names,admin,suggest){
    const evs=[...(m.events||[])].sort((x,y)=>(x.minute??999)-(y.minute??999));
    const ed=evEditing&&evEditing.mid===m.id?(m.events||[]).find(e=>e.id===evEditing.eid):null,cur=ed||{side:'a',type:'goal',name:'',minute:null};
    const rows=evs.length?`<ul class="ev-list">${evs.map(e=>`<li><span class="ev-type ${e.type}">${EV_NAMES[e.type]||''}</span><b>${esc(e.name)}</b><small>${esc(names[e.side==='b'?1:0])}${minTxt(e.minute)}</small>${admin?`<span class="ev-act"><button type="button" class="link" data-evedit="${esc(e.id)}">تعديل</button><button type="button" class="link bad" data-evdel="${esc(e.id)}">حذف</button></span>`:''}</li>`).join('')}</ul>`:'<p class="muted">لم يُسجَّل أي هدف أو صناعة بعد.</p>';
    const dl=`dl_${String(m.id).replace(/[^a-zA-Z0-9_-]/g,'')}`;
    const form=admin?`<form class="ev-form form-grid" data-evform><input type="hidden" name="eid" value="${esc(ed?.id||'')}"><select name="type" aria-label="النوع"><option value="goal"${cur.type==='goal'?' selected':''}>هدف</option><option value="assist"${cur.type==='assist'?' selected':''}>صناعة هدف</option></select><select name="side" aria-label="الفريق"><option value="a"${cur.side!=='b'?' selected':''}>${esc(names[0])}</option><option value="b"${cur.side==='b'?' selected':''}>${esc(names[1])}</option></select><input class="plain-field" name="name" required maxlength="60" list="${dl}" placeholder="اسم اللاعب" value="${esc(cur.name||'')}" aria-label="اسم اللاعب"><datalist id="${dl}">${[...new Set(suggest||[])].map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist><input class="plain-field" name="minute" type="number" min="0" max="150" inputmode="numeric" placeholder="الدقيقة (اختياري)" value="${cur.minute??''}" aria-label="الدقيقة"><div class="action-row"><button class="cta" type="submit">${ed?'حفظ التعديل':'إضافة تسجيل'}</button>${ed?'<button type="button" class="link" data-evcancel>إلغاء</button>':''}</div></form>`:'';
    return `<h4 class="rh">الأهداف والتمريرات الحاسمة</h4>${rows}${form}`;
  }
  function readEvent(form){
    const fd=new FormData(form),name=String(fd.get('name')||'').trim().slice(0,60),mi=fd.get('minute'),minute=mi===''||mi==null?null:Math.floor(Number(mi));
    if(!name)return {err:'اكتب اسم اللاعب.'};
    if(minute!=null&&!(minute>=0&&minute<=150))return {err:'الدقيقة من 0 إلى 150.'};
    return {ev:{id:String(fd.get('eid')||'')||uid(),side:fd.get('side')==='b'?'b':'a',type:fd.get('type')==='assist'?'assist':'goal',name,minute}};
  }
  const catalogPlayers=names=>names.flatMap(n=>{const c=(typeof teamsCache!=='undefined'&&teamsCache||[]).find(x=>String(x.name).trim().toLowerCase()===String(n).trim().toLowerCase());return c?playersOf(c):[];});

  // ===== البطولات: إنشاء ثم إضافة الفرق ثم البدء. الترتيب تلقائي حسب النقاط =====
  const FORMAT_NAMES={groups:'مجموعات ثم أدوار إقصائية',league:'دوري من دور واحد',knockout:'خروج المغلوب'};
  const STATUS_NAMES={registration:'التسجيل مفتوح',active:'جارية',completed:'مكتملة',cancelled:'موقوفة'};
  let tList=[],openTid=null,tEditing=false,openM=null;
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
    if(t.matches.length){r=await sb.from('matches').upsert(t.matches.map(m=>({id:m.id,tournament_id:t.id,round_name:m.round,group_name:m.group||null,team_a_id:m.a||null,team_b_id:m.b||null,score_a:m.sa??null,score_b:m.sb??null,winner_team_id:m.winner||null,status:normStatus(m.status)})));if(r.error)throw r.error;}
    const evs=t.matches.flatMap(m=>(m.events||[]).map(e=>({id:e.id,match_id:m.id,tournament_id:t.id,team_id:(e.side==='b'?m.b:m.a)||null,player_name:e.name,event_type:e.type,minute:e.minute??null,created_by:currentUser?.id})));
    const {data:oldEv,error:e3}=await sb.from('match_scorers').select('id').eq('tournament_id',t.id);if(e3)throw e3;
    const keepE=new Set(evs.map(x=>x.id)),delE=(oldEv||[]).filter(x=>!keepE.has(x.id)).map(x=>x.id);
    if(delE.length){r=await sb.from('match_scorers').delete().in('id',delE);if(r.error)throw r.error;}
    if(evs.length){r=await sb.from('match_scorers').upsert(evs);if(r.error)throw r.error;}
  }
  async function saveT(t){
    if(!sb){putLocal(localKey,localTournaments);return null;}
    if(!isAdmin())return 'ليست لديك صلاحية التعديل.';
    try{await persistTournament(t);return null;}catch(e){const m=e.message||String(e);return 'تعذر الحفظ: '+m+(/match_scorers|status|schema cache/i.test(m)?' — شغّل ملف SAWAED_UPDATE.sql في Supabase.':'');}
  }
  async function loadTournaments(){
    if(!sb)return localTournaments;
    const {data,error}=await sb.from('tournaments').select('*').order('created_at',{ascending:false});if(error)throw error;
    const [tm,mt,sc]=await Promise.all([sb.from('teams').select('*'),sb.from('matches').select('*'),sb.from('match_scorers').select('*')]);if(tm.error)throw tm.error;if(mt.error)throw mt.error;if(sc.error)console.warn('تعذر تحميل المسجلين:',sc.error.message);const scs=sc.error?[]:sc.data;
    const sortBy=(arr,order)=>{if(!Array.isArray(order))return arr;const ix=new Map(order.map((id,i)=>[id,i]));return [...arr].sort((a,b)=>(ix.has(a.id)?ix.get(a.id):1e9)-(ix.has(b.id)?ix.get(b.id):1e9));};
    return data.map(r=>{const c=r.config||{};return {id:r.id,name:r.name,sport:r.sport,format:r.format,status:r.status,qualifiers:c.qualifiers||2,groups:c.groups||[],rounds:c.rounds||[],champion:c.champion||undefined,
      teams:sortBy(tm.data.filter(x=>x.tournament_id===r.id).map(x=>({id:x.id,name:x.name})),c.teamOrder),
      matches:sortBy(mt.data.filter(x=>x.tournament_id===r.id).map(x=>({id:x.id,round:x.round_name,group:x.group_name||undefined,a:x.team_a_id,b:x.team_b_id,sa:x.score_a,sb:x.score_b,winner:x.winner_team_id,status:normStatus(x.status),events:scs.filter(s=>s.match_id===x.id).map(s=>({id:s.id,side:s.team_id&&s.team_id===x.team_b_id?'b':'a',name:s.player_name,type:s.event_type,minute:s.minute}))})),c.matchOrder)};});
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
  function openT(id){openTid=id;tEditing=false;openM=null;evEditing=null;renderTView();if(typeof go==='function')go('tview','tournaments');}
  const teamRow=(t,x,editable)=>{const L=logoByName(x.name);return `<li class="t-team">${avatar(x.name,L.logo)}${editable?`<input class="nin" data-t-rename="${esc(x.id)}" value="${esc(x.name)}" maxlength="40" aria-label="اسم الفريق"><button class="danger" data-t-rm="${esc(x.id)}" aria-label="إزالة الفريق">✕</button>`:(L.id?`<button class="link tname" data-t-team="${esc(L.id)}">${esc(x.name)}</button>`:`<span class="tname">${esc(x.name)}</span>`)}</li>`;};
  function standingsTable(t,teams,matches,title,qual){
    const rows=standings(teams,matches);
    return `${title?`<h4 class="rh">${esc(title)}</h4>`:''}<div class="tbl-wrap"><table class="data-table"><tr><th>#</th><th>الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th></tr>${rows.map((r,i)=>`<tr class="${qual&&i<qual?'qual':''}"><td>${i+1}</td><td class="tm">${avatar(r.name,logoByName(r.name).logo,'sm')}<span>${esc(r.name)}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table></div>`;
  }
  function matchCard(t,m,admin){
    const bye=!m.b,st=normStatus(m.status),open=openM===m.id,names=[tn(t,m.a),tn(t,m.b)],nEv=(m.events||[]).length;
    let h=`<div class="panel-card mcard"><div class="mrow"><span class="mtn">${esc(names[0])}</span><span class="ms">${bye?'—':(m.sa??'-')+' : '+(m.sb??'-')}</span><span class="mtn">${bye?'يتأهل مباشرة':esc(names[1])}</span></div>`;
    if(!bye)h+=`<div class="mstat">${stPill(st)}${nEv?`<small class="muted">${nEv} تسجيل</small>`:''}</div>`;
    if(admin&&!bye)h+=`<div class="action-row"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-sc="a" data-m="${esc(m.id)}" value="${m.sa??''}" aria-label="نتيجة ${esc(names[0])}"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-sc="b" data-m="${esc(m.id)}" value="${m.sb??''}" aria-label="نتيجة ${esc(names[1])}"><button data-t-save="${esc(m.id)}">حفظ النتيجة</button>${t.format==='league'?`<button class="danger" data-t-delm="${esc(m.id)}">حذف</button>`:''}</div>`;
    if(!bye)h+=`<div class="action-row"><button type="button" class="chip" data-det="${esc(m.id)}">${open?'إخفاء التفاصيل':'تفاصيل المباراة'}</button></div>`;
    if(open&&!bye)h+=`<div class="match-details" data-for="${esc(m.id)}">${admin?`<h4 class="rh">حالة المباراة</h4>${stButtons(st,m.id)}`:''}${detailsHtml(m,names,admin,catalogPlayers(names))}</div>`;
    return h+'</div>';
  }
  // قوائم الهدافين وصنّاع الأهداف: تُحسب تلقائيًا من تسجيلات تفاصيل المباريات
  function topAgg(t,type){
    const mp=new Map();
    t.matches.forEach(m=>(m.events||[]).filter(e=>e.type===type).forEach(e=>{const tid=e.side==='b'?m.b:m.a,key=normName(e.name)+'|'+tid,r=mp.get(key)||{name:e.name,tid,team:tn(t,tid),n:0};r.n++;mp.set(key,r);}));
    return [...mp.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,'ar'));
  }
  function topTable(t,type,title,admin){
    const rows=topAgg(t,type).slice(0,10);
    if(!rows.length)return `<h4 class="rh">${title}</h4><p class="muted">لا يوجد مسجلون بعد.</p>`;
    return `<h4 class="rh">${title}</h4><div class="tbl-wrap"><table class="data-table"><tr><th>#</th><th>اللاعب</th><th>الفريق</th><th>العدد</th></tr>${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="tm"><span>${esc(r.name)}</span>${admin?`<button type="button" class="link pl-ren" data-plname="${esc(r.name)}" data-plteam="${esc(r.tid||'')}" aria-label="تعديل اسم اللاعب">تعديل</button>`:''}</td><td>${esc(r.team)}</td><td><b>${r.n}</b></td></tr>`).join('')}</table></div>`;
  }
  const topListsHtml=(t,admin)=>`<h3 class="rh">الهدافون وصنّاع الأهداف</h3>${topTable(t,'goal','الهدافون',admin)}${topTable(t,'assist','صنّاع الأهداف',admin)}<p class="muted">تُحسب القائمتان تلقائيًا من تسجيلات «تفاصيل المباراة»${admin?'. يمكنك تصحيح اسم لاعب من هنا (يتغير في كل تسجيلاته) أو تعديل أي تسجيل من تفاصيل مباراته.':'.'}</p>`;
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
      h+=topListsHtml(t,admin);
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
      const dt=q('[data-det]');if(dt){const id=dt.dataset.det;openM=openM===id?null:id;evEditing=null;renderTView();return;}
      if(!isAdmin())return;
      const mById=id=>t.matches.find(x=>x.id===id);
      const stb=q('[data-stfor]');if(stb){const m=mById(stb.dataset.stfor);if(!m)return;const ns=normStatus(stb.dataset.st);await commit(()=>{m.status=ns;});if(ns==='finished'&&m.sa==null)toast('لن تدخل المباراة في الترتيب حتى تحفظ نتيجتها.');return;}
      const ee=q('[data-evedit]');if(ee){evEditing={mid:q('[data-for]').dataset.for,eid:ee.dataset.evedit};renderTView();return;}
      const ed=q('[data-evdel]');if(ed){const m=mById(q('[data-for]').dataset.for);if(!m||!await uiConfirm('حذف هذا التسجيل؟'))return;await commit(()=>{m.events=(m.events||[]).filter(x=>x.id!==ed.dataset.evdel);});return;}
      if(q('[data-evcancel]')){evEditing=null;renderTView();return;}
      const pr=q('[data-plname]');if(pr){const old=pr.dataset.plname,tid=pr.dataset.plteam,nv=await window.SawaedUI.prompt('اكتب الاسم الصحيح للاعب',old);if(nv==null)return;const name=nv.trim().slice(0,60);if(!name){toast('الاسم لا يمكن أن يكون فارغًا.');return;}
        await commit(()=>{t.matches.forEach(m=>(m.events||[]).forEach(e=>{if(normName(e.name)===normName(old)&&((e.side==='b'?m.b:m.a)||'')===tid)e.name=name;}));});return;}
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
        await commit(()=>{m.sa=sa;m.sb=sb2;m.winner=newWinner;m.status='finished';if(changes)dropLater(t,m);recompute(t);});
      }
    };
    host.onchange=async e=>{const inp=e.target.closest('[data-t-rename]');if(!inp||!isAdmin()||!reg)return;const tm=t.teams.find(x=>x.id===inp.dataset.tRename),v=inp.value.trim().slice(0,40);
      if(!tm)return;if(!v||t.teams.some(x=>x!==tm&&normName(x.name)===normName(v))){toast(v?'يوجد فريق بنفس الاسم.':'اسم الفريق لا يمكن أن يكون فارغًا.');inp.value=tm.name;return;}
      await commit(()=>{tm.name=v;});};
    host.onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const f=e.target;
      if(f.hasAttribute('data-evform')){const m=t.matches.find(x=>x.id===f.closest('[data-for]').dataset.for);if(!m)return;const r=readEvent(f);if(r.err){toast(r.err);return;}evEditing=null;await commit(()=>{m.events=m.events||[];const i=m.events.findIndex(x=>x.id===r.ev.id);if(i>=0)m.events[i]=r.ev;else m.events.push(r.ev);});return;}
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
    const settings=$('#settings');if(!settings)return;if($('#managerTools')){$('#managerTools').hidden=!isRootAdmin();return;}const card=document.createElement('div');card.id='managerTools';card.className='panel-card';card.innerHTML='<h3>إدارة صلاحيات البطولات والفرق</h3><p class="muted">تظهر هذه الأدوات للمالك فقط. أدخل رقم جلوس طالب معتمد لمنحه أو سحب صلاحية مشرف.</p><input id="managerSeat" class="field" inputmode="numeric" maxlength="6" placeholder="رقم جلوس الطالب (6 أرقام)"><div class="action-row"><button id="grantManager" class="cta">منح صلاحية مشرف</button><button id="revokeManager" class="secondary">سحب الصلاحية</button></div><p id="managerMsg" class="muted"></p>';settings.appendChild(card);card.hidden=!isRootAdmin();
    $('#grantManager').onclick=()=>changeManager(true);$('#revokeManager').onclick=()=>changeManager(false);
  }
  async function changeManager(grant){if(!isRootAdmin()||!sb){msg('#managerMsg','هذه العملية تتطلب حساب المالك الأساسي وربط قاعدة البيانات.');return;}const seat=$('#managerSeat').value.trim();if(!/^\d{6}$/.test(seat)){msg('#managerMsg','أدخل رقم جلوس صحيحًا من 6 أرقام.');return;}const {data,error}=await sb.from('profiles').select('id,full_name,role,approved').eq('seat_number',seat).maybeSingle();if(error||!data){msg('#managerMsg','لم يُعثر على حساب بهذا الرقم. يجب أن يكون الطالب قد أنشأ حسابه أولًا.');return;}if(data.role==='admin'){msg('#managerMsg','هذا الحساب مالك أساسي بالفعل.');return;}const {error:updateError}=await sb.from('profiles').update({role:grant?'team_leader':'student'}).eq('id',data.id);if(updateError){msg('#managerMsg','تعذر تحديث الصلاحية: '+updateError.message);return;}msg('#managerMsg',grant?`تم منح ${data.full_name} صلاحية التحكم في الفرق والبطولات والمباريات.`:`تم سحب صلاحية المشرف من ${data.full_name}.`,true);}

  // إدارة قائمة أرقام الجلوس للمالك من إعدادات النظام، مع تخزين محلي مؤقت فقط قبل الربط.
  function injectAdminSeats(){const settings=$('#settings');if(!settings)return;if($('#seatAdminCard')){$('#seatAdminCard').hidden=!isRootAdmin();return;}const card=document.createElement('div');card.id='seatAdminCard';card.className='panel-card';card.hidden=!isRootAdmin();card.innerHTML='<h3>قائمة أرقام الجلوس المعتمدة</h3><p class="muted">أدخل الأرقام، رقمًا في كل سطر. هذه القائمة المحلية للتجربة فقط؛ بعد ربط Supabase ستُحفظ القائمة في قاعدة البيانات الآمنة.</p><textarea id="seatNumbers" class="plain-field" rows="7" placeholder="123456\n234567"></textarea><button class="cta" id="saveSeats">حفظ القائمة</button><p id="seatMsg" class="muted"></p>';settings.appendChild(card);$('#seatNumbers').value=demoSeats.join('\n');$('#saveSeats').onclick=()=>{if(!isRootAdmin()){msg('#seatMsg','هذه الوظيفة متاحة للمالك بعد إعداد تسجيل الدخول الآمن.');return;}const arr=$('#seatNumbers').value.split(/\s+/).filter(Boolean);const bad=arr.filter(x=>!/^[0-9]{6}$/.test(x));if(bad.length){msg('#seatMsg','الأرقام يجب أن تتكون من 6 أرقام بالضبط.');return;}demoSeats=[...new Set(arr)];putLocal(seatKey,demoSeats);if(sb&&isAdmin()){sb.rpc('admin_import_seat_numbers',{p_numbers:demoSeats}).then(({error})=>msg('#seatMsg',error?'تعذر حفظ القائمة في قاعدة البيانات: '+error.message:`تم استيراد ${demoSeats.length} رقم جلوس إلى قاعدة البيانات.`,!error));}else msg('#seatMsg',`تم حفظ ${demoSeats.length} رقمًا في هذا المتصفح فقط. اربط Supabase لحفظها بأمان ومشاركتها.`,true);};}


  // ===== ترتيب الفرق: يتحكم به المالك والمشرفون (الفرق، النقاط، الترتيب) =====
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
  // ===== المباريات: لا تظهر إلا ما يضيفه المالك/المشرف =====
  const fixtureKey='sawaed_fixtures_v1';
  let localFixtures=getLocal(fixtureKey,[]);
  let fixtures=[],openFx=null;
  const pad2=n=>String(n).padStart(2,'0');
  const fmtDate=d=>`${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;
  const fmtTime=d=>{const h=d.getHours();return `${h%12||12}:${pad2(d.getMinutes())} ${h<12?'ص':'م'}`;};
  const sportIcon=name=>{try{return (SPORTS.find(x=>x.name===name)||{}).icon||'trophy';}catch{return 'trophy';}};
  function normalizeFixture(r){
    const at=r.at??r.scheduled_at??r.date??r.match_date;
    return {id:String(r.id??uid()),sport:String(r.sport??'كرة القدم'),a:String(r.a??r.team_a??r.home_team??''),b:String(r.b??r.team_b??r.away_team??''),at,venue:String(r.venue??'').trim(),status:normStatus(r.status),sa:r.sa??r.score_a??null,sb:r.sb??r.score_b??null,events:Array.isArray(r.events)?r.events:[]};
  }
  const validFixture=f=>f.id&&f.a&&f.b&&Number.isFinite(new Date(f.at).getTime());
  async function loadFixtures(){
    if(sb){
      const [f,ev]=await Promise.all([sb.from('fixtures').select('*').order('scheduled_at',{ascending:true}),sb.from('fixture_scorers').select('*')]);
      if(!f.error&&Array.isArray(f.data)){
        if(ev.error)console.warn('تعذر تحميل مسجلي المباريات:',ev.error.message);
        const evs=ev.error?[]:ev.data;
        return f.data.map(r=>normalizeFixture({...r,events:evs.filter(x=>x.fixture_id===r.id).map(x=>({id:x.id,side:x.side==='b'?'b':'a',name:x.player_name,type:x.event_type,minute:x.minute}))})).filter(validFixture);
      }
      console.warn('تعذر تحميل المباريات من قاعدة البيانات:',f.error?.message);
      if(isAdmin())toast('تعذر تحميل المباريات: '+(f.error?.message||''));
    }
    return localFixtures.map(normalizeFixture).filter(validFixture);
  }
  // الترتيب: الجارية، ثم القادمة (الأقرب فالأبعد)، ثم الباقي (المنتهية أو المتأخرة) الأحدث أولًا
  function sortFixtures(list){
    const now=Date.now(),t=f=>+new Date(f.at);
    const live=list.filter(f=>f.status==='live').sort((x,y)=>t(x)-t(y));
    const up=list.filter(f=>f.status==='upcoming'&&t(f)>=now).sort((x,y)=>t(x)-t(y));
    const rest=list.filter(f=>!live.includes(f)&&!up.includes(f)).sort((x,y)=>t(y)-t(x));
    return [...live,...up,...rest];
  }
  // المباراة التي تظهر في بطاقة «المباراة القادمة»: الجارية أولًا، ثم أقرب مباراة لم تبدأ (مع سماح 3 ساعات بعد موعدها)
  function pickNext(list){
    const now=Date.now(),t=f=>+new Date(f.at);
    return list.filter(f=>f.status==='live').sort((x,y)=>t(x)-t(y))[0]||list.filter(f=>f.status==='upcoming'&&t(f)>=now-3*36e5).sort((x,y)=>t(x)-t(y))[0]||null;
  }
  function upsertLocalFixture(f){localFixtures=localFixtures.filter(x=>x.id!==f.id);localFixtures.push({...f});putLocal(fixtureKey,localFixtures);}
  async function saveFixture(f){
    if(!sb){upsertLocalFixture(f);return null;}
    if(!isAdmin())return 'ليست لديك صلاحية التعديل.';
    try{
      let r=await sb.from('fixtures').update({status:f.status,score_a:f.sa??null,score_b:f.sb??null}).eq('id',f.id);if(r.error)throw r.error;
      const evs=f.events.map(e=>({id:e.id,fixture_id:f.id,side:e.side,player_name:e.name,event_type:e.type,minute:e.minute??null,created_by:currentUser?.id}));
      const {data:old,error}=await sb.from('fixture_scorers').select('id').eq('fixture_id',f.id);if(error)throw error;
      const keep=new Set(evs.map(x=>x.id)),del=(old||[]).filter(x=>!keep.has(x.id)).map(x=>x.id);
      if(del.length){r=await sb.from('fixture_scorers').delete().in('id',del);if(r.error)throw r.error;}
      if(evs.length){r=await sb.from('fixture_scorers').upsert(evs);if(r.error)throw r.error;}
      return null;
    }catch(e){const m=e.message||String(e);return 'تعذر الحفظ: '+m+(/fixture_scorers|score_a|status|schema cache/i.test(m)?' — شغّل ملف SAWAED_UPDATE.sql في Supabase.':'');}
  }
  function fixtureCard(f,admin,full){
    const d=new Date(f.at),ic=typeof svg==='function'?svg(ICON[sportIcon(f.sport)],30):'',cal=typeof svg==='function'?svg(ICON.calendar,14):'';
    const score=f.sa!=null&&f.sb!=null?` <span class="fx-score">${f.sa} : ${f.sb}</span>`:'',open=full&&openFx===f.id,names=[f.a,f.b];
    return `<article class="ev fx${open?' open':''}" data-fx="${esc(f.id)}"><div class="fx-row"><div class="pic">${ic}</div><div style="flex:1;min-width:0"><h4>${esc(f.a)} × ${esc(f.b)}${score}</h4><p>${esc(f.sport)}${f.venue?' · '+esc(f.venue):''}</p><time>${cal}${fmtDate(d)} · ${fmtTime(d)}</time><div>${stPill(f.status)}</div></div></div>${full?`<div class="action-row"><button type="button" class="chip" data-det="${esc(f.id)}">${open?'إخفاء التفاصيل':'تفاصيل المباراة'}</button>${admin?`<button class="danger fx-del" data-fx-del="${esc(f.id)}" aria-label="حذف المباراة">حذف</button>`:''}</div>`:''}${open?`<div class="match-details" data-for="${esc(f.id)}">${admin?`<h4 class="rh">حالة المباراة</h4>${stButtons(f.status,f.id)}<h4 class="rh">النتيجة</h4><div class="action-row"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-fsc="a" value="${f.sa??''}" aria-label="نتيجة ${esc(f.a)}"><input class="mini-score" type="number" inputmode="numeric" min="0" max="99" data-fsc="b" value="${f.sb??''}" aria-label="نتيجة ${esc(f.b)}"><button type="button" data-fx-score="${esc(f.id)}">حفظ النتيجة</button></div>`:''}${detailsHtml(f,names,admin,catalogPlayers(names))}</div>`:''}</article>`;
  }
  function paintFixtures(){
    const evHost=$('#events'),listHost=$('#matchList');
    fixtures=sortFixtures(fixtures);const admin=isAdmin();
    const empty='<div class="panel-card"><p class="muted">لا توجد مباريات مضافة حتى الآن.</p></div>';
    window.setNextMatch?.(pickNext(fixtures));
    if(evHost)evHost.innerHTML=fixtures.length?fixtures.slice(0,2).map(f=>fixtureCard(f,false,false)).join(''):empty;
    if(listHost)listHost.innerHTML=fixtures.length?fixtures.map(f=>fixtureCard(f,admin,true)).join(''):empty;
  }
  async function renderFixtures(){
    const listHost=$('#matchList'),adminHost=$('#fixtureAdmin');
    fixtures=await loadFixtures();paintFixtures();const admin=isAdmin();
    if(listHost){
      const fxOf=el=>fixtures.find(x=>x.id===(el.closest('[data-for]')?.dataset.for||el.closest('[data-fx]')?.dataset.fx));
      const commitFx=async(f,fn)=>{fn();const err=await saveFixture(f);if(err){toast(err);await renderFixtures();return;}paintFixtures();};
      listHost.onclick=async e=>{const q=s=>e.target.closest(s);
        const dt=q('[data-det]');if(dt){const id=dt.dataset.det;openFx=openFx===id?null:id;evEditing=null;paintFixtures();return;}
        if(!isAdmin())return;
        const del=q('[data-fx-del]');if(del){if(!await uiConfirm('حذف هذه المباراة؟'))return;const id=del.dataset.fxDel;
          if(sb){const {error}=await sb.from('fixtures').delete().eq('id',id);if(error){toast('تعذر الحذف: '+error.message);return;}}
          localFixtures=localFixtures.filter(x=>x.id!==id);putLocal(fixtureKey,localFixtures);fixtures=fixtures.filter(x=>x.id!==id);if(openFx===id)openFx=null;paintFixtures();return;}
        const stb=q('[data-stfor]');if(stb){const f=fixtures.find(x=>x.id===stb.dataset.stfor);if(!f)return;const ns=normStatus(stb.dataset.st);await commitFx(f,()=>{f.status=ns;});return;}
        const sc=q('[data-fx-score]');if(sc){const f=fixtures.find(x=>x.id===sc.dataset.fxScore);if(!f)return;const box=sc.closest('.match-details'),ia=box.querySelector('[data-fsc=a]'),ib=box.querySelector('[data-fsc=b]'),sa=Number(ia.value),sb2=Number(ib.value);
          if(ia.value===''||ib.value===''||!Number.isInteger(sa)||!Number.isInteger(sb2)||sa<0||sb2<0||sa>99||sb2>99){toast('أدخل نتيجتين صحيحتين (أرقام من 0 إلى 99).');return;}
          await commitFx(f,()=>{f.sa=sa;f.sb=sb2;});return;}
        const ee=q('[data-evedit]');if(ee){evEditing={mid:fxOf(ee)?.id,eid:ee.dataset.evedit};paintFixtures();return;}
        const ed=q('[data-evdel]');if(ed){const f=fxOf(ed);if(!f||!await uiConfirm('حذف هذا التسجيل؟'))return;await commitFx(f,()=>{f.events=f.events.filter(x=>x.id!==ed.dataset.evdel);});return;}
        if(q('[data-evcancel]')){evEditing=null;paintFixtures();return;}
      };
      listHost.onsubmit=async e=>{const form=e.target.closest('[data-evform]');if(!form)return;e.preventDefault();if(!isAdmin())return;const f=fxOf(form);if(!f)return;const r=readEvent(form);if(r.err){toast(r.err);return;}evEditing=null;
        await commitFx(f,()=>{const i=f.events.findIndex(x=>x.id===r.ev.id);if(i>=0)f.events[i]=r.ev;else f.events.push(r.ev);});};
    }
    if(adminHost){
      if(!admin){adminHost.innerHTML='';return;}
      if(!$('#fixtureForm')){
        adminHost.innerHTML=`<div class="panel-card"><h3>إضافة مباراة</h3><form id="fixtureForm" class="form-grid"><select name="sport" aria-label="الرياضة">${sports.map(x=>`<option>${x}</option>`).join('')}</select><input class="plain-field" name="a" required maxlength="40" placeholder="الفريق الأول"><input class="plain-field" name="b" required maxlength="40" placeholder="الفريق الثاني"><input class="plain-field" name="at" type="datetime-local" required aria-label="موعد المباراة"><input class="plain-field" name="venue" maxlength="60" placeholder="الملعب (اختياري)"><button class="cta" type="submit">إضافة المباراة</button><p id="fixtureMsg" class="err" role="alert"></p></form></div>`;
        $('#fixtureForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const fd=new FormData(e.target),a=String(fd.get('a')).trim(),b=String(fd.get('b')).trim(),when=new Date(fd.get('at'));
          if(!a||!b||isNaN(+when)){msg('#fixtureMsg','أكمل بيانات المباراة.');return;}
          if(a===b){msg('#fixtureMsg','اختر فريقين مختلفين.');return;}
          const row={id:uid(),sport:String(fd.get('sport')),team_a:a,team_b:b,scheduled_at:when.toISOString(),venue:String(fd.get('venue')||'').trim()};
          if(sb){const {error}=await sb.from('fixtures').insert({...row,status:'upcoming',created_by:currentUser?.id});if(error){msg('#fixtureMsg','تعذر الحفظ: '+error.message+(/status|schema cache/i.test(error.message)?' — شغّل ملف SAWAED_UPDATE.sql في Supabase.':''));return;}}
          else upsertLocalFixture(normalizeFixture({id:row.id,sport:row.sport,a,b,at:row.scheduled_at,venue:row.venue,status:'upcoming'}));
          e.target.reset();msg('#fixtureMsg','تمت إضافة المباراة.',true);renderFixtures();};
      }
    }
  }
  // تحديث تلقائي كل دقيقة لغير المشرفين ليروا حالة المباراة (جارية/انتهت) دون إعادة فتح الموقع
  setInterval(()=>{if(!document.hidden&&!isAdmin())renderFixtures();},60000);

  // ===== لوحة الإدارة: إعدادات التطبيق + الإعلانات + الإشعارات المشتركة + التحديث اللحظي =====
  let appSettings={},rtChannel=null,rtTimer=null;const rtQueue=new Set();
  const httpUrl=u=>{try{return /^https?:$/.test(new URL(u).protocol);}catch(e){return false;}};
  function injectAdminLink(){
    const host=$('#settings');if(!host)return;let a=$('#adminLinkCard');
    if(!isAdmin()){a&&a.remove();return;}
    if(!a){a=document.createElement('div');a.id='adminLinkCard';a.className='panel-card';a.innerHTML='<h3>لوحة الإدارة</h3><p class="muted">إدارة المستخدمين والفرق والبطولات والمباريات والإعلانات.</p><a class="cta" style="text-align:center;text-decoration:none" href="admin.html">فتح لوحة الإدارة</a>';host.appendChild(a);}
  }
  async function loadSettings(){
    if(!sb)return;const {data,error}=await sb.from('app_settings').select('key,value');if(error||!data)return;
    appSettings=Object.fromEntries(data.map(r=>[r.key,r.value]));applySettings();
  }
  function applySettings(){
    const s=appSettings,name=typeof s.app_name==='string'&&s.app_name.trim();
    if(name){document.title=name;const h=document.querySelector('.brand h1');if(h)h.textContent=name;}
    if(typeof s.app_tagline==='string'&&s.app_tagline.trim()){const t=document.querySelector('.brand .tag span');if(t)t.textContent=s.app_tagline.trim();}
    if(typeof s.app_description==='string'&&s.app_description.trim()){let m=document.querySelector('meta[name=description]');if(!m){m=document.createElement('meta');m.name='description';document.head.appendChild(m);}m.content=s.app_description.trim();}
    const sl=$('#slider');if(sl)sl.style.display=s.show_slider===false?'none':'';
    renderAppInfo();
  }
  function renderAppInfo(){
    const host=$('#settings');if(!host)return;let box=$('#appInfoBox');
    const links=Array.isArray(appSettings.social_links)?appSettings.social_links.filter(l=>l&&httpUrl(l.url)):[];
    const apk=!!appSettings.apk_enabled&&httpUrl(appSettings.apk_url);
    const desc=typeof appSettings.app_description==='string'?appSettings.app_description.trim():'';
    if(!links.length&&!apk&&!desc){box&&box.remove();return;}
    if(!box){box=document.createElement('div');box.id='appInfoBox';box.className='panel-card';host.appendChild(box);}
    box.innerHTML=(desc?`<p class="muted">${esc(desc)}</p>`:'')
      +(links.length?`<h3>تواصل معنا</h3><div class="action-row">${links.map(l=>`<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label||l.url)}</a>`).join('')}</div>`:'')
      +(apk?`<a class="cta" style="text-align:center;text-decoration:none" href="${esc(appSettings.apk_url)}" rel="noopener noreferrer">تحميل تطبيق الأندرويد${appSettings.apk_version?' ('+esc(appSettings.apk_version)+')':''}</a>`:'');
  }
  async function loadAnnouncements(){
    const host=$('#home');if(!sb||!host)return;
    const {data,error}=await sb.from('announcements').select('id,title,body,starts_at,ends_at,active').order('starts_at',{ascending:false});if(error)return;
    const now=Date.now(),list=(data||[]).filter(a=>a.active&&new Date(a.starts_at)<=now&&(!a.ends_at||new Date(a.ends_at)>now));
    let box=$('#annBox');if(!list.length){box&&box.remove();return;}
    if(!box){box=document.createElement('div');box.id='annBox';box.className='ann-box';host.insertBefore(box,host.firstChild);}
    box.innerHTML=list.map(a=>`<article class="ann"><h4>${esc(a.title)}</h4>${a.body?`<p>${esc(a.body)}</p>`:''}</article>`).join('');
  }
  async function loadNotifs(){
    if(!sb||typeof NOTIFS==='undefined')return;
    const {data,error}=await sb.from('notifications').select('id,title,body,created_at').order('created_at',{ascending:false}).limit(50);if(error||!data)return;
    NOTIFS=data.map(n=>{const t=new Date(n.created_at).getTime();return {id:t,rid:n.id,title:n.title,text:n.body,t};});
    try{const sh=$('#notifSheet');if(sh&&!sh.hidden)renderNotifs();badge();}catch(e){/* الواجهة لم تُبنَ بعد */}
  }
  window.SawaedRemote={
    hasRemote:()=>!!sb,
    async sendNotif(title,text){if(!sb)return 'LOCAL';if(!isAdmin())return 'ليست لديك صلاحية الإرسال.';
      const {error}=await sb.from('notifications').insert({title,body:text,created_by:currentUser?.id});
      if(error)return /relation|schema cache|does not exist/i.test(error.message)?'LOCAL':'تعذر الإرسال: '+error.message;
      await loadNotifs();return null;},
    async delNotif(rid){if(!sb||!rid)return 'LOCAL';const {error}=await sb.from('notifications').delete().eq('id',rid);
      if(error)return 'تعذر الحذف: '+error.message;await loadNotifs();return null;},
  };
  // تحديث لحظي: أي تعديل من لوحة الإدارة أو من مشرف آخر يظهر للجميع دون إعادة فتح التطبيق
  function startRealtime(){
    if(!sb||rtChannel||typeof sb.channel!=='function')return;
    rtChannel=sb.channel('sawaed-live');
    ['fixtures','fixture_scorers','matches','match_scorers','tournaments','teams','team_standings','team_catalog','announcements','notifications','app_settings']
      .forEach(t=>rtChannel.on('postgres_changes',{event:'*',schema:'public',table:t},()=>{rtQueue.add(t);clearTimeout(rtTimer);rtTimer=setTimeout(flushRealtime,500);}));
    rtChannel.subscribe();
  }
  async function flushRealtime(){
    const a=document.activeElement;
    if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){rtTimer=setTimeout(flushRealtime,3000);return;}   // لا نقاطع من يكتب
    const q=new Set(rtQueue);rtQueue.clear();const has=(...n)=>n.some(x=>q.has(x));const todo=[];
    if(has('fixtures','fixture_scorers'))todo.push(renderFixtures());
    if(has('tournaments','teams','matches','match_scorers')&&!tEditing)todo.push(renderTournaments());
    if(has('team_standings'))todo.push(renderRank());
    if(has('team_catalog')&&!teamEditing)todo.push(renderTeams());
    if(has('announcements'))todo.push(loadAnnouncements());
    if(has('notifications'))todo.push(loadNotifs());
    if(has('app_settings'))todo.push(loadSettings());
    try{await Promise.all(todo);}catch(e){console.warn('تعذر التحديث اللحظي',e);}
  }
  setInterval(()=>{if(!document.hidden)loadAnnouncements();},60000);   // انتهاء مدة الإعلان
  document.addEventListener('DOMContentLoaded',()=>{
    window.__sawaedAdminDemo=false;
    document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));
    $('#authForm')?.addEventListener('submit',authSubmit);setMode('login');injectAdminSeats();renderManagerTools();
    if(sb)sb.auth.onAuthStateChange(()=>setTimeout(()=>{refreshUser();loadAnnouncements();},0));
    refreshUser();loadSettings();loadAnnouncements();loadNotifs();startRealtime();
    const oldGo=window.go;if(typeof oldGo==='function'){/* existing navigation remains in charge */}
  });
  // expose a safe refresh hook for the existing navigation and admin toggle
  window.SawaedBackend={renderFixtures,renderTournaments,renderRank,refresh:()=>{window.__sawaedAdminDemo=false;injectAdminSeats();renderTournaments();renderTeams();renderManagerTools();renderFixtures();renderRank();},isConfigured:()=>!!sb,isManager:isAdmin};
})();
