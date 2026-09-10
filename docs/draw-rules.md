# Quy Tắc Bốc Thăm Vòng Bảng

> **File nguồn:** `packages/db/src/utils/draw.ts` (logic) + `packages/api/src/routers/draw.ts` (API + state reconstruction)

---

## 1. Tổng Quan

Giải đấu có **6 bảng (A–F)** và **24 đội** chia đều vào 4 nhóm hạt giống (Pot 1–4), mỗi Pot chứa 6 đội. Mỗi bảng gồm đúng 4 đội — mỗi Pot cung cấp đúng 1 đội cho mỗi bảng.

---

## 2. Nguyên Tắc Bốc Thăm

### 2.1 Thứ tự bốc (Group-First)

Vòng lặp **ngoài** là **Bảng**; vòng lặp **trong** là **Pot**.

```
Bảng A:  Pot 1 → Pot 2 → Pot 3 → Pot 4
Bảng B:  Pot 1 → Pot 2 → Pot 3 → Pot 4
Bảng C:  Pot 1 → Pot 2 → Pot 3 → Pot 4
Bảng D:  Pot 1 → Pot 2 → Pot 3 → Pot 4
Bảng E:  Pot 1 → Pot 2 → Pot 3 → Pot 4
Bảng F:  Pot 1 → Pot 2 → Pot 3 → Pot 4  ← tự động điền
```

Tổng cộng: **20 thao tác bốc thủ công** (bảng A–E × 4 pot) + **4 thao tác tự động** (bảng F).

### 2.2 Vị trí hiện tại (State Machine)

Hệ thống tính vị trí hiện tại dựa trên **số đội đã gán**:

| Số đội gán rồi (N) | Bảng hiện tại | Pot hiện tại |
|---------------------|--------------|--------------|
| 0                   | A            | 1            |
| 1, 2, 3             | A            | 2, 3, 4      |
| 4                   | B            | 1            |
| 5, 6, 7             | B            | 2, 3, 4      |
| …                   | …            | …            |
| 17, 18, 19          | E            | 2, 3, 4      |
| 20                   | F (auto)     | 1            |
| 21, 22, 23          | F (auto)     | 2, 3, 4      |
| 24                   | — (hoàn tất) | —            |

**Công thức:**

```
groupIndex = min(floor(N / 4), 5)   // 0 = A … 5 = F
pot        = (N % 4) + 1            // 1, 2, 3, 4
```

### 2.3 Luật Xung Đột Liên Đoàn

> **Hai đội cùng liên đoàn (`associationCode`) không được nằm cùng một bảng.**

- **Bảng A–E:** khi bốc một đội, hệ thống kiểm tra đội đó có cùng `associationCode` với đội nào đã có trong bảng không. Nếu có → đội đó **bị bỏ qua**, chọn đội hợp lệ tiếp theo (ngẫu nhiên từ danh sách đã xáo).
- **Bảng F:** sau khi A–E hoàn tất, mỗi pot chỉ còn lại đúng 1 đội. Không cần kiểm tra xung đột vì tất cả đội còn lại đều thuộc liên đoàn khác với mọi đội đã ở F.

### 2.4 Auto-Fill Bảng F

- Khi bắt đầu bốc đội thứ 21 (`groupIndex = 5`, `pot = 1`), hệ thống tự động chọn một đội ngẫu nhiên từ Pot 1 còn lại mà **không kiểm tra xung đột liên đoàn**.
- UI hiển thị thông báo *"Hệ thống đang tự động điền Bảng F"* và **ẩn nút Bốc thủ công**.
- Sau mỗi lần chọn, hệ thống tự động gọi bước tiếp theo cho đến khi Bảng F đủ 4 đội.

---

## 3. Thuật Toán

### 3.1 Shuffle

Dùng **Fisher-Yates shuffle** để xáo trộn ngẫu nhiên danh sách đội hợp lệ trước khi chọn.

### 3.2 Một Bước Bốc (`performDrawStep`)

```
Input: state + teamId được chọn
1. Tìm đội trong remainingByPot[pot] theo teamId
2. Nếu là Bảng F → bỏ qua bước kiểm tra xung đột
   Nếu là Bảng A–E → kiểm tra associationCode có trùng không
     → có xung đột → trả lỗi
3. Cập nhật:
     - Gỡ đội khỏi remainingByPot[pot]
     - Thêm đội vào groups[groupCode]
     - Thêm vào assignedTeams
4. Tính vị trí tiếp theo:
     Nếu bảng hiện tại đã có đủ 4 đội:
       → groupIndex + 1, pot = 1
     Ngược lại:
       → giữ nguyên groupIndex, pot + 1
5. Nếu groupIndex ≥ 6 → isComplete = true
```

