# Quản lý Chương trình ITPC — bản chạy local

Web app quản lý chương trình xúc tiến và dữ liệu doanh nghiệp của Phòng XTPTNT&TTTN, chạy trên một máy trong văn phòng. Các máy khác cùng mạng LAN mở bằng trình duyệt, cùng xem và cùng sửa một bộ dữ liệu. Thay đổi hiện ngay trên mọi máy, không cần tải lại trang.

Giao diện, chức năng và các danh mục (ngành hàng, loại hình, trạng thái, mẫu công việc, loại minh chứng, danh sách chuyên viên/lãnh đạo) giữ nguyên như file gốc `itpc-chuong-trinh_ban-day-du-du-lieu_2026-11-14.html`.

## 1. Cài đặt

Cần **Node.js 20 trở lên** (tải bản LTS tại https://nodejs.org, cài với tùy chọn mặc định).

Mở PowerShell hoặc Command Prompt trong thư mục dự án và chạy:

```
npm install
npm start
```

Lần chạy đầu, máy chủ tự nạp dữ liệu từ `itpc-du-lieu_2026-11-14.json` (17 chương trình, 422 doanh nghiệp) vào `data/itpc.db`, giữ nguyên id. Những lần sau, dữ liệu được đọc từ `data/itpc.db`. File JSON gốc không được đọc lại nữa.

Màn hình sẽ hiện:

```
Quản lý Chương trình ITPC đang chạy (17 chương trình, 422 doanh nghiệp)
  Máy này:        http://localhost:3000
  Trong mạng LAN: http://192.168.1.25:3000
  Tài khoản quản trị: txtrang.itpc
```

Để cửa sổ này mở trong suốt thời gian sử dụng. Bấm `Ctrl+C` để tắt máy chủ.

## 2. Xem và sửa dữ liệu (không cần đăng nhập)

Ai mở trang cũng xem được ngay toàn bộ dữ liệu, xuất được Excel và tải được file sao lưu.

Khi **thêm, sửa, xóa** (mở form thêm/sửa, xóa, khôi phục từ Thùng rác, tick công việc…), app hiện hộp **Xác nhận quản trị** và hỏi tên tài khoản quản trị:

- Nhập đúng một tài khoản trong danh sách `admins` của `config.json` thì thao tác tiếp tục. Trình duyệt nhớ xác nhận này tới khi đóng trình duyệt hoặc bấm **Thoát quản trị** ở thanh bên trái.
- Bấm **Hủy** thì không có gì được lưu. Nếu app đã đổi tạm trên màn hình (ví dụ đã báo “Đã chuyển vào Thùng rác”), dữ liệu được trả lại như trên máy chủ.

Sửa danh sách tài khoản quản trị trong `config.json`:

```json
{
  "port": 3000,
  "admins": ["txtrang.itpc", "hhlong.itpc"]
}
```

- `admins`: các tài khoản được thêm/sửa/xóa (viết thường, không dấu).
- `port`: cổng web (mặc định 3000).

Sau khi sửa `config.json`, tắt máy chủ (`Ctrl+C`) rồi chạy lại `npm start`.

> Xác nhận chỉ cần tên tài khoản, không có mật khẩu, nên đây là cơ chế tránh sửa nhầm chứ không phải bảo mật thật. Chỉ dùng trong mạng LAN của cơ quan, không mở cổng ra Internet.

## 3. Truy cập từ máy khác trong mạng LAN

1. Trên máy chạy máy chủ, xem địa chỉ ở dòng `Trong mạng LAN: http://192.168.x.x:3000` khi chạy `npm start`. Cũng có thể xem bằng lệnh `ipconfig`, ở dòng *IPv4 Address*.
2. Trên máy khác cùng mạng, mở trình duyệt (Chrome, Edge…) và vào địa chỉ đó, ví dụ `http://192.168.1.25:3000`.
3. Nếu không vào được, hãy cho phép cổng 3000 qua Windows Firewall trên máy chạy máy chủ:
   - Lần đầu chạy `npm start`, Windows thường hỏi *"Allow access"*. Chọn cho phép với **Private networks**.
   - Hoặc mở PowerShell **bằng quyền Administrator** và chạy:
     ```
     netsh advfirewall firewall add rule name="ITPC 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
     ```
4. Nên đặt IP tĩnh cho máy chạy máy chủ (hoặc nhờ bộ phận IT cấp IP cố định) để địa chỉ không đổi.

## 4. Sao lưu

**Cách 1: trên giao diện.** Bấm nút **Sao lưu** ở góc dưới thanh bên trái. Trình duyệt sẽ tải về file `itpc-du-lieu_YYYY-MM-DD_HH-mm-ss.json`, có cùng định dạng với file gốc (`xuatNgay`, `programs`, `doanhnghiep`). Bản ghi trong Thùng rác (`daXoa: true`) cũng được lưu.

**Cách 2: bằng lệnh** (chạy được cả khi máy chủ đang chạy):

```
npm run backup
```

File được lưu vào `data/backups/`. Muốn lưu vào thư mục khác, ví dụ ổ USB:

```
npm run backup -- E:\SaoLuu
```

**Sao lưu tự động:** mỗi lần khởi động và sau mỗi 24 giờ, máy chủ tự lưu một bản vào `data/backups/tu-dong/`. Thư mục này giữ 30 bản mới nhất; số này đổi được bằng `autoBackupKeep` trong `config.json`.

Nên chép định kỳ thư mục `data/backups/` (hoặc file `data/itpc.db`) sang một nơi khác như ổ mạng hay USB.

## 5. Khôi phục

> Khôi phục sẽ **thay toàn bộ** dữ liệu hiện tại bằng nội dung trong file sao lưu. Trước khi ghi đè, máy chủ luôn tự lưu dữ liệu hiện tại vào `data/backups/truoc-khoi-phuc_*.json`, nên có thể quay lại nếu chọn nhầm file.

**Cách 1: trên giao diện, khi máy chủ đang chạy.** Bấm **Khôi phục** ở thanh bên trái, nhập tài khoản quản trị nếu được hỏi, chọn file `.json` rồi xác nhận. Mọi máy đang mở trang sẽ nhận dữ liệu mới ngay.

**Cách 2: bằng lệnh.** Tắt máy chủ trước (`Ctrl+C`), sau đó chạy:

```
npm run restore -- data\backups\itpc-du-lieu_2026-11-14_15-30-00.json
npm start
```

Cách này cũng dùng được với file JSON gốc `itpc-du-lieu_2026-11-14.json`.

**Bắt đầu lại từ dữ liệu gốc:** tắt máy chủ, xóa các file `data/itpc.db*`, rồi chạy `npm start`. Máy chủ sẽ nạp lại `itpc-du-lieu_2026-11-14.json`.

## 6. Xuất Excel

Bấm **Xuất Excel** ở thanh bên trái. Trình duyệt tải về `QLCT-ITPC_YYYY-MM-DD.xlsx` gồm 3 sheet: Chương trình, Công việc, Doanh nghiệp. Thư viện xuất Excel được phục vụ từ chính máy chủ, nên vẫn dùng được khi không có Internet.

## 7. Chuyển sang máy khác

Chép cả thư mục dự án, **trừ** `node_modules/`, sang máy mới. Trên máy mới, chạy `npm install` rồi `npm start`. Dữ liệu nằm trong `data/itpc.db`. Nếu chỉ chép thư mục `data/` thì dữ liệu vẫn được giữ nguyên.

## 8. Cấu trúc thư mục

```
server.js            Máy chủ Express: API dữ liệu, realtime (SSE), xác nhận quản trị, sao lưu/khôi phục
config.json          Cổng, danh sách tài khoản quản trị, đường dẫn dữ liệu
lib/store.js         Lưu trữ SQLite: mỗi collection một bảng (programs, doanhnghiep), bản ghi dạng JSON theo id
lib/config.js        Đọc config.json
scripts/backup.js    Lệnh npm run backup
scripts/restore.js   Lệnh npm run restore
public/index.html    Giao diện (giữ nguyên từ bản gốc)
public/style.css     CSS bản gốc + phần nhỏ cho hộp xác nhận quản trị và ô tài khoản (cuối file)
public/app.js        Toàn bộ logic app bản gốc (không sửa logic)
public/local-api.js  Lớp giả lập window.claude.use("db" | "user" | "downloads") gọi về máy chủ local, kèm hộp xác nhận quản trị
data/                itpc.db (CSDL), secret.key (khóa ký phiên quản trị), backups/
```

So với file HTML gốc, `app.js` chỉ khác ba dòng:

- Hai mảng dữ liệu nhúng `SAMPLE` và `SAMPLE_DN` được để rỗng, vì dữ liệu giờ nằm trong SQLite.
- Đường dẫn thư viện Excel trỏ về `vendor/xlsx.full.min.js` trên máy chủ thay vì CDN.

`local-api.js` cung cấp đúng các hàm app gọi: `db.collection(col).doc(id).set()/delete()`, `collection(col).onSnapshot()`, `user.can()/isOwner()` (luôn đúng; quyền thật được máy chủ kiểm tra khi ghi) và `downloads.save()`.

## 9. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `npm` không nhận lệnh | Cài Node.js, rồi mở lại cửa sổ PowerShell |
| `Error: listen EADDRINUSE :3000` | Máy chủ đã chạy ở cửa sổ khác, hoặc cổng bị chiếm. Đổi `port` trong `config.json` |
| Máy khác không vào được | Kiểm tra cùng mạng, địa chỉ IP và Firewall (mục 3) |
| Thanh bên hiện *"Mất kết nối dữ liệu chung"* | Máy chủ đã tắt hoặc mất mạng. Trang tự kết nối lại khi máy chủ chạy trở lại |
| Hộp xác nhận báo *"không có quyền quản trị"* | Tên đó chưa có trong `admins` của `config.json`. Thêm vào rồi khởi động lại máy chủ |
