# Design System — topEleven-gamepress

> **File nguồn:** `packages/ui/src/styles/globals.css` (tokens) · `packages/ui/src/components/` (components)

---

## 1. Phong Cách Thiết Kế

| Thuộc tính | Giá trị |
|---|---|
| Phong cách | Sporty Bold — tham chiếu ESPN / SofaScore |
| Màu nhận diện (brand) | Emerald (`--primary`) — màu sân cỏ |
| Bảng màu | Emerald primary + semantic sport colors (success/warning/info/destructive) |
| Layout | Hybrid: top header cho user · sidebar cho admin (`/admin/*`) |
| Typography | Inter Variable, 1 weight bold heading |
| Radius | Nhỏ, sắc nét (`--radius: 0.5rem`) — phong cách thể thao |
| Dark mode | Đầy đủ, tự động qua `next-themes` |

---

## 2. Màu Sắc (Design Tokens)

### 2.1 Brand Primary — Emerald

```
--primary (light): oklch(0.55 0.18 155)
--primary (dark):  oklch(0.72 0.18 155)
--primary-foreground: oklch(0.99 0.005 155) / oklch(0.16 0.025 165)
```

### 2.2 Semantic Sport Colors

| Token | Mục đích | Ví dụ |
|---|---|---|
| `--success` | Thẻ xanh · đội thắng · điểm | Phân nhóm thắng, kết quả tích cực |
| `--warning` | Thẻ vàng · cảnh cáo | Trạng thái chưa bắt đầu, pending |
| `--info` | Thông tin · xanh dương | Links, badge thông tin |
| `--destructive` | Thẻ đỏ · lỗi | Xóa, từ chối |

### 2.3 Surface Scale

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.99 …)` | `oklch(0.16 …)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.21 …)` |
| `--muted` | `oklch(0.96 …)` | `oklch(0.25 …)` |
| `--border` | `oklch(0.9 …)` | `oklch(1 0 0 / 10%)` |

---

## 3. Components

> **Import:** `import { ComponentName } from "@topEleven-gamepress/ui/components/component-name"`

### 3.1 Button

`button.tsx` · Dùng Base UI primitive + CVA

| Variant | Mô tả |
|---|---|
| `default` | Nền `--primary`, chữ trắng (dùng cho CTA chính) |
| `outline` | Viền `--border`, nền trong (dùng cho hành động phụ) |
| `secondary` | Nền `--secondary` |
| `ghost` | Hover → nền `--muted` |
| `destructive` | Nền đỏ nhạt, chữ đỏ |
| `link` | Text link |

| Size | Chiều cao |
|---|---|
| `xs` | 24px |
| `sm` | 28px |
| `default` | 32px |
| `lg` | 36px |
| `icon`, `icon-sm`, `icon-xs`, `icon-lg` | Vuông |

### 3.2 Badge

`badge.tsx` · Status chip cho trạng thái giải đấu, pot, bảng

| Variant | Mục đích | Ví dụ |
|---|---|---|
| `default` | Nền muted | Tag phụ |
| `primary` | Nền primary nhạt | Đội hạt giống |
| `success` | Thẻ xanh | Trạng thái thắng |
| `warning` | Thẻ vàng | Pending / chưa bắt đầu |
| `destructive` | Thẻ đỏ | Trạng thái lỗi |
| `outline` | Viền, trong | Tag không nhấn mạnh |
| Sizes: `default` (20px) · `sm` (16px) |

```tsx
// Ví dụ: trạng thái pot
<Badge variant="primary">Pot 1</Badge>
<Badge variant="success">Đã gán</Badge>
<Badge variant="warning">Chờ bốc</Badge>
```

### 3.3 Card

`card.tsx` · Dùng `--card-spacing` CSS variable (4px default, 3px khi `size="sm"`)

Các slot: `card`, `card-header`, `card-title`, `card-description`, `card-action`, `card-content`, `card-footer`.

### 3.4 Tabs

`tabs.tsx` · Base UI Tabs với underline style

- Active tab: `text-foreground` + `border-b-2 border-primary`
- Indicator: thanh `--primary` dưới tab hiện tại

```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Bảng A</TabsTrigger>
    <TabsTrigger value="tab2">Bảng B</TabsTrigger>
    <TabsIndicator />
  </TabsList>
  <TabsPanel value="tab1">...</TabsPanel>
