/* Build bản chạy trên Vercel (giao diện tĩnh + Supabase) vào thư mục dist/
 *   - Chép public/ sang dist/ (app.js, style.css giữ nguyên)
 *   - index.html: thay local-api.js bằng thư viện Supabase + supabase-config.js + cloud-api.js
 *   - Tạo supabase-config.js từ biến môi trường SUPABASE_URL, SUPABASE_ANON_KEY
 *     (khóa "anon"/"publishable" là khóa công khai; dữ liệu được bảo vệ bằng RLS trong CSDL)
 * Chạy thử trên máy: set SUPABASE_URL=... & set SUPABASE_ANON_KEY=... & npm run build:vercel
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "dist");
const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

if (!url || !key) {
  console.error("Thiếu biến môi trường SUPABASE_URL và/hoặc SUPABASE_ANON_KEY.");
  console.error("Trên Vercel: Project → Settings → Environment Variables, thêm 2 biến này rồi Redeploy.");
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) console.warn("Cảnh báo: SUPABASE_URL trông không giống https://xxxx.supabase.co — kiểm tra lại.");
if (/service_role|^sb_secret_/.test(key) || (() => { try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "service_role"; } catch (e) { return false; } })()) {
  console.error("SUPABASE_ANON_KEY đang là khóa service_role/secret — KHÔNG được dùng khóa này ở giao diện. Hãy dùng khóa anon (publishable).");
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true, filter: p => path.basename(p) !== "local-api.js" });
fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });
fs.copyFileSync(require.resolve("xlsx/dist/xlsx.full.min.js"), path.join(OUT, "vendor", "xlsx.full.min.js"));
fs.copyFileSync(path.join(path.dirname(require.resolve("@supabase/supabase-js/package.json")), "dist", "umd", "supabase.js"), path.join(OUT, "vendor", "supabase.js"));
fs.writeFileSync(path.join(OUT, "supabase-config.js"), `window.SUPABASE_CONFIG = ${JSON.stringify({ url, key })};\n`);

const idx = path.join(OUT, "index.html");
const html = fs.readFileSync(idx, "utf8");
const tag = '<script src="local-api.js"></script>';
if (!html.includes(tag)) { console.error("Không tìm thấy " + tag + " trong public/index.html"); process.exit(1); }
fs.writeFileSync(idx, html.replace(tag, '<script src="vendor/supabase.js"></script>\n<script src="supabase-config.js"></script>\n<script src="cloud-api.js"></script>'));

console.log("Đã build vào dist/ (Supabase: " + url + ")");