### 3.3 Auto Pick (`autoPickTeam`)

```
Input: state hiện tại
1. Nếu isComplete → trả null
2. Nếu là Bảng F:
     - Lấy toàn bộ remaining[pot]
     - Shuffle → chọn đội đầu tiên
     - Gọi performDrawStep
3. Nếu là Bảng A–E:
     - Lọc validTeams = remaining[pot] trừ các đội trùng associationCode
     - Nếu validTeams rỗng → trả lỗi "không có đội hợp lệ"
     - Shuffle validTeams → chọn đội đầu tiên
     - Gọi performDrawStep
```

---

## 4. API Endpoints (tRPC)

### `draw.getState`

- **Quyền:** public
- **Input:** `{ tournamentId: string }`
- **Output:** `DrawStateDTO` + `{ started: boolean }`
- **Mô tả:** Trả trạng thái bốc thăm hiện tại. Nếu chưa bắt đầu → `started: false`. Nếu hoàn tất → `isComplete: true`. Nếu đang tiến hành → tái tạo state từ DB.

### `draw.shufflePot`

- **Quyền:** admin
- **Input:** `{ tournamentId: string }`
- **Output:** `{ pot, teams, currentGroupCode, stepDescription }`
- **Mô tả:** Xáo trộn thứ tự hiển thị các đội trong pot hiện tại để hiển thị trên UI (không thay đổi trạng thái bốc thăm).

### `draw.autoPick`

- **Quyền:** admin
- **Input:** `{ tournamentId: string }`
- **Output:** `{ success, drawnTeam, state, skipped, isComplete }`
- **Mô tả:** Chọn ngẫu nhiên một đội hợp lệ, cập nhật DB và trả state mới. Khi bước tiếp theo là Bảng F, hệ thống auto-fill liên tục cho đến khi hoàn tất.

### `draw.confirmDraw`

- **Quyền:** admin
- **Input:** `{ tournamentId: string }`
- **Output:** `{ success, matchesCreated }`
- **Mô tả:** Xác nhận kết quả bốc thăm, tạo lịch thi đấu vòng bảng, cập nhật `tournament.status = "draw_completed"`.

### `draw.resetDraw`

- **Quyền:** admin
- **Input:** `{ tournamentId: string }`
- **Output:** `{ success }`
- **Mô tả:** Xóa toàn bộ phân bảng (`groupId`, `position`), xóa lịch thi đấu vòng bảng, đặt `tournament.status = "setup"`.

### `draw.undoLastDraw`

- **Quyền:** admin
- **Input:** `{ tournamentId: string }`
- **Output:** `{ success, undoneTeam: { id, name, associationCode, groupCode, position, pot } }`
- **Mô tả:** Hoàn tác đúng một lượt bốc cuối cùng theo thứ tự Group-First (A1 → A2 → ... → F4). Tìm đội ở `groupIndex = floor((N-1) / 4)`, `position = ((N-1) % 4) + 1` và set `groupId = NULL`, `position = NULL`. Sau khi undo, hệ thống tự recompute state và admin có thể bấm BỐC THĂM để thử lại.
- **Từ chối** khi: `status = "setup"` (chưa bốc gì), `status = "draw_completed"` (đã xác nhận → phải dùng `resetDraw`).
- **Trường hợp dùng:** deadlock tại Bảng A–E khi toàn bộ đội còn lại trong pot hiện tại đều trùng `associationCode` với đội đã có trong bảng đó. Hoàn tác lượt cuối thường giải phóng một đội hợp lệ trong pot (vì đội vừa undo rời bảng).

---

## 5. UI / Giao Diện

### 5.1 Luồng người dùng

```
Trang Bốc Thăm
│
├─ [Bảng A–E] Hiển thị danh sách đội trong pot → user bấm "BỐC NGAY"
│                 → hệ thống shuffle + pick đội hợp lệ → cập nhật bảng
│
├─ [Chuyển pot] Sau mỗi lần bốc → auto shuffle pot tiếp theo để hiển thị
│
├─ [Chuyển bảng] Khi bảng đủ 4 đội → chuyển sang bảng tiếp theo, pot reset về 1
│
└─ [Bảng F] UI hiển thị trạng thái "đang tự động điền" → hệ thống auto-fill
              cho đến khi đủ 4 đội → bốc thăm hoàn tất
```

