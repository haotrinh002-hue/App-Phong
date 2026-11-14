/* npm run backup [-- thư-mục-đích]
 * Xuất toàn bộ dữ liệu ra file JSON (cùng định dạng file gốc), tên file kèm ngày giờ.
 * Chạy được cả khi máy chủ đang chạy. */
const path = require("path");
const { loadConfig } = require("../lib/config");
const { openStore, writeBackup } = require("../lib/store");

const config = loadConfig();
const dir = process.argv[2] ? path.resolve(process.argv[2]) : config.backupDir;
const store = openStore(config.dbFile);
const file = writeBackup(store, dir);
console.log(`Đã sao lưu ${store.count("programs")} chương trình, ${store.count("doanhnghiep")} doanh nghiệp`);
console.log("→ " + file);
store.close();
