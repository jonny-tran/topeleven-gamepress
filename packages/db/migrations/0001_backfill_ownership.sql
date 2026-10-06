-- ============================================================================
-- Backfill sở hữu giải đấu + vai trò tài khoản
-- ============================================================================
-- Chạy MỘT LẦN sau khi đã `bun run db:push` (để cột user.role và
-- tournament.owner_id tồn tại trong DB).
--
-- Bối cảnh: trước đây hệ thống chỉ có một quản trị viên và bảng `tournament`
-- không lưu ai là chủ. Bản vá này gán sở hữu cho các giải đã tồn tại và nâng
-- tài khoản quản trị lên role = 'admin'.
--
-- Cách chạy:
--   psql "$DATABASE_URL" -f packages/db/migrations/0001_backfill_ownership.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Nâng tài khoản quản trị lên admin.
-- ----------------------------------------------------------------------------
-- Mặc định: tài khoản cũ nhất trong hệ thống chính là quản trị viên.
-- Nếu bạn muốn chỉ định tài khoản khác, dùng bản mẫu có sẵn bên dưới.
--
--   UPDATE "user" SET role = 'admin' WHERE email = 'ban.toc.chuc@tenmien.com';
--
UPDATE "user"
SET role = 'admin'
WHERE id = (
    SELECT id FROM "user" ORDER BY "created_at" ASC LIMIT 1
  )
  AND role <> 'admin';

-- ----------------------------------------------------------------------------
-- 2. Gán chủ sở hữu cho các giải đang tồn tại.
-- ----------------------------------------------------------------------------
-- Gán cho chính admin trong bước 1 — tức là người đang vận hành hệ thống.
-- Sau đó dùng `tournament.transferOwner` trên web để trao giải cho đúng
-- người, hoặc sửa tay cột này nếu muốn chia ngay từ đầu.
--
--   UPDATE tournament SET owner_id = '<user-id>' WHERE name LIKE '...';

UPDATE tournament
SET owner_id = (
    SELECT id FROM "user" WHERE role = 'admin' ORDER BY "created_at" ASC LIMIT 1
  )
WHERE owner_id IS NULL
  AND EXISTS (SELECT 1 FROM "user" WHERE role = 'admin');

COMMIT;

-- ----------------------------------------------------------------------------
-- Kiểm tra kết quả
-- ----------------------------------------------------------------------------
-- SELECT id, name, owner_id FROM tournament ORDER BY "created_at" DESC;
-- SELECT id, email, role FROM "user" ORDER BY "created_at" ASC;

-- ----------------------------------------------------------------------------
-- Thêm admin mới trong tương lai (không cần sửa code):
--   UPDATE "user" SET role = 'admin' WHERE email = 'moi@tenmien.com';
--
-- Cột `user.role` là nguồn quyền chính. Biến môi trường ADMIN_EMAILS vẫn
-- được hỗ trợ như chốt cửa dự phòng: email có trong danh sách đó sẽ được coi
-- là admin dù role trong DB là 'user'. Danh sách RỖNG không còn nghĩa là "mọi
-- người đều là admin" như trước đây.
-- ----------------------------------------------------------------------------