</Tabs>
```

### 3.5 Tooltip

`tooltip.tsx` · Base UI Tooltip, bọc trong `TooltipProvider`

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger><Icon /></TooltipTrigger>
    <TooltipPopup>Mô tả</TooltipPopup>
  </Tooltip>
</TooltipProvider>
```

### 3.6 Drawer

`drawer.tsx` · Dùng cho admin sidebar trên mobile

```tsx
<Drawer open={open} onOpenChange={setOpen}>
  <DrawerTrigger render={<Button />}>Mở menu</DrawerTrigger>
  <DrawerBackdrop />
  <DrawerPanel side="left">
    <DrawerHeader>
      <DrawerTitle>Admin</DrawerTitle>
      <DrawerClose />
    </DrawerHeader>
    <DrawerContent>
      {/* nav links */}
    </DrawerContent>
  </DrawerPanel>
</Drawer>
```

### 3.7 ScrollArea

`scroll-area.tsx` · Custom scrollbar styled theo theme

```tsx
<ScrollArea className="h-[200px]">
  <div>...</div>
</ScrollArea>
```

### 3.8 Separator

`separator.tsx` · Viền ngang/dọc

```tsx
<Separator />               {/* horizontal, full width */}
<Separator orientation="vertical" className="h-6" />
```

### 3.9 Breadcrumb

`breadcrumb.tsx` · Navigation trail cho trang chi tiết

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/admin/tournaments">Giải đấu</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>World Cup 2026</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## 4. Utility Classes (CSS)

Định nghĩa trong `@layer components` trong `globals.css`:

| Class | Mô tả |
|---|---|
| `.cn-section-title` | Tiêu đề phụ — `text-[11px] bold uppercase tracking-wide text-muted-foreground` |
| `.cn-stat-number` | Số liệu lớn — font-mono, bold, tabular-nums |
| `.cn-pill` | Pill nhỏ — rounded-full border |
| `.cn-page` | Container chuẩn — `max-w-7xl mx-auto px-4 py-6` |
| `.cn-admin-header` | Header sticky của admin — blur, border-b |
| `.cn-card-hover` | Hover card — border-primary/30 + shadow |
| `.bg-brand-gradient` | Gradient brand — linear 135deg emerald |

---

## 5. Layout Mẫu

### 5.1 Admin Page Layout (có Sidebar)

```tsx
// apps/web/src/app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <div className="flex h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r">
        <AdminNav />
      </aside>
      {/* Mobile drawer */}
      <Drawer>
        <DrawerTrigger>Menu</DrawerTrigger>
        <DrawerBackdrop />
        <DrawerPanel side="left">
          <AdminNav />
        </DrawerPanel>
      </Drawer>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

### 5.2 Public Page Layout

```tsx
// Header + main content (dùng header.tsx hiện có)
<div className="grid grid-rows-[auto_1fr] h-svh">
  <Header />
  <main className="cn-page overflow-y-auto">
    {children}
  </main>
</div>
```

---

## 6. Quy Tắc Đặt Tên & Convention

### 6.1 File component
- File: `kebab-case.tsx` (ví dụ: `scroll-area.tsx`)
- Export name: `PascalCase` (ví dụ: `export { ScrollArea }`)

### 6.2 `data-slot`
Mọi component phải có `data-slot="component-name"` trên root element để CSS targeting và debugging.

### 6.3 CVA (Class Variance Authority)
Dùng `cva()` cho các variant của Button, Badge. Mỗi variant là một object key.

### 6.4 Base UI primitives
Component phức tạp (Tabs, Drawer, Tooltip) nên wrap Base UI primitives. Các wrapper phải:
- Forward refs
- Hỗ trợ `className` prop
- Pass qua `{...props}` để Base UI xử lý

### 6.5 Dark mode
Dùng `@custom-variant dark (&:is(.dark *))` của Tailwind v4. Class `dark:` prefix vẫn hoạt động.

---

## 7. Lịch Sử Thay Đổi

| Ngày | Thay đổi |
|---|---|
| 2026-09-09 | Khởi tạo design system: emerald brand + sporty bold + hybrid layout |

