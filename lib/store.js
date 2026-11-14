/* Lớp lưu trữ SQLite: mỗi collection một bảng, mỗi bản ghi lưu dạng JSON theo id. */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const COLLECTIONS = ["programs", "doanhnghiep"];

function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
  for (const col of COLLECTIONS) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${col} (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  }

  const stmt = {};
  for (const col of COLLECTIONS) {
    stmt[col] = {
      list: db.prepare(`SELECT id, data FROM ${col} ORDER BY CAST(id AS INTEGER), id`),
      put: db.prepare(`INSERT INTO ${col} (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
      del: db.prepare(`DELETE FROM ${col} WHERE id = ?`),
      clear: db.prepare(`DELETE FROM ${col}`),
      count: db.prepare(`SELECT COUNT(*) AS n FROM ${col}`)
    };
  }
  const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
  const setMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");

  const check = col => { if (!COLLECTIONS.includes(col)) throw Object.assign(new Error("Collection không hợp lệ: " + col), { status: 404 }); };
  const now = () => new Date().toISOString();

  const store = {
    db,
    COLLECTIONS,
    has: col => COLLECTIONS.includes(col),
    /** [{id, data}] — data là object đã parse */
    docs(col) { check(col); return stmt[col].list.all().map(r => ({ id: r.id, data: JSON.parse(r.data) })); },
    list(col) { return store.docs(col).map(d => d.data); },
    count(col) { check(col); return stmt[col].count.get().n; },
    put(col, id, obj) { check(col); stmt[col].put.run(String(id), JSON.stringify(obj), now()); },
    del(col, id) { check(col); stmt[col].del.run(String(id)); },

    /** Toàn bộ dữ liệu theo đúng định dạng file JSON gốc */
    exportAll() {
      const d = new Date();
      const out = { xuatNgay: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
      for (const col of COLLECTIONS) out[col] = store.list(col);
      return out;
    },

    /** Thay toàn bộ dữ liệu bằng nội dung một file sao lưu (trong một transaction) */
    importAll(obj) {
      validateBackup(obj);
      db.transaction(() => {
        const t = now();
        for (const col of COLLECTIONS) {
          stmt[col].clear.run();
          for (const rec of obj[col]) stmt[col].put.run(String(rec.id), JSON.stringify(rec), t);
        }
        setMeta.run("seeded", t);
      })();
    },

    /** Lần chạy đầu: nạp dữ liệu gốc nếu CSDL chưa từng được nạp */
    seedIfNeeded(seedFile) {
      if (getMeta.get("seeded")) return null;
      const empty = COLLECTIONS.every(c => store.count(c) === 0);
      if (!empty) { setMeta.run("seeded", now()); return null; }
      if (!seedFile || !fs.existsSync(seedFile)) return { error: "Không tìm thấy file dữ liệu gốc: " + seedFile };
      const obj = JSON.parse(fs.readFileSync(seedFile, "utf8"));
      store.importAll(obj);
      return Object.fromEntries(COLLECTIONS.map(c => [c, store.count(c)]));
    },

    close() { db.close(); }
  };
  return store;
}

function validateBackup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw Object.assign(new Error("File không đúng định dạng (cần object có programs và doanhnghiep)"), { status: 400 });
  for (const col of COLLECTIONS) {
    if (!Array.isArray(obj[col])) throw Object.assign(new Error(`File thiếu mảng "${col}"`), { status: 400 });
    const seen = new Set();
    for (const rec of obj[col]) {
      if (!rec || typeof rec !== "object" || rec.id === undefined || rec.id === null || rec.id === "")
        throw Object.assign(new Error(`Có bản ghi trong "${col}" không có id`), { status: 400 });
      if (seen.has(String(rec.id))) throw Object.assign(new Error(`Trùng id ${rec.id} trong "${col}"`), { status: 400 });
      seen.add(String(rec.id));
    }
  }
}

/** Tên file sao lưu kèm ngày giờ: itpc-du-lieu_2026-11-14_15-30-05.json */
function backupFileName(prefix = "itpc-du-lieu") {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.json`;
}

/** Ghi file sao lưu vào thư mục, trả về đường dẫn */
function writeBackup(store, dir, prefix) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, backupFileName(prefix));
  fs.writeFileSync(file, JSON.stringify(store.exportAll(), null, 1));
  return file;
}

module.exports = { openStore, validateBackup, backupFileName, writeBackup, COLLECTIONS };
