/* Đọc config.json (đường dẫn tương đối tính từ thư mục dự án) */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULTS = {
  port: 3000,
  host: "0.0.0.0",
  admins: [],
  seedFile: "itpc-du-lieu_2026-11-14.json",
  dbFile: "data/itpc.db",
  backupDir: "data/backups",
  autoBackupKeep: 30
};

function loadConfig() {
  const file = path.join(ROOT, "config.json");
  let user = {};
  if (fs.existsSync(file)) user = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = { ...DEFAULTS, ...user };
  if (process.env.PORT) c.port = +process.env.PORT;
  const norm = a => (Array.isArray(a) ? a : []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
  c.admins = norm(c.admins);
  const abs = p => (path.isAbsolute(p) ? p : path.join(ROOT, p));
  c.seedFile = abs(c.seedFile);
  c.dbFile = abs(c.dbFile);
  c.backupDir = abs(c.backupDir);
  c.root = ROOT;
  return c;
}

module.exports = { loadConfig, ROOT };
