"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

/**
 * Người đang đăng nhập kèm quyền.
 *
 * Server trả về `null` khi khách chưa đăng nhập. Hook này CHỈ phục vụ mục đích
 * hiển thị giao diện (ẩn/hiện nút, đổi nhãn). Nó không phải hàng rào bảo mật —
 * mọi quyền thật đều được kiểm tra lại ở tầng API (`packages/api/src/access.ts`).
 * Nếu cố tắm bỏ hook này, người dùng chỉ thấy giao diện "sai" chứ không truy
 * cập được dữ liệu của người khác.
 */
export function useViewer() {
  const { data, isLoading, isFetching, error } = useQuery(
    trpc.tournament.viewer.queryOptions()
  );

  return {
    viewer: data ?? null,
    isAdmin: data?.isAdmin ?? false,
    isLoggedIn: !!data,
    isLoading: isLoading || isFetching,
    error,
  };
}