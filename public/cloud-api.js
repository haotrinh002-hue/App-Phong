/* Lớp giả lập window.claude.use("db" | "user" | "downloads") cho bản chạy trên Internet (Vercel + Supabase).
 * app.js giữ nguyên logic, chỉ gọi các hàm sau:
 *   db.collection(col).doc(id).set(obj) / .delete()  → upsert / delete trên bảng Supabase cùng tên
 *   db.collection(col).onSnapshot(cb, errCb)         → tải toàn bộ bảng + Supabase Realtime
 *   user.can("data.write"), user.isOwner()            → theo quyền trong bảng thanh_vien (quan_tri)
 *   downloads.save({filename, data})                  → tải file trực tiếp từ trình duyệt
 * Bắt buộc đăng nhập (email + mật khẩu) trước khi xem. Quyền được kiểm tra trong CSDL (RLS),
 * giao diện chỉ ẩn/hiện nút cho phù hợp.
 * Cần nạp trước: vendor/supabase.js (thư viện) và supabase-config.js (URL + khóa công khai).
 */
(() => {
  "use strict";
  const CFG = window.SUPABASE_CONFIG || {};
  const COLS = ["programs", "doanhnghiep"];
  const PAGE = 1000;
  const errOf = (code, message) => Object.assign(new Error(message || code), { code });
  const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const say = m => { if (typeof toast === "function") toast(m); else alert(m); };
  const onReady = fn => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };

  // app.js lưu bản sao dữ liệu vào localStorage (dùng khi không có máy chủ). Trên Internet không cần,
  // và không được để lại cho người dùng sau trên cùng máy: xóa khi mở trang, đóng trang, đăng xuất.
  const CACHE_KEYS = ["itpc-ct-v1", "itpc-dn-v1"];
  const clearCache = () => { try { CACHE_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {} };
  clearCache();
  window.addEventListener("pagehide", clearCache);

  // Link đặt lại mật khẩu / lời mời từ email: sau khi vào phải đặt mật khẩu mới
  const fromEmailLink = /type=(invite|recovery)/.test(location.hash);

  if (!CFG.url || !CFG.key || !window.supabase) {
    onReady(() => { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Chưa cấu hình Supabase (thiếu SUPABASE_URL / SUPABASE_ANON_KEY khi build trên Vercel).</p>'; });
    window.claude = { use: () => new Promise(() => {}) };
    return;
  }
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  /* ================= Đăng nhập / Đăng ký / Chờ duyệt ================= */
  let me = null; // {email, ho_ten, quyen, thanh_vien, quan_tri}
  async function whoAmI() {
    const { data, error } = await sb.rpc("toi_la_ai");
    if (error) throw error;
    return data;
  }
  const ready = (async () => {
    const { data } = await sb.auth.getSession();
    let who = null;
    if (data.session) { try { who = await whoAmI(); } catch (e) { who = null; } }
    me = who && who.thanh_vien ? who : await authScreen(who ? "gate" : "login", who);
    return me;
  })();
  ready.then(() => onReady(() => { renderAccount(); setupMembers(); if (fromEmailLink) changePassword(true); }));

  const QUYEN = { cho_duyet: "Chờ duyệt", xem: "Chỉ xem", quan_tri: "Quản trị", khoa: "Khóa" };
  const mapErr = m => /invalid login/i.test(m) ? "Email hoặc mật khẩu không đúng."
    : /email not confirmed/i.test(m) ? "Email chưa được xác nhận. Mở email đăng ký và bấm vào link xác nhận trước."
    : /already registered|already been registered/i.test(m) ? "Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng Quên mật khẩu."
    : /rate limit|too many/i.test(m) ? "Thao tác quá nhiều lần, vui lòng thử lại sau ít phút."
    : /password/i.test(m) && /least|short|weak/i.test(m) ? "Mật khẩu quá ngắn hoặc quá yếu (ít nhất 8 ký tự)."
    : /signups? not allowed|disabled/i.test(m) ? "Hệ thống đang tắt đăng ký tài khoản mới. Liên hệ quản trị."
    : m;

  /** Màn hình trước khi vào app. mode: login | signup | forgot | gate. Trả về thông tin tài khoản khi đã được duyệt. */
  function authScreen(mode, who) {
    return new Promise(resolve => onReady(() => {
      const box = document.createElement("div");
      box.className = "lg-wrap";
      document.body.appendChild(box);
      const logo = escH((document.querySelector(".logo-img") || {}).src || "");
      const head = sub => `<div class="lg-head"><img class="logo-img" alt="" src="${logo}"><div><strong>Quản lý Chương trình ITPC</strong><small>${sub}</small></div></div>`;
      let lastEmail = ""; try { lastEmail = localStorage.getItem("itpc-last-email") || ""; } catch (e) {}
      let gateCh = null, gatePoll = null;
      const stopGate = () => { if (gateCh) { sb.removeChannel(gateCh); gateCh = null; } clearInterval(gatePoll); };

      const done = w => { stopGate(); box.remove(); resolve(w); };
      async function afterSignIn() {
        const w = await whoAmI();
        if (w.thanh_vien) return done(w);
        render("gate", null, w);
      }

      function render(m, msg, w) {
        stopGate();
        const err = msg && msg.err ? `<div class="err lg-err">${escH(msg.err)}</div>` : '<div class="err lg-err" hidden></div>';
        const info = msg && msg.ok ? `<div class="lg-ok">${escH(msg.ok)}</div>` : "";
        if (m === "login") box.innerHTML = `
          <form class="lg-card" novalidate>${head("Đăng nhập để dùng dữ liệu chung của phòng")}${info}
            <label>Email<input name="e" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ten@itpc.gov.vn"></label>
            <label>Mật khẩu<input name="p" type="password" autocomplete="current-password"></label>
            ${err}
            <button class="btn pri" type="submit">Đăng nhập</button>
            <div class="lg-links"><a href="#" data-go="signup">Đăng ký tài khoản mới</a><a href="#" data-go="forgot">Quên mật khẩu?</a></div>
          </form>`;
        else if (m === "signup") box.innerHTML = `
          <form class="lg-card" novalidate>${head("Đăng ký tài khoản — quản trị sẽ duyệt trước khi bạn xem được dữ liệu")}
            <label>Họ và tên<input name="n" autocomplete="name" placeholder="VD: Nguyễn Văn A"></label>
            <label>Email<input name="e" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ten@itpc.gov.vn"></label>
            <label>Mật khẩu (ít nhất 8 ký tự)<input name="p" type="password" autocomplete="new-password"></label>
            <label>Nhập lại mật khẩu<input name="p2" type="password" autocomplete="new-password"></label>
            ${err}
            <button class="btn pri" type="submit">Đăng ký</button>
            <div class="lg-links"><a href="#" data-go="login">Đã có tài khoản? Đăng nhập</a></div>
          </form>`;
        else if (m === "forgot") box.innerHTML = `
          <form class="lg-card" novalidate>${head("Nhập email đã đăng ký, hệ thống gửi link đặt lại mật khẩu")}${info}
            <label>Email<input name="e" type="email" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
            ${err}
            <button class="btn pri" type="submit">Gửi link đặt lại mật khẩu</button>
            <div class="lg-links"><a href="#" data-go="login">Quay lại đăng nhập</a></div>
          </form>`;
        else box.innerHTML = `
          <div class="lg-card">${head(escH(w.ho_ten || w.email))}
            <div class="${w.quyen === "khoa" ? "err lg-err" : "lg-ok"}">${w.quyen === "khoa"
              ? "Tài khoản này đã bị khóa. Liên hệ quản trị của phòng nếu cần mở lại."
              : `Đã đăng ký tài khoản <b>${escH(w.email)}</b>. Đang chờ quản trị duyệt — khi được duyệt, trang sẽ tự vào.`}</div>
            <button class="btn pri" type="button" data-act="check">Kiểm tra lại</button>
            <div class="lg-links"><a href="#" data-act="out">Đăng xuất</a></div>
          </div>`;

        box.querySelectorAll("[data-go]").forEach(a => a.onclick = ev => { ev.preventDefault(); render(a.dataset.go); });
        const f = box.querySelector("form");
        if (f) {
          if (f.elements.e && !f.elements.e.value) f.elements.e.value = lastEmail;
          setTimeout(() => { const first = [...f.querySelectorAll("input")].find(i => !i.value) || f.querySelector("input"); first && first.focus(); }, 30);
          const er = f.querySelector(".lg-err");
          const fail = t => { er.textContent = t; er.hidden = false; };
          f.onsubmit = async ev => {
            ev.preventDefault();
            er.hidden = true;
            const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
            const email = (f.elements.e.value || "").trim().toLowerCase();
            try {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email chưa đúng định dạng.");
              lastEmail = email; try { localStorage.setItem("itpc-last-email", email); } catch (e) {}
              if (m === "login") {
                const { error } = await sb.auth.signInWithPassword({ email, password: f.elements.p.value });
                if (error) return fail(mapErr(error.message));
                await afterSignIn();
              } else if (m === "signup") {
                const ho_ten = f.elements.n.value.trim(), p = f.elements.p.value;
                if (!ho_ten) return fail("Nhập họ và tên.");
                if (p.length < 8) return fail("Mật khẩu cần ít nhất 8 ký tự.");
                if (p !== f.elements.p2.value) return fail("Hai lần nhập mật khẩu không giống nhau.");
                const { data, error } = await sb.auth.signUp({ email, password: p, options: { data: { ho_ten }, emailRedirectTo: location.origin + location.pathname } });
                if (error) return fail(mapErr(error.message));
                // Supabase trả về user không có identities khi email đã tồn tại (để không lộ thông tin)
                if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return fail(mapErr("already registered"));
                if (data.session) await afterSignIn();
                else render("login", { ok: `Đã đăng ký. Mở email ${email} và bấm link xác nhận, sau đó đăng nhập. Quản trị cần duyệt trước khi bạn xem được dữ liệu.` });
              } else if (m === "forgot") {
                const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
                if (error) return fail(mapErr(error.message));
                render("forgot", { ok: `Nếu ${email} đã đăng ký, một email đặt lại mật khẩu vừa được gửi. Mở email và bấm vào link.` });
              }
            } catch (e) {
              fail(e instanceof TypeError ? "Không kết nối được máy chủ dữ liệu, thử lại sau." : (e.message || String(e)));
            } finally { if (btn.isConnected) btn.disabled = false; }
          };
        } else {
          // Đang chờ duyệt: theo dõi dòng của chính mình, được duyệt là vào ngay
          box.querySelector("[data-act=check]").onclick = () => afterSignIn().catch(() => {});
          box.querySelector("[data-act=out]").onclick = async ev => { ev.preventDefault(); clearCache(); await sb.auth.signOut(); render("login"); };
          if (w.quyen !== "khoa") {
            gateCh = sb.channel("tv-toi").on("postgres_changes", { event: "*", schema: "public", table: "thanh_vien" }, () => afterSignIn().catch(() => {})).subscribe();
            gatePoll = setInterval(() => afterSignIn().catch(() => {}), 30000);
          }
        }
      }
      render(mode, null, who);
    }));
  }

  function changePassword(required) {
    const dlg = document.createElement("dialog");
    dlg.className = "adm-dlg";
    dlg.innerHTML = `
      <form novalidate>
        <div class="dlg-h"><h2>${required ? "Đặt mật khẩu" : "Đổi mật khẩu"}</h2></div>
        <div class="adm-b">
          ${required ? '<p class="adm-why">Đặt mật khẩu để lần sau đăng nhập.</p>' : ""}
          <label>Mật khẩu mới<input name="p1" type="password" autocomplete="new-password" minlength="8"></label>
          <label>Nhập lại mật khẩu mới<input name="p2" type="password" autocomplete="new-password"></label>
          <div class="err adm-err" hidden></div>
        </div>
        <div class="dlg-f">${required ? "" : '<button type="button" class="btn" data-no>Hủy</button>'}<button type="submit" class="btn pri">Lưu mật khẩu</button></div>
      </form>`;
    document.body.appendChild(dlg);
    const f = dlg.querySelector("form"), er = dlg.querySelector(".adm-err");
    const close = () => { dlg.close(); dlg.remove(); };
    const no = dlg.querySelector("[data-no]"); if (no) no.onclick = close;
    dlg.addEventListener("cancel", e => { if (required) e.preventDefault(); else close(); });
    f.onsubmit = async ev => {
      ev.preventDefault();
      const p1 = f.elements.p1.value, p2 = f.elements.p2.value;
      const fail = m => { er.textContent = m; er.hidden = false; };
      if (p1.length < 8) return fail("Mật khẩu cần ít nhất 8 ký tự.");
      if (p1 !== p2) return fail("Hai lần nhập không giống nhau.");
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) return fail(error.message);
      close(); say("Đã lưu mật khẩu mới");
    };
    dlg.showModal();
    f.elements.p1.focus();
  }

  /* ================= Ô tài khoản + sao lưu / khôi phục ================= */
  function renderAccount() {
    const aside = document.querySelector("aside");
    if (!aside || !me) return;
    let el = document.getElementById("acct");
    if (!el) { el = document.createElement("div"); el.className = "acct"; el.id = "acct"; aside.appendChild(el); }
    el.innerHTML = `
      <div class="acct-u"><strong title="${escH(me.email)}">${escH(me.ho_ten || me.email)}</strong><small>${me.ho_ten ? escH(me.email) + " · " : ""}${QUYEN[me.quyen] || ""}</small></div>
      <div class="acct-b">
        <button type="button" class="btn sm" id="bkBtn" title="Tải toàn bộ dữ liệu ra file JSON">Sao lưu</button>
        ${me.quan_tri ? '<button type="button" class="btn sm" id="rsBtn" title="Thay toàn bộ dữ liệu bằng một file sao lưu">Khôi phục</button>' : ""}
        <button type="button" class="btn sm" id="pwBtn">Đổi mật khẩu</button>
        <button type="button" class="btn sm" id="loBtn">Đăng xuất</button>
      </div>
      <input type="file" id="rsFile" accept=".json,application/json" hidden>`;
    el.querySelector("#bkBtn").onclick = () => backup().catch(e => say("Chưa sao lưu được: " + e.message));
    el.querySelector("#pwBtn").onclick = () => changePassword(false);
    el.querySelector("#loBtn").onclick = async () => { clearCache(); await sb.auth.signOut(); clearCache(); location.reload(); };
    const rs = el.querySelector("#rsBtn"), file = el.querySelector("#rsFile");
    if (rs) {
      rs.onclick = () => { file.value = ""; file.click(); };
      file.onchange = async () => {
        const f = file.files[0]; if (!f) return;
        let obj;
        try { obj = JSON.parse(await f.text()); } catch (e) { return say("File không phải JSON hợp lệ"); }
        const np = Array.isArray(obj.programs) ? obj.programs.length : "?", nd = Array.isArray(obj.doanhnghiep) ? obj.doanhnghiep.length : "?";
        if (!confirm(`Khôi phục từ "${f.name}"?\n\n${np} chương trình, ${nd} doanh nghiệp.\nToàn bộ dữ liệu hiện tại sẽ bị THAY THẾ. Trình duyệt sẽ tự tải một bản sao lưu dữ liệu hiện tại trước khi khôi phục.`)) return;
        try {
          await backup("truoc-khoi-phuc");
          const { data, error } = await sb.rpc("khoi_phuc", { payload: obj });
          if (error) throw error;
          await Promise.all(COLS.map(refetch));
          say(`Đã khôi phục: ${data.programs} chương trình, ${data.doanhnghiep} doanh nghiệp`);
        } catch (e) { say("Không khôi phục được: " + e.message); }
      };
    }
  }

  /* ================= Tab "Thành viên" (chỉ quản trị) ================= */
  const MV = "thanh-vien";
  let members = [], memberErr = "";
  function setupMembers() {
    if (!me.quan_tri || document.querySelector(`#nav a[data-v="${MV}"]`)) return;
    const a = document.createElement("a");
    a.href = "#" + MV; a.dataset.v = MV;
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1M16 3.5a4 4 0 0 1 0 9M22 21v-1a7 7 0 0 0-4-6.3"/></svg>Thành viên<span class="tv-badge" hidden></span>';
    document.getElementById("nav").appendChild(a);
    // route() của app.js là hàm khai báo toàn cục: bọc lại để thêm màn "Thành viên", không sửa app.js
    const orig = window.route;
    window.removeEventListener("hashchange", orig);
    window.route = function () {
      if (location.hash !== "#" + MV) return orig.apply(this, arguments);
      document.querySelectorAll("#nav a").forEach(x => x.classList.toggle("on", x.dataset.v === MV));
      viewMembers();
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", () => window.route());
    sb.channel("tv-all").on("postgres_changes", { event: "*", schema: "public", table: "thanh_vien" }, () => loadMembers()).subscribe();
    loadMembers();
    if (location.hash === "#" + MV) window.route();
  }

  async function loadMembers() {
    const { data, error } = await sb.rpc("danh_sach_thanh_vien");
    if (error) memberErr = error.message; else { members = data || []; memberErr = ""; }
    const n = members.filter(m => m.quyen === "cho_duyet").length;
    const b = document.querySelector(".tv-badge");
    if (b) { b.hidden = !n; b.textContent = n; b.title = n + " tài khoản chờ duyệt"; }
    const busy = document.querySelector("dialog[open]") || (document.activeElement && document.activeElement.matches && document.activeElement.matches("#view select"));
    if (location.hash === "#" + MV && !busy) viewMembers();
  }

  function viewMembers() {
    const view = document.getElementById("view");
    const t = iso => iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    const pend = members.filter(m => m.quyen === "cho_duyet").length;
    view.innerHTML = `
      <div class="head"><div><h1>Thành viên</h1><p class="sub">${members.length} tài khoản${pend ? ` · <b>${pend} chờ duyệt</b>` : ""} · chọn quyền để cấp hoặc thu hồi</p></div></div>
      ${memberErr ? `<div class="confirm" style="margin-bottom:14px">${escH(memberErr)}</div>` : ""}
      <div class="tbl-wrap"><table class="tv-tbl"><thead><tr><th>Họ tên</th><th>Email</th><th>Đăng ký lúc</th><th>Đăng nhập gần nhất</th><th>Quyền</th></tr></thead><tbody>
      ${members.map(m => {
        const self = m.email === me.email;
        return `<tr${m.quyen === "cho_duyet" ? ' class="tv-pend"' : ""}><td><div class="t-name">${escH(m.ho_ten || "—")}</div></td><td>${escH(m.email)}</td><td class="num">${t(m.created_at)}</td><td class="num">${t(m.last_sign_in_at)}</td>
          <td><select data-tv="${escH(m.email)}" aria-label="Quyền của ${escH(m.email)}" ${self ? 'disabled title="Không thể tự đổi quyền của chính mình"' : ""}>${Object.entries(QUYEN).map(([k, v]) => `<option value="${k}"${m.quyen === k ? " selected" : ""}>${v}</option>`).join("")}</select>${self ? ' <span class="t-meta">(bạn)</span>' : ""}</td></tr>`;
      }).join("") || '<tr><td colspan="5"><div class="empty">Chưa có tài khoản nào.</div></td></tr>'}
      </tbody></table></div>
      <p class="t-meta" style="margin-top:12px;line-height:1.7"><b>Chờ duyệt</b>: đã đăng ký, chưa xem được dữ liệu · <b>Chỉ xem</b>: xem, xuất Excel, sao lưu · <b>Quản trị</b>: thêm/sửa/xóa, khôi phục, cấp quyền · <b>Khóa</b>: không vào được nữa.</p>`;
    view.querySelectorAll("select[data-tv]").forEach(s => s.onchange = async () => {
      s.disabled = true;
      const { error } = await sb.rpc("dat_quyen", { p_email: s.dataset.tv, p_quyen: s.value });
      if (error) say("Không đổi được quyền: " + error.message);
      else say(`Đã đặt quyền "${QUYEN[s.value]}" cho ${s.dataset.tv}`);
      s.blur();
      await loadMembers();
    });
  }

  async function fetchAll(col) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(col).select("id,data").order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) return out;
    }
  }

  async function backup(prefix = "itpc-du-lieu") {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    const out = { xuatNgay: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` };
    for (const col of COLS) out[col] = (await fetchAll(col)).map(r => r.data).sort((a, b) => (+a.id - +b.id) || String(a.id).localeCompare(String(b.id)));
    const name = `${prefix}_${out.xuatNgay}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.json`;
    await downloads.save({ filename: name, data: JSON.stringify(out, null, 1), mimeType: "application/json" });
  }

  /* ================= db (giả lập Firestore) ================= */
  const server = {};    // col -> Map(id -> data) theo máy chủ
  const pending = {};   // col -> Map(id -> {data|null, done, echoed}) ghi đang chờ (giữ thay đổi cục bộ)
  const listeners = {}; // col -> Set(cb)
  const pend = col => (pending[col] = pending[col] || new Map());

  function makeSnap(col) {
    const map = new Map(server[col] || []);
    for (const [id, w] of pend(col)) { if (w.data === null) map.delete(id); else map.set(id, w.data); }
    const docs = [...map].map(([id, data]) => ({ id, exists: true, data: () => data }));
    return { empty: docs.length === 0, size: docs.length, docs, metadata: { fromCache: false, hasPendingWrites: pend(col).size > 0 }, forEach: fn => docs.forEach(fn) };
  }
  const emitTimers = {};
  function emit(col) {
    clearTimeout(emitTimers[col]);
    emitTimers[col] = setTimeout(() => { for (const cb of listeners[col] || []) { try { cb(makeSnap(col)); } catch (e) { console.error(e); } } }, 60);
  }
  async function refetch(col) {
    const rows = await fetchAll(col);
    server[col] = new Map(rows.map(r => [String(r.id), r.data]));
    emit(col);
  }

  function applyChange(col, payload) {
    if (!server[col]) return;
    const id = String((payload.new && payload.new.id) ?? (payload.old && payload.old.id));
    if (payload.eventType === "DELETE") server[col].delete(id); else server[col].set(id, payload.new.data);
    const w = pend(col).get(id);
    if (w) { if (w.done) pend(col).delete(id); else w.echoed = true; }
    emit(col);
  }

  async function write(col, id, data) {
    id = String(id);
    const w = { data: data === null ? null : JSON.parse(JSON.stringify(data)), done: false, echoed: false };
    pend(col).set(id, w);
    const finish = () => { w.done = true; if (w.echoed && pend(col).get(id) === w) pend(col).delete(id); };
    let res;
    try {
      res = data === null
        ? await sb.from(col).delete().eq("id", id)
        : await sb.from(col).upsert({ id, data: w.data });
    } catch (e) {
      if (pend(col).get(id) === w) pend(col).delete(id);
      throw errOf("unavailable", "Không kết nối được máy chủ dữ liệu");
    }
    if (res.error) {
      if (pend(col).get(id) === w) pend(col).delete(id);
      // 42501 = không đủ quyền (RLS): app.js coi "invalid_argument" là chuyển sang chế độ xem
      throw errOf(res.error.code === "42501" || /row-level security/i.test(res.error.message) ? "invalid_argument" : "unknown", res.error.message);
    }
    finish();
  }

  function onSnapshot(col, cb, errCb) {
    (listeners[col] = listeners[col] || new Set()).add(cb);
    let failed = false;
    const ch = sb.channel("db-" + col)
      .on("postgres_changes", { event: "*", schema: "public", table: col }, p => applyChange(col, p))
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          // lần đầu, và mỗi lần kết nối lại: tải lại toàn bộ để không sót thay đổi
          refetch(col).then(() => { failed = false; }).catch(e => { if (errCb) errCb(e); });
        } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && !failed) {
          failed = true;
          if (errCb) { try { errCb(errOf("unavailable", "Mất kết nối dữ liệu")); } catch (e) {} }
        }
      });
    // Lưới an toàn: 5 phút tải lại một lần
    const safety = setInterval(() => refetch(col).catch(() => {}), 5 * 60 * 1000);
    return () => { clearInterval(safety); listeners[col].delete(cb); sb.removeChannel(ch); };
  }

  const db = {
    collection(col) {
      return {
        doc: id => ({ id: String(id), set: data => write(col, id, data), delete: () => write(col, id, null) }),
        onSnapshot: (cb, errCb) => onSnapshot(col, cb, errCb)
      };
    }
  };

  /* ================= user ================= */
  const user = {
    get name() { return me && me.email; },
    async can(perm) { await ready; return perm === "data.write" ? !!me.quan_tri : true; },
    async isOwner() { await ready; return !!me.quan_tri; }
  };

  /* ================= downloads ================= */
  const downloads = {
    async save({ filename, data, mimeType }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || (/\.xlsx$/i.test(filename) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/octet-stream") });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "tai-ve";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { ok: true };
    }
  };

  window.claude = {
    use(name) {
      if (name === "db") return ready.then(() => db);
      if (name === "user") return ready.then(() => user);
      if (name === "downloads") return Promise.resolve(downloads);
      return Promise.reject(errOf("unavailable", "Không hỗ trợ: " + name));
    }
  };
})();
