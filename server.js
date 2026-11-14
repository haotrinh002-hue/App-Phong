/* Máy chủ local cho web app Quản lý Chương trình ITPC
 * - Express phục vụ thư mục public/
 * - SQLite (better-sqlite3) lưu dữ liệu, mỗi collection một bảng
 * - SSE (Server-Sent Events) đẩy dữ liệu realtime cho mọi máy trong mạng LAN
 * - Không cần đăng nhập để xem. Thêm/sửa/xóa cần xác nhận một tài khoản trong config.json "admins"
 *   (trình duyệt nhớ xác nhận tới khi đóng trình duyệt hoặc bấm "Thoát quản trị")
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { loadConfig } = require("./lib/config");
const { openStore, writeBackup, backupFileName } = require("./lib/store");

const config = loadConfig();
const store = openStore(config.dbFile);

/* ---------- Lần chạy đầu: nạp dữ liệu gốc ---------- */
const seeded = store.seedIfNeeded(config.seedFile);
if (seeded && seeded.error) console.warn("⚠ " + seeded.error + " — CSDL đang trống.");
else if (seeded) console.log(`Đã nạp dữ liệu gốc: ${seeded.programs} chương trình, ${seeded.doanhnghiep} doanh nghiệp.`);

/* ---------- Phiên đăng nhập (cookie ký HMAC) ---------- */
const SECRET_FILE = path.join(path.dirname(config.dbFile), "secret.key");
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));
const SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();
const COOKIE = "itpc_tk";
const USER_RE = /^[a-z0-9][a-z0-9._-]{1,49}$/;

const sign = name => crypto.createHmac("sha256", SECRET).update(name).digest("base64url");
const makeToken = name => Buffer.from(name).toString("base64url") + "." + sign(name);
function readToken(tok) {
  if (!tok) return null;
  const [a, b] = tok.split(".");
  if (!a || !b) return null;
  const name = Buffer.from(a, "base64url").toString();
  const good = sign(name);
  if (good.length !== b.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(b))) return null;
  return name;
}
const isAdmin = name => config.admins.includes(name);

function parseCookies(h) {
  const out = {};
  (h || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

/* ---------- Realtime: SSE + số thứ tự ghi (seq) ---------- */
let seq = Date.now();
const nextSeq = () => (seq = Math.max(seq + 1, Date.now()));
const clients = Object.fromEntries(store.COLLECTIONS.map(c => [c, new Set()]));
const pending = {};

function snapshotPayload(col) {
  return `event: snapshot\ndata: ${JSON.stringify({ seq, docs: store.docs(col) })}\n\n`;
}
function broadcast(col) {
  if (pending[col]) return;
  pending[col] = setTimeout(() => {
    pending[col] = null;
    if (!clients[col].size) return;
    const msg = snapshotPayload(col);
    for (const res of clients[col]) res.write(msg);
  }, 80);
}
setInterval(() => { for (const c of store.COLLECTIONS) for (const res of clients[c]) res.write(": ping\n\n"); }, 25000).unref();

/* ---------- Sao lưu tự động hằng ngày ---------- */
const AUTO_DIR = path.join(config.backupDir, "tu-dong");
function autoBackup() {
  try {
    const f = writeBackup(store, AUTO_DIR);
    const files = fs.readdirSync(AUTO_DIR).filter(n => n.endsWith(".json")).sort();
    files.slice(0, Math.max(0, files.length - config.autoBackupKeep)).forEach(n => fs.unlinkSync(path.join(AUTO_DIR, n)));
    console.log("Sao lưu tự động: " + path.relative(config.root, f));
  } catch (e) { console.error("Sao lưu tự động lỗi:", e.message); }
}

/* ---------- Ứng dụng ---------- */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));

app.use((req, res, next) => {
  const name = readToken(parseCookies(req.headers.cookie)[COOKIE]);
  req.user = name && isAdmin(name) ? { name, admin: true } : null;
  next();
});
const needAdmin = (req, res, next) => (!req.user ? res.status(401).json({ code: "unauthenticated", message: "Cần tài khoản quản trị" })
  : req.user.admin ? next() : res.status(403).json({ code: "permission_denied", message: "Cần tài khoản quản trị" }));
