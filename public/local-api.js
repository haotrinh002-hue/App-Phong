/* Lớp giả lập window.claude.use("db" | "user" | "downloads") cho bản chạy local.
 * app.js giữ nguyên logic, chỉ gọi các hàm sau:
 *   db.collection(col).doc(id).set(obj) / .delete()      → PUT / DELETE /api/db/:col/:id
 *   db.collection(col).onSnapshot(cb, errCb)             → SSE /api/db/:col/stream
 *   user.can("data.write"), user.isOwner()                → luôn true: mọi người thấy đủ nút,
 *                                                           quyền thật do máy chủ kiểm tra khi ghi
 *   downloads.save({filename, data})                      → tải file trực tiếp từ trình duyệt
 *
 * Không có màn đăng nhập: ai mở trang cũng xem được. Khi mở form thêm/sửa, hoặc khi có thao tác
 * ghi (lưu, xóa, khôi phục, tick công việc…) mà trình duyệt chưa xác nhận quản trị, một hộp thoại
 * hỏi tên tài khoản quản trị (config.json "admins"). Nếu bấm Hủy, thay đổi trên máy này được trả
 * về đúng dữ liệu trên máy chủ.
 */
(() => {
  "use strict";
  const api = (url, opt = {}) => fetch(url, { credentials: "same-origin", ...opt, headers: { "Content-Type": "application/json", ...(opt.headers || {}) } });
  const errOf = (code, message) => Object.assign(new Error(message || code), { code });
  const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const say = m => { if (typeof toast === "function") toast(m); else alert(m); };
  const onReady = fn => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };

  /* ================= Quyền quản trị ================= */
  let admin = null; // tên tài khoản quản trị đã xác nhận trên trình duyệt này, hoặc null
  api("/api/me").then(r => (r.ok ? r.json() : null)).then(j => { admin = j && j.admin ? j.name : null; renderAccount(); }).catch(() => renderAccount());

  let asking = null; // một hộp thoại dùng chung cho nhiều lần ghi cùng lúc
  /** Hỏi tài khoản quản trị. Trả về true nếu xác nhận được, false nếu người dùng bấm Hủy. */
  function requireAdmin(reason) {
    if (admin) return Promise.resolve(true);
    if (asking) return asking;
    asking = new Promise(resolve => {
      const dlg = document.createElement("dialog");
      dlg.className = "adm-dlg";
      dlg.innerHTML = `
        <form method="dialog" novalidate>
          <div class="dlg-h"><h2>Xác nhận quản trị</h2></div>
          <div class="adm-b">
            <p class="adm-why">${escH(reason || "Thêm, sửa, xóa dữ liệu cần tài khoản quản trị.")}</p>
            <label>Tài khoản quản trị<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="VD: txtrang.itpc"></label>
            <div class="err adm-err" hidden></div>
          </div>
          <div class="dlg-f"><button type="button" class="btn" data-no>Hủy</button><button type="submit" class="btn pri">Xác nhận</button></div>
        </form>`;
      document.body.appendChild(dlg);
      const f = dlg.querySelector("form"), inp = f.elements.u, er = dlg.querySelector(".adm-err");
      try { inp.value = localStorage.getItem("itpc-last-admin") || ""; } catch (e) {}
      let done = false;
      const finish = ok => { if (done) return; done = true; asking = null; if (dlg.open) dlg.close(); dlg.remove(); renderAccount(); resolve(ok); };
      dlg.querySelector("[data-no]").onclick = () => finish(false);
      dlg.addEventListener("cancel", e => { e.preventDefault(); finish(false); });
      f.onsubmit = async ev => {
        ev.preventDefault();
        er.hidden = true;
        const btn = f.querySelector("[type=submit]"); btn.disabled = true;
        try {
          const r = await api("/api/login", { method: "POST", body: JSON.stringify({ username: inp.value.trim() }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.message || "Không xác nhận được");
          admin = j.name;
          try { localStorage.setItem("itpc-last-admin", j.name); } catch (e) {}
          finish(true);
        } catch (e) {
          er.textContent = e instanceof TypeError ? "Không kết nối được máy chủ, thử lại sau." : e.message;
          er.hidden = false; inp.select();
        } finally { btn.disabled = false; }
      };
      dlg.showModal();
      inp.focus(); inp.select();
    });
    return asking;
  }

  /* Hỏi quản trị ngay khi mở form thêm/sửa (trước khi nhập), thay vì đợi tới lúc lưu */
  onReady(() => {
    for (const id of ["dlg", "dlgDN", "dlgMC"]) {
      const d = document.getElementById(id);
      if (!d) continue;
      const orig = d.showModal.bind(d);
      d.showModal = () => {
        if (admin) return orig();
        requireAdmin().then(ok => {
          if (!ok || d.open) return;
          orig();
          const first = d.querySelector("input:not([type=hidden]),textarea,select");
          if (first) first.focus();
        });
      };
    }
  });

  /* ================= Ô tài khoản + sao lưu / khôi phục ở thanh bên ================= */
  function personName(tk) {
    try {
      const p = (typeof CHUYEN_VIEN !== "undefined" && CHUYEN_VIEN.find(x => x.tk === tk)) || (typeof LANH_DAO !== "undefined" && LANH_DAO.find(x => x.tk === tk));
      return p ? p.ten : "";
    } catch (e) { return ""; }
  }

  function renderAccount() {
    onReady(() => {
      const aside = document.querySelector("aside");
      if (!aside) return;
      let el = document.getElementById("acct");
      if (!el) { el = document.createElement("div"); el.className = "acct"; el.id = "acct"; aside.appendChild(el); }
      const nm = admin && personName(admin);
      el.innerHTML = `
        <div class="acct-u">${admin
          ? `<strong title="${escH(admin)}">${escH(nm || admin)}</strong><small>${nm ? escH(admin) + " · " : ""}Quản trị</small>`
          : `<strong>Đang xem</strong><small>Sửa, xóa sẽ hỏi tài khoản quản trị</small>`}</div>
        <div class="acct-b">
          <button type="button" class="btn sm" id="bkBtn" title="Tải toàn bộ dữ liệu ra file JSON">Sao lưu</button>
          <button type="button" class="btn sm" id="rsBtn" title="Thay toàn bộ dữ liệu bằng một file sao lưu">Khôi phục</button>
          ${admin ? '<button type="button" class="btn sm" id="loBtn">Thoát quản trị</button>' : ""}
        </div>
        <input type="file" id="rsFile" accept=".json,application/json" hidden>`;
      el.querySelector("#bkBtn").onclick = () => { location.href = "/api/backup"; };
      const lo = el.querySelector("#loBtn");
      if (lo) lo.onclick = async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); admin = null; renderAccount(); say("Đã thoát quản trị"); };
      const file = el.querySelector("#rsFile");
      el.querySelector("#rsBtn").onclick = async () => {
        if (!(await requireAdmin("Khôi phục dữ liệu cần tài khoản quản trị."))) return;
        file.value = ""; file.click();
      };
      file.onchange = async () => {
        const f = file.files[0]; if (!f) return;
        let obj;
        try { obj = JSON.parse(await f.text()); } catch (e) { return say("File không phải JSON hợp lệ"); }
        const np = Array.isArray(obj.programs) ? obj.programs.length : "?", nd = Array.isArray(obj.doanhnghiep) ? obj.doanhnghiep.length : "?";
        if (!confirm(`Khôi phục từ "${f.name}"?\n\n${np} chương trình, ${nd} doanh nghiệp.\nToàn bộ dữ liệu hiện tại sẽ bị THAY THẾ (máy chủ tự lưu một bản trước khi khôi phục).`)) return;
        try {
          const r = await api("/api/restore", { method: "POST", body: JSON.stringify(obj) });
          const j = await r.json().catch(() => ({}));
          if (r.status === 401 || r.status === 403) { admin = null; renderAccount(); }
          if (!r.ok) throw new Error(j.message || "Không khôi phục được");
          say(`Đã khôi phục: ${j.programs} chương trình, ${j.doanhnghiep} doanh nghiệp`);
        } catch (e) { say(e.message); }
      };
    });
  }

  /* ================= db (giả lập Firestore) ================= */
  // Ghi đang chờ (latency compensation): giữ thay đổi cục bộ đè lên snapshot của máy chủ
  // cho tới khi máy chủ gửi về snapshot có seq >= seq của lần ghi đó.
  const overlay = {};   // col -> Map(id -> {data|null, seq})
  const listeners = {}; // col -> Set(cb)
  const lastDocs = {};  // col -> docs của snapshot máy chủ gần nhất
  const ov = col => (overlay[col] = overlay[col] || new Map());

  function makeSnap(col) {
    const map = new Map((lastDocs[col] || []).map(d => [String(d.id), d.data]));
    for (const [id, w] of ov(col)) { if (w.data === null) map.delete(id); else map.set(id, w.data); }
    const docs = [...map].map(([id, data]) => ({ id, exists: true, data: () => data }));
    return { empty: docs.length === 0, size: docs.length, docs, metadata: { fromCache: false, hasPendingWrites: ov(col).size > 0 }, forEach: fn => docs.forEach(fn) };
  }
  function emit(col) {
    for (const cb of listeners[col] || []) { try { cb(makeSnap(col)); } catch (e) { console.error(e); } }
  }

  // Khi người dùng không xác nhận quản trị: bỏ thay đổi cục bộ, trả app về dữ liệu máy chủ
  const revertCols = new Set();
  let revertTimer = null;
  function revert(col) {
    revertCols.add(col);
    clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      revertCols.forEach(emit); revertCols.clear();
      say("Chưa lưu: cần tài khoản quản trị để thay đổi dữ liệu");
    }, 50);
  }

  async function write(col, id, data) {
    id = String(id);
    const entry = { data: data === null ? null : JSON.parse(JSON.stringify(data)), seq: Infinity };
    ov(col).set(id, entry);
    const drop = () => { if (ov(col).get(id) === entry) ov(col).delete(id); };
    const url = `/api/db/${encodeURIComponent(col)}/${encodeURIComponent(id)}`;
    for (let tries = 0; ; tries++) {
      if (!(await requireAdmin())) { drop(); revert(col); return; }
      let r;
      try {
        r = await api(url, data === null ? { method: "DELETE" } : { method: "PUT", body: JSON.stringify(data) });
      } catch (e) { drop(); throw errOf("unavailable", "Không kết nối được máy chủ"); }
      const j = await r.json().catch(() => ({}));
      if ((r.status === 401 || r.status === 403) && tries < 3) { admin = null; renderAccount(); continue; } // hết phiên → hỏi lại
      if (!r.ok) { drop(); throw errOf("unknown", j.message); }
      entry.seq = j.seq;
      return;
    }
  }

  function onSnapshot(col, cb, errCb) {
    let es, failed = false, closed = false;
    (listeners[col] = listeners[col] || new Set()).add(cb);
    const open = () => {
      es = new EventSource(`/api/db/${encodeURIComponent(col)}/stream`);
      es.addEventListener("snapshot", ev => {
        const msg = JSON.parse(ev.data);
        for (const [id, w] of ov(col)) if (w.seq <= msg.seq) ov(col).delete(id);
        lastDocs[col] = msg.docs;
        failed = false;
        try { cb(makeSnap(col)); } catch (e) { console.error(e); }
      });
      es.onerror = () => {
        if (closed) return;
        if (!failed && errCb) { failed = true; try { errCb(errOf("unavailable", "Mất kết nối máy chủ")); } catch (e) {} }
        if (es.readyState === EventSource.CLOSED) setTimeout(() => { if (!closed) open(); }, 5000);
      };
    };
    open();
    return () => { closed = true; listeners[col].delete(cb); es && es.close(); };
  }

  const db = {
    collection(col) {
      return {
        doc: id => ({
          id: String(id),
          set: data => write(col, id, data),
          delete: () => write(col, id, null)
        }),
        onSnapshot: (cb, errCb) => onSnapshot(col, cb, errCb)
      };
    }
  };

  /* ================= user ================= */
  // Mọi người đều thấy đủ nút (kể cả Thùng rác); quyền ghi thật được kiểm tra khi lưu.
  const user = {
    get name() { return admin; },
    async can() { return true; },
    async isOwner() { return true; }
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
      if (name === "db") return Promise.resolve(db);
      if (name === "user") return Promise.resolve(user);
      if (name === "downloads") return Promise.resolve(downloads);
      return Promise.reject(errOf("unavailable", "Không hỗ trợ: " + name));
    }
  };
})();
