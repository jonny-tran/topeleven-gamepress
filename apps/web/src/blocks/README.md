# shadcn/ui — Blocks tham khảo

Thư mục này chứa **source gốc** của các block lấy từ
[shadcn/ui](https://ui.shadcn.com/blocks) (style `base-lyra`, Base UI).

Mục đích: làm nguồn tham khảo để **copy → chỉnh sửa** khi dựng UI, thay vì viết
lại từ đầu.

> ⚠️ **Thư mục này không được compile.** `src/blocks` đã bị loại khỏi `tsconfig.json`
> (`exclude`) và không route nào import vào. Lý do: các block cần thêm dependency
> mà dự án chưa cài (danh sách bên dưới), nên nếu compile sẽ báo lỗi type.

## Có gì ở đây

| Block | Nội dung | Dependency cần thêm khi dùng |
| --- | --- | --- |
| `login-01` | form đăng nhập + page wrapper | – |
| `signup-01` | form đăng ký + page wrapper | – |
| `dashboard-01` | sidebar, biểu đồ, data table, section cards | `recharts`, `@tanstack/react-table`, `@dnd-kit/*` |

Import đã được sửa sẵn sang alias của dự án:

| shadcn mặc định | Dự án này |
| --- | --- |
| `@/components/ui/<x>` | `@topEleven-gamepress/ui/components/<x>` |
| `@/hooks/<x>` | `@topEleven-gamepress/ui/hooks/<x>` |
| `@/lib/utils` | `@topEleven-gamepress/ui/lib/utils` |
| `@/components/<x>` (cùng block) | `@/blocks/<block>/components/<x>` |

## Cách dùng

1. Copy file cần sang chỗ thật, ví dụ `apps/web/src/components/`.
2. Thêm dependency nếu block cần (xem bảng trên):
   ```bash
   bun add recharts @tanstack/react-table @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers @dnd-kit/utilities
   ```
3. Sửa nội dung cho hợp với dữ liệu của app (tournament, đội, trận...).
4. Xoá thư mục `src/blocks` khi không cần tham khảo nữa, hoặc bỏ `exclude` trong
   `tsconfig.json` nếu đã cài đủ dependency.

## Thêm block mới

Block của shadcn chỉ tồn tại cho style `base-lyra` ở 4 tên:
`sidebar-01`, `login-01`, `signup-01`, `dashboard-01`.

```bash
cd packages/ui
bunx shadcn add <tên-block> --yes --overwrite --cwd ../../.blocks-scratch
```

> **Lưu ý quan trọng:** phải chạy lệnh trên **từ `packages/ui`**. Nếu chạy từ thư
> mục khác, `bunx` sẽ gọi nhầm bản `shadcn-cli` cũ (v2) đã cài global, báo lỗi
> `Invalid configuration found`.
>
> Ngoài ra **không** chạy `shadcn add <block>` trực tiếp với `--cwd apps/web`:
> block sẽ ghi đè lên các page đang có (`app/dashboard/page.tsx`,
> `app/login/page.tsx`).