const needCol = (req, res, next) => (store.has(req.params.col) ? next() : res.status(404).json({ code: "not_found", message: "Không có collection này" }));

app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.get("/api/me", (req, res) => res.json(req.user || { name: null, admin: false }));

app.post("/api/login", (req, res) => {
  const name = String((req.body && req.body.username) || "").trim().toLowerCase();
  if (!USER_RE.test(name)) return res.status(400).json({ message: "Tên tài khoản chỉ gồm chữ thường không dấu, số, dấu chấm, gạch (vd: txtrang.itpc)" });
  if (!isAdmin(name)) return res.status(403).json({ message: "Tài khoản này không có quyền quản trị" });
  // Cookie phiên: hết hiệu lực khi đóng trình duyệt
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(makeToken(name))}; Path=/; HttpOnly; SameSite=Lax`);
  console.log(`Xác nhận quản trị: ${name} từ ${req.ip}`);
  res.json({ name, admin: true });
});
app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

/* Theo dõi realtime một collection (dùng cho onSnapshot) */
app.get("/api/db/:col/stream", needCol, (req, res) => {
  const col = req.params.col;
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 3000\n\n");
  res.write(snapshotPayload(col));
  clients[col].add(res);
  req.on("close", () => clients[col].delete(res));
});

/* Đọc một lần (tiện tra cứu / kiểm tra) */
app.get("/api/db/:col", needCol, (req, res) => res.json({ seq, docs: store.docs(req.params.col) }));

/* doc(id).set(obj) */
app.put("/api/db/:col/:id", needAdmin, needCol, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ code: "invalid_argument", message: "Dữ liệu phải là object JSON" });
  store.put(req.params.col, req.params.id, body);
  const s = nextSeq();
  broadcast(req.params.col);
  res.json({ seq: s });
});
/* doc(id).delete() */
app.delete("/api/db/:col/:id", needAdmin, needCol, (req, res) => {
  store.del(req.params.col, req.params.id);
  const s = nextSeq();
  broadcast(req.params.col);
  res.json({ seq: s });
});

/* Sao lưu: tải toàn bộ dữ liệu dạng JSON (cùng định dạng file gốc) */
app.get("/api/backup", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${backupFileName()}"`);
  res.send(JSON.stringify(store.exportAll(), null, 1));
});

/* Khôi phục: thay toàn bộ dữ liệu bằng file sao lưu (tự sao lưu dữ liệu hiện tại trước) */
app.post("/api/restore", needAdmin, (req, res) => {
  try {
    const before = writeBackup(store, config.backupDir, "truoc-khoi-phuc");
    store.importAll(req.body);
    nextSeq();
    store.COLLECTIONS.forEach(broadcast);
    console.log(`Khôi phục dữ liệu bởi ${req.user.name}. Bản trước khi khôi phục: ${path.relative(config.root, before)}`);
    res.json({ ok: true, programs: store.count("programs"), doanhnghiep: store.count("doanhnghiep"), before: path.basename(before) });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

/* Thư viện xuất Excel phục vụ từ node_modules (chạy được khi không có Internet) */
app.get("/vendor/xlsx.full.min.js", (req, res) => res.sendFile(require.resolve("xlsx/dist/xlsx.full.min.js")));
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Lỗi máy chủ" });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`\nQuản lý Chương trình ITPC đang chạy (${store.count("programs")} chương trình, ${store.count("doanhnghiep")} doanh nghiệp)`);
  console.log(`  Máy này:        http://localhost:${config.port}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) console.log(`  Trong mạng LAN: http://${a.address}:${config.port}`);
  console.log(`  Tài khoản quản trị: ${config.admins.join(", ") || "(chưa có — sửa config.json)"}\n`);
  autoBackup();
  setInterval(autoBackup, 24 * 3600 * 1000).unref();
});

function shutdown() {
  for (const c of store.COLLECTIONS) for (const res of clients[c]) res.end();
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
