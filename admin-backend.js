/* سواعد — طبقة بيانات لوحة الإدارة (Supabase).
   لا توجد هنا أي مفاتيح سرية: نستخدم مفتاح anon من config.js فقط، والحماية الفعلية تتم عبر RLS ودوال قاعدة البيانات.
   التحقق في المتصفح للراحة فقط، وليس للحماية. */
(() => {
  'use strict';
  const cfg = window.SAWAED_SUPABASE || {};
  const configured = !!(window.supabase?.createClient && cfg.url && cfg.anonKey && !String(cfg.url).includes('YOUR_'));
  const sb = configured ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const S = { user: null, profile: null };
  const uid = () => 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // ترجمة أشهر أخطاء قاعدة البيانات إلى رسائل عربية مفهومة
  function errMsg(e) {
    const m = (e && (e.message || e.details)) || String(e || '');
    if (/row-level security|permission denied|not authorized|غير مصرّح/i.test(m)) return 'ليست لديك صلاحية لهذه العملية.';
    if (/no_dup|duplicate key|already exists/i.test(m)) return 'هذا السجل مكرّر (نفس الاسم/الحدث موجود بالفعل).';
    if (/foreign key/i.test(m)) return 'لا يمكن التنفيذ لوجود بيانات مرتبطة. احذف المرتبط أولًا.';
    if (/violates check constraint/i.test(m)) return 'قيمة غير مقبولة: راجع الحقول (الأطوال/الأرقام/التواريخ).';
    if (/relation .* does not exist|schema cache|could not find/i.test(m)) return 'جدول أو عمود ناقص في قاعدة البيانات: شغّل ADMIN_SETUP.sql ثم أعد المحاولة.';
    if (/JWT|session/i.test(m)) return 'انتهت الجلسة. سجّل الدخول من جديد.';
    return m;
  }
  const run = async q => { const { data, error } = await q; if (error) throw new Error(errMsg(error)); return data; };
  // تعديل/حذف: RLS لا ترمي خطأ عند الرفض بل تُرجع صفوفًا فارغة، لذلك نتحقق من العدد
  const mutate = async q => {
    const data = await run(q.select());
    if (!data || !data.length) throw new Error('لم يُنفَّذ التغيير: لا تملك الصلاحية أو أن السجل لم يعد موجودًا.');
    return data;
  };
  const count = async (table, f) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count: c, error } = await q; if (error) throw new Error(errMsg(error)); return c || 0;
  };

  // ───── الجلسة والصلاحية ─────
  async function guard() {
    if (!sb) return { ok: false, reason: 'config' };
    const { data: { user }, error } = await sb.auth.getUser();   // يتحقق من الجلسة لدى الخادم
    if (error || !user) return { ok: false, reason: 'auth' };
    const { data: p, error: pe } = await sb.from('profiles').select('id,full_name,seat_number,role,approved').eq('id', user.id).maybeSingle();
    if (pe || !p || !p.approved || !['admin', 'team_leader'].includes(p.role)) return { ok: false, reason: 'role' };
    S.user = user; S.profile = p;
    return { ok: true, profile: p };
  }
  const signOut = async () => { try { await sb.auth.signOut(); } catch (e) { /* نتابع التحويل */ } };
  const onSignOut = cb => sb && sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') cb(); });

  // ───── المستخدمون (للمالك فقط؛ RLS تمنع غيره) ─────
  const users = {
    list: () => run(sb.from('profiles').select('id,full_name,seat_number,role,approved,created_at').order('created_at', { ascending: false })),
    update: (id, patch) => mutate(sb.from('profiles').update(patch).eq('id', id)),
    // الحذف الكامل عبر Edge Function (مفتاح الخدمة سرّ على الخادم). تتحقق الدالة بنفسها أن المتصل هو المدير الأعلى.
    async remove(id) {
      const { data, error } = await sb.functions.invoke('admin-delete-user', { body: { user_id: id } });
      if (error) {
        let m = error.message || '';
        try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) { /* رسالة عامة */ }
        if (/Failed to send|NetworkError|fetch/i.test(m)) m = 'تعذر الوصول إلى الدالة admin-delete-user: انشرها أولًا في Supabase (راجع ADMIN_GUIDE_AR.md).';
        throw new Error(m);
      }
      if (data && data.error) throw new Error(data.error);
      return true;
    },
  };

  // ───── الفرق (team_catalog) ─────
  const teams = {
    list: () => run(sb.from('team_catalog').select('*').order('name')),
    create: p => run(sb.from('team_catalog').insert({ id: uid(), ...p, updated_by: S.user.id })),
    update: (id, p) => mutate(sb.from('team_catalog').update({ ...p, updated_by: S.user.id, updated_at: new Date().toISOString() }).eq('id', id)),
    remove: id => mutate(sb.from('team_catalog').delete().eq('id', id)),
  };

  // ───── البطولات وفرقها ومبارياتها ─────
  const tournaments = {
    async list() {
      const [t, tm, m] = await Promise.all([
        run(sb.from('tournaments').select('*').order('created_at', { ascending: false })),
        run(sb.from('teams').select('id,tournament_id')),
        run(sb.from('matches').select('id,tournament_id,status')),
      ]);
      return t.map(r => ({ ...r, teamCount: tm.filter(x => x.tournament_id === r.id).length, matchCount: m.filter(x => x.tournament_id === r.id).length }));
    },
    create: p => run(sb.from('tournaments').insert({
      id: uid(), status: 'registration', created_by: S.user.id, ...p,
      config: { qualifiers: 2, groups: [], rounds: [], champion: null, teamOrder: [], matchOrder: [] },
    })),
    update: (id, p) => mutate(sb.from('tournaments').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)),
    remove: id => mutate(sb.from('tournaments').delete().eq('id', id)),
    async impact(id) {
      const [t, m, e] = await Promise.all([
        count('teams', q => q.eq('tournament_id', id)), count('matches', q => q.eq('tournament_id', id)),
        count('match_scorers', q => q.eq('tournament_id', id))]);
      return { teams: t, matches: m, events: e };
    },
    teams: {
      list: tid => run(sb.from('teams').select('*').eq('tournament_id', tid).order('created_at')),
      add: (tid, name) => run(sb.from('teams').insert({ id: uid(), tournament_id: tid, name })),
      rename: (id, name) => mutate(sb.from('teams').update({ name }).eq('id', id)),
      remove: id => mutate(sb.from('teams').delete().eq('id', id)),
    },
    matches: {
      list: tid => run(sb.from('matches').select('*').eq('tournament_id', tid).order('scheduled_at', { nullsFirst: false })),
      all: () => run(sb.from('matches').select('*')),
      update: (id, p) => mutate(sb.from('matches').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)),
      create: p => run(sb.from('matches').insert({ id: uid(), ...p })),
      createMany: rows => run(sb.from('matches').insert(rows)),
      remove: id => mutate(sb.from('matches').delete().eq('id', id)),
      removeMany: ids => mutate(sb.from('matches').delete().in('id', ids)),
    },
    allTeams: () => run(sb.from('teams').select('id,tournament_id,name')),
  };

  // ───── المباريات العامة ─────
  const fixtures = {
    list: () => run(sb.from('fixtures').select('*').order('scheduled_at', { ascending: false })),
    create: p => run(sb.from('fixtures').insert({ id: uid(), created_by: S.user.id, ...p })),
    update: (id, p) => mutate(sb.from('fixtures').update(p).eq('id', id)),
    remove: id => mutate(sb.from('fixtures').delete().eq('id', id)),
  };

  // ───── الأهداف والتمريرات الحاسمة ─────
  // kind: 'fixture' (fixture_scorers) أو 'match' (match_scorers)
  const events = {
    list: (kind, id) => kind === 'fixture'
      ? run(sb.from('fixture_scorers').select('*').eq('fixture_id', id).order('minute', { nullsFirst: false }))
      : run(sb.from('match_scorers').select('*').eq('match_id', id).order('minute', { nullsFirst: false })),
    add: (kind, row) => kind === 'fixture'
      ? run(sb.from('fixture_scorers').insert({ id: uid(), created_by: S.user.id, ...row }))
      : run(sb.from('match_scorers').insert({ id: uid(), created_by: S.user.id, ...row })),
    update: (kind, id, p) => mutate(sb.from(kind === 'fixture' ? 'fixture_scorers' : 'match_scorers').update(p).eq('id', id)),
    remove: (kind, id) => mutate(sb.from(kind === 'fixture' ? 'fixture_scorers' : 'match_scorers').delete().eq('id', id)),
    all: async () => {
      const [f, m] = await Promise.all([run(sb.from('fixture_scorers').select('*')), run(sb.from('match_scorers').select('*'))]);
      return { fixtureEvents: f, matchEvents: m };
    },
  };

  // ───── ترتيب الفرق في الصفحة الرئيسية (team_standings) ─────
  const standings = {
    list: () => run(sb.from('team_standings').select('*').order('points', { ascending: false })),
    save: rows => run(sb.from('team_standings').upsert(rows.map(r => ({ id: r.id, sport: r.sport || 'overall', name: r.name, points: r.points, pos: r.pos ?? 0, updated_by: S.user.id, updated_at: new Date().toISOString() })))),
    remove: id => mutate(sb.from('team_standings').delete().eq('id', id)),
  };

  // ───── أرقام الجلوس المعتمدة (للمالك فقط؛ RLS والدالة تمنع غيره) ─────
  const seats = {
    list: async () => (await run(sb.from('approved_seat_numbers').select('seat_number').order('seat_number'))).map(r => r.seat_number),
    add: numbers => run(sb.rpc('admin_import_seat_numbers', { p_numbers: numbers })),
  };

  // ───── الإعلانات والإشعارات ─────
  const announcements = {
    list: () => run(sb.from('announcements').select('*').order('created_at', { ascending: false })),
    create: p => run(sb.from('announcements').insert({ created_by: S.user.id, ...p })),
    update: (id, p) => mutate(sb.from('announcements').update(p).eq('id', id)),
    remove: id => mutate(sb.from('announcements').delete().eq('id', id)),
  };
  const notifications = {
    list: () => run(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)),
    create: p => run(sb.from('notifications').insert({ created_by: S.user.id, ...p })),
    remove: id => mutate(sb.from('notifications').delete().eq('id', id)),
  };

  // ───── إعدادات التطبيق (للمالك فقط) ─────
  const settings = {
    async get() { const rows = await run(sb.from('app_settings').select('key,value')); return Object.fromEntries(rows.map(r => [r.key, r.value])); },
    save: map => run(sb.from('app_settings').upsert(
      Object.entries(map).map(([key, value]) => ({ key, value, updated_by: S.user.id, updated_at: new Date().toISOString() })), { onConflict: 'key' })),
  };

  // ───── التحديث اللحظي ─────
  function live(tables, cb) {
    const ch = sb.channel('admin-live-' + Math.random().toString(36).slice(2));
    tables.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t)));
    ch.subscribe(st => cb('__status', st));
    return () => sb.removeChannel(ch);
  }

  window.AdminAPI = { configured, S, uid, norm, errMsg, count, guard, signOut, onSignOut, users, teams, tournaments, fixtures, standings, seats, events, announcements, notifications, settings, live };
})();