### 5.2 Progress hiển thị

- Thanh tiến trình tổng: `N/24 đội`
- Sub-progress per pot: `drawn/6 đã rút`
- Header trạng thái: `Bảng X → Pot Y` hoặc `Tự động điền Bảng F → Pot Y`

### 5.3 Hiển thị đội

Mỗi đội hiển thị: `Tên đội` + `(Mã liên đoàn · Pot N)`

---

## 6. Cấu Trúc Dữ Liệu

### `DrawState`

| Trường              | Kiểu                     | Mô tả |
|---------------------|--------------------------|-------|
| `currentGroupIndex` | `number` (0–5)           | Chỉ số bảng hiện tại |
| `currentPot`        | `number` (1–4)          | Pot hiện tại |
| `assignedTeams`      | `Team[]`                 | Danh sách đội đã gán |
| `remainingByPot`    | `Map<number, Team[]>`    | Đội còn lại theo từng pot |
| `groups`            | `Map<string, Team[]>`    | Đội đã gán theo từng bảng |
| `isComplete`        | `boolean`                | Đã bốc xong chưa |

### `DrawStateDTO` (serializable, gửi về client)

| Trường | Mô tả |
|--------|-------|
| `currentGroupCode`  | Mã bảng hiện tại ("A"…"F") |
| `currentPosition`   | Vị trí tiếp theo trong bảng (1–4) |
| `validTeamsForCurrentGroup` | Đội hợp lệ trong pot hiện tại |
| `conflictingTeamsForCurrentGroup` | Đội bị xung đột trong pot |
| `groups`            | Map bảng → danh sách đội đã gán |
| `remainingByPot`    | Map pot → danh sách đội chưa gán |
| `canProceed`        | Có thể tiếp tục bốc không |
| `currentStepDescription` | Chuỗi mô tả bước hiện tại |

---

## 7. Quy Tắc Mở Rộng Trong Tương Lai

Khi thêm tính năng mới, cần cập nhật tài liệu này. Các vấn đề cần xem xét:

### 7.1 Thêm giới hạn xung đột khác
- Hiện tại chỉ có `associationCode` là ràng buộc. Nếu thêm ràng buộc mới (ví dụ: khu vực địa lý), cần thêm trường vào schema `Team` và cập nhật `findValidTeam` / `getValidTeamsForGroup`.

### 7.2 Số lượng bảng/pot thay đổi
- `GROUP_CODES = ["A","B","C","D","E","F"]` và `POT_NUMBERS = [1,2,3,4]` là hằng số toàn cục. Nếu thay đổi số bảng hoặc số pot, cần cập nhật cả công thức tính state machine và UI.

### 7.3 Hoàn tác một bước (Undo)
- **Đã hỗ trợ** `draw.undoLastDraw`: gỡ đúng đội bốc cuối cùng theo công thức Group-First (xem mục 4).
- Khi gặp deadlock ở Bảng A–E (toàn bộ pot hiện tại xung đột với đội đã có trong bảng), admin bấm **Hoàn tác** → đội cuối rời bảng → re-shuffle → có thể bốc tiếp với đội khác. Có thể undo nhiều lần liên tiếp nếu vẫn kẹt.
- Bị từ chối sau khi `confirmDraw` đã chạy (status = `draw_completed`); admin phải dùng `resetDraw` rồi bốc lại từ đầu.
- Không lưu lịch sử undo vào DB — chỉ áp dụng cho lượt ngay trước đó.

### 7.4 Tính năng "Seeded Draw" (bắt buộc một đội vào một bảng nhất định)
- Hiện tại tất cả đều random. Để cố định một số đội vào bảng trước, cần thêm trường `forcedGroup` vào schema `Team` và lọc bỏ các đội đó khỏi pool trước khi bốc.

### 7.5 Đa ngôn ngữ (i18n)
- Tất cả chuỗi mô tả bước bốc (`describeCurrentStep`, thông báo lỗi) hiện đang hard-coded tiếng Việt. Cân nhắc đưa vào file i18n khi mở rộng.

### 7.6 Trực quan hóa động
- Khi thêm animation cho quả bóng rơi vào bảng, cần tách logic `autoPick` thành 2 bước: chọn đội (server) → animation (client) → xác nhận (server).

---

## 8. Lịch Sử Thay Đổi

| Ngày       | Phiên bản | Thay đổi |
|------------|-----------|-----------|
| 2026-09-09 | v1.0      | Ban hành nguyên tắc Group-First với auto-fill Bảng F |

