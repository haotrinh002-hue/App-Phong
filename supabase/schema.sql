-- =====================================================================
-- Quản lý Chương trình ITPC — cấu trúc CSDL trên Supabase
-- Chạy trong Supabase: SQL Editor → New query → dán toàn bộ → Run.
-- Chạy lại nhiều lần cũng không sao (không xóa dữ liệu). Khi có bản mới của file này, chạy lại là xong.
--
-- Tài khoản: người dùng tự đăng ký trên web → tự có dòng trong bảng thanh_vien với quyền "cho_duyet"
-- (chưa xem được gì). Quản trị cấp quyền trong tab "Thành viên" trên web.
-- Người đăng ký ĐẦU TIÊN tự trở thành quản trị.
-- =====================================================================

-- 1. Thành viên và quyền: cho_duyet (mới đăng ký) | xem | quan_tri | khoa (bị khóa)
create table if not exists public.thanh_vien (
  email      text primary key,
  ho_ten     text,
  quyen      text not null default 'cho_duyet',
  created_at timestamptz not null default now()
);
alter table public.thanh_vien add column if not exists quyen text not null default 'cho_duyet';
alter table public.thanh_vien add column if not exists created_at timestamptz not null default now();
-- Nâng cấp từ bản trước (cột quan_tri true/false)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'thanh_vien' and column_name = 'quan_tri') then
    update public.thanh_vien set quyen = case when quan_tri then 'quan_tri' else 'xem' end;
    alter table public.thanh_vien drop column quan_tri;
  end if;
end $$;
alter table public.thanh_vien drop constraint if exists thanh_vien_quyen_check;
alter table public.thanh_vien add constraint thanh_vien_quyen_check check (quyen in ('cho_duyet', 'xem', 'quan_tri', 'khoa'));
alter table public.thanh_vien enable row level security;

create or replace function public.email_hien_tai() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.la_thanh_vien() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where lower(email) = public.email_hien_tai() and quyen in ('xem', 'quan_tri'));
$$;

create or replace function public.la_quan_tri() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where lower(email) = public.email_hien_tai() and quyen = 'quan_tri');
$$;

-- Quản trị xem được mọi thành viên; mỗi người xem được dòng của chính mình (để biết khi được duyệt).
-- Không có policy sửa: quyền chỉ đổi qua hàm dat_quyen() bên dưới.
drop policy if exists xem_thanh_vien on public.thanh_vien;
create policy xem_thanh_vien on public.thanh_vien for select to authenticated
  using (public.la_quan_tri() or lower(email) = public.email_hien_tai());
revoke all on public.thanh_vien from anon;

-- Tự tạo dòng thành viên khi có người đăng ký
create or replace function public.tao_thanh_vien() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then return new; end if;
  insert into public.thanh_vien (email, ho_ten, quyen)
  values (lower(new.email),
          nullif(trim(new.raw_user_meta_data ->> 'ho_ten'), ''),
          case when exists (select 1 from public.thanh_vien where quyen = 'quan_tri') then 'cho_duyet' else 'quan_tri' end)
  on conflict (email) do nothing;
  return new;
end $$;
drop trigger if exists trg_tao_thanh_vien on auth.users;
create trigger trg_tao_thanh_vien after insert on auth.users
  for each row execute function public.tao_thanh_vien();

-- Tài khoản đã có trước khi chạy file này: thêm vào danh sách (chờ duyệt);
-- nếu chưa có quản trị nào thì người đăng ký sớm nhất là quản trị.
insert into public.thanh_vien (email, ho_ten, quyen, created_at)
  select lower(u.email), nullif(trim(u.raw_user_meta_data ->> 'ho_ten'), ''), 'cho_duyet', u.created_at
  from auth.users u where u.email is not null
  on conflict (email) do nothing;
update public.thanh_vien set quyen = 'quan_tri'
  where not exists (select 1 from public.thanh_vien where quyen = 'quan_tri')
    and lower(email) = (select lower(email) from auth.users where email is not null order by created_at limit 1);

-- Thông tin tài khoản đang đăng nhập
create or replace function public.toi_la_ai() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'email', public.email_hien_tai(),
    'ho_ten', (select ho_ten from public.thanh_vien where lower(email) = public.email_hien_tai()),
    'quyen', coalesce((select quyen from public.thanh_vien where lower(email) = public.email_hien_tai()), 'cho_duyet'),
    'thanh_vien', public.la_thanh_vien(),
    'quan_tri', public.la_quan_tri());
$$;

-- Tab "Thành viên": danh sách (chỉ quản trị)
drop function if exists public.danh_sach_thanh_vien();
create function public.danh_sach_thanh_vien()
returns table (email text, ho_ten text, quyen text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.la_quan_tri() then raise exception 'Cần tài khoản quản trị'; end if;
  return query
    select t.email, t.ho_ten, t.quyen, t.created_at, u.last_sign_in_at
    from public.thanh_vien t
    left join auth.users u on lower(u.email) = lower(t.email)
    order by case t.quyen when 'cho_duyet' then 0 when 'quan_tri' then 1 when 'xem' then 2 else 3 end, t.created_at desc;
end $$;

-- Tab "Thành viên": đổi quyền (chỉ quản trị; không tự hạ quyền của chính mình)
create or replace function public.dat_quyen(p_email text, p_quyen text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.la_quan_tri() then raise exception 'Cần tài khoản quản trị'; end if;
  if p_quyen not in ('cho_duyet', 'xem', 'quan_tri', 'khoa') then raise exception 'Quyền không hợp lệ: %', p_quyen; end if;
  if lower(p_email) = public.email_hien_tai() and p_quyen <> 'quan_tri' then
    raise exception 'Không thể tự hạ quyền của chính mình';
  end if;
  update public.thanh_vien set quyen = p_quyen where lower(email) = lower(p_email);
  if not found then raise exception 'Không tìm thấy tài khoản %', p_email; end if;
end $$;

revoke execute on function public.danh_sach_thanh_vien() from anon;
revoke execute on function public.dat_quyen(text, text) from anon;

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

-- 5. Bật cập nhật trực tiếp (Realtime)
do $$
declare t text;
begin
  foreach t in array array['programs', 'doanhnghiep', 'thanh_vien'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
