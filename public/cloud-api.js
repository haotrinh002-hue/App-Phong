/* Lớp giả lập window.claude.use("db" | "user" | "downloads") cho bản chạy trên Internet (Vercel + Supabase).
 * app.js giữ nguyên logic, chỉ gọi các hàm sau:
 *   db.collection(col).doc(id).set(obj) / .delete()  → upsert / delete trên bảng Supabase cùng tên
 *   db.collection(col).onSnapshot(cb, errCb)         → tải toàn bộ bảng + Supabase Realtime
 *   user.can("data.write"), user.isOwner()            → theo cột quan_tri trong bảng thanh_vien
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

  // Link mời / đặt lại mật khẩu từ email: sau khi vào phải đặt mật khẩu mới
  const fromEmailLink = /type=(invite|recovery|signup)/.test(location.hash);

  if (!CFG.url || !CFG.key || !window.supabase) {
    onReady(() => { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Chưa cấu hình Supabase (thiếu SUPABASE_URL / SUPABASE_ANON_KEY khi build trên Vercel).</p>'; });
    window.claude = { use: () => new Promise(() => {}) };
    return;
  }
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  /* ================= Đăng nhập ================= */
  let me = null; // {email, ho_ten, thanh_vien, quan_tri}
  async function whoAmI() {
    const { data, error } = await sb.rpc("toi_la_ai");
    if (error) throw error;
    return data;
  }
  const ready = (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      try { me = await whoAmI(); } catch (e) { me = null; }
      if (me && me.thanh_vien) return me;
    }
    me = await showLogin(data.session && me && !me.thanh_vien ? notMemberMsg(me.email) : "");
    return me;
  })();
  ready.then(() => onReady(() => { renderAccount(); if (fromEmailLink) changePassword(true); }));

  const notMemberMsg = email => `Tài khoản ${email} chưa được cấp quyền xem. Nhờ quản trị thêm email này vào danh sách thành viên.`;

  function showLogin(msg) {
    return new Promise(resolve => onReady(() => {
      const box = document.createElement("div");
      box.className = "lg-wrap";
      box.innerHTML = `
        <form class="lg-card" novalidate>
          <div class="lg-head"><img class="logo-img" alt="" src="${escH((document.querySelector(".logo-img") || {}).src || "")}"><div><strong>Quản lý Chương trình ITPC</strong><small>Đăng nhập để dùng dữ liệu chung của phòng</small></div></div>
          <label>Email<input name="e" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ten@itpc.gov.vn" required></label>
          <label>Mật khẩu<input name="p" type="password" autocomplete="current-password" required></label>
          <div class="err lg-err" ${msg ? "" : "hidden"}>${escH(msg)}</div>
          <button class="btn pri" type="submit">Đăng nhập</button>
          <p class="lg-note">Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị của phòng.</p>
        </form>`;
      document.body.appendChild(box);
      const f = box.querySelector("form"), er = box.querySelector(".lg-err");
      try { f.elements.e.value = localStorage.getItem("itpc-last-email") || ""; } catch (e) {}
      setTimeout(() => (f.elements.e.value ? f.elements.p : f.elements.e).focus(), 30);
      f.onsubmit = async ev => {
        ev.preventDefault();
        er.hidden = true;
        const btn = f.querySelector("button"); btn.disabled = true;
        try {
          const email = f.elements.e.value.trim(), password = f.elements.p.value;
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw new Error(/invalid/i.test(error.message) ? "Email hoặc mật khẩu không đúng." : error.message);
          const who = await whoAmI();
          if (!who.thanh_vien) { await sb.auth.signOut(); throw new Error(notMemberMsg(email)); }
          try { localStorage.setItem("itpc-last-email", email); } catch (e) {}
          box.remove();
          resolve(who);
        } catch (e) {
          er.textContent = e instanceof TypeError ? "Không kết nối được máy chủ dữ liệu, thử lại sau." : e.message;
          er.hidden = false;
        } finally { btn.disabled = false; }
      };
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
      <div class="acct-u"><strong title="${escH(me.email)}">${escH(me.ho_ten || me.email)}</strong><small>${me.ho_ten ? escH(me.email) + " · " : ""}${me.quan_tri ? "Quản trị" : "Chỉ xem"}</small></div>
      <div class="acct-b">
        <button type="button" class="btn sm" id="bkBtn" title="Tải toàn bộ dữ liệu ra file JSON">Sao lưu</button>
        ${me.quan_tri ? '<button type="button" class="btn sm" id="rsBtn" title="Thay toàn bộ dữ liệu bằng một file sao lưu">Khôi phục</button>' : ""}
        <button type="button" class="btn sm" id="pwBtn">Đổi mật khẩu</button>
        <button type="button" class="btn sm" id="loBtn">Đăng xuất</button>
      </div>
      <input type="file" id="rsFile" accept=".json,application/json" hidden>`;
    el.querySelector("#bkBtn").onclick = () => backup().catch(e => say("Chưa sao lưu được: " + e.message));
    el.querySelector("#pwBtn").onclick = () => changePassword(false);
    el.querySelector("#loBtn").onclick = async () => { await sb.auth.signOut(); location.reload(); };
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
