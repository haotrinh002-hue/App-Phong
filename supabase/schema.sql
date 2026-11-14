-- =====================================================================
-- Quản lý Chương trình ITPC — cấu trúc CSDL trên Supabase
-- Chạy MỘT LẦN trong Supabase: SQL Editor → New query → dán toàn bộ → Run.
-- Chạy lại nhiều lần cũng không sao (không xóa dữ liệu).
-- =====================================================================

-- 1. Danh sách thành viên: chỉ email có trong bảng này mới xem được dữ liệu.
--    quan_tri = true → được thêm/sửa/xóa, khôi phục dữ liệu.
create table if not exists public.thanh_vien (
  email    text primary key,
  ho_ten   text,
  quan_tri boolean not null default false
);
alter table public.thanh_vien enable row level security;
-- Không tạo policy: bảng này chỉ sửa được trong Supabase (Table Editor / SQL Editor).

create or replace function public.la_thanh_vien() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.la_quan_tri() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where quan_tri and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Thông tin tài khoản đang đăng nhập (giao diện dùng để hiện tên, quyền)
create or replace function public.toi_la_ai() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'email', auth.jwt() ->> 'email',
    'ho_ten', (select ho_ten from public.thanh_vien where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'thanh_vien', public.la_thanh_vien(),
    'quan_tri', public.la_quan_tri());
$$;

-- 2. Hai bảng dữ liệu: mỗi bản ghi lưu nguyên dạng JSON theo id (giống bản local)
create table if not exists public.programs (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.doanhnghiep (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Tự ghi ai sửa, lúc nào (không tin dữ liệu gửi từ trình duyệt)
create or replace function public.ghi_nguoi_sua() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;

drop trigger if exists trg_programs_nguoi_sua on public.programs;
create trigger trg_programs_nguoi_sua before insert or update on public.programs
  for each row execute function public.ghi_nguoi_sua();
drop trigger if exists trg_doanhnghiep_nguoi_sua on public.doanhnghiep;
create trigger trg_doanhnghiep_nguoi_sua before insert or update on public.doanhnghiep
  for each row execute function public.ghi_nguoi_sua();

-- 3. Phân quyền theo từng dòng (Row Level Security)
do $$
declare t text;
begin
  foreach t in array array['programs', 'doanhnghiep'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists xem on public.%I', t);
    execute format('drop policy if exists them on public.%I', t);
    execute format('drop policy if exists sua on public.%I', t);
    execute format('drop policy if exists xoa on public.%I', t);
    execute format('create policy xem  on public.%I for select to authenticated using (public.la_thanh_vien())', t);
    execute format('create policy them on public.%I for insert to authenticated with check (public.la_quan_tri())', t);
    execute format('create policy sua  on public.%I for update to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri())', t);
    execute format('create policy xoa  on public.%I for delete to authenticated using (public.la_quan_tri())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 4. Khôi phục toàn bộ dữ liệu từ file sao lưu (chỉ quản trị, chạy trọn gói một lần)
create or replace function public.khoi_phuc(payload jsonb) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.la_quan_tri() then
    raise exception 'Cần tài khoản quản trị';
  end if;
  if jsonb_typeof(payload -> 'programs') is distinct from 'array'
     or jsonb_typeof(payload -> 'doanhnghiep') is distinct from 'array' then
    raise exception 'File không đúng định dạng (cần programs và doanhnghiep)';
  end if;
  delete from public.programs where true;
  delete from public.doanhnghiep where true;
  insert into public.programs (id, data)
    select x ->> 'id', x from jsonb_array_elements(payload -> 'programs') x;
  insert into public.doanhnghiep (id, data)
    select x ->> 'id', x from jsonb_array_elements(payload -> 'doanhnghiep') x;
  return json_build_object(
    'programs', (select count(*) from public.programs),
    'doanhnghiep', (select count(*) from public.doanhnghiep));
end $$;
revoke execute on function public.khoi_phuc(jsonb) from anon;

-- 5. Bật cập nhật trực tiếp (Realtime) cho hai bảng dữ liệu
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'programs') then
    alter publication supabase_realtime add table public.programs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'doanhnghiep') then
    alter publication supabase_realtime add table public.doanhnghiep;
  end if;
end $$;

-- 6. Thêm tài khoản quản trị đầu tiên — SỬA EMAIL rồi chạy (có thể chạy lại để thêm người khác)
-- insert into public.thanh_vien (email, ho_ten, quan_tri) values ('email-cua-ban@gmail.com', 'Tên của bạn', true)
--   on conflict (email) do update set ho_ten = excluded.ho_ten, quan_tri = excluded.quan_tri;
