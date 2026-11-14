/* npm run restore -- <đường-dẫn-file.json>
 * Thay TOÀN BỘ dữ liệu bằng nội dung file sao lưu. Cần tắt máy chủ trước
 * (khi máy chủ đang chạy, dùng nút "Khôi phục" trong giao diện).
 * Dữ liệu hiện tại được tự sao lưu vào data/backups/truoc-khoi-phuc_*.json trước khi ghi đè. */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { loadConfig } = require("../lib/config");
const { openStore, writeBackup, validateBackup } = require("../lib/store");

const config = loadConfig();
const src = process.argv[2];
if (!src) {
  console.error("Cách dùng: npm run restore -- <file-sao-luu.json>");
  process.exit(1);
}

function serverRunning() {
  return new Promise(ok => {
    const req = http.get({ host: "127.0.0.1", port: config.port, path: "/api/ping", timeout: 1500 }, res => { res.resume(); ok(true); });
    req.on("error", () => ok(false));
    req.on("timeout", () => { req.destroy(); ok(false); });
  });
}

(async () => {
  if (await serverRunning()) {
    console.error(`Máy chủ đang chạy ở cổng ${config.port}. Hãy tắt máy chủ (Ctrl+C) rồi chạy lại lệnh này,`);
    console.error("hoặc dùng nút \"Khôi phục\" trong giao diện bằng tài khoản quản trị.");
    process.exit(1);
  }
  const obj = JSON.parse(fs.readFileSync(path.resolve(src), "utf8"));
  validateBackup(obj);
  const store = openStore(config.dbFile);
  const before = writeBackup(store, config.backupDir, "truoc-khoi-phuc");
  console.log("Đã lưu dữ liệu hiện tại vào: " + before);
  store.importAll(obj);
  console.log(`Đã khôi phục: ${store.count("programs")} chương trình, ${store.count("doanhnghiep")} doanh nghiệp.`);
  store.close();
})().catch(e => { console.error("Lỗi: " + e.message); process.exit(1); });
