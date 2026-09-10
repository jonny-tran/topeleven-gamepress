import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import LoginFormWrapper from "@/components/login-form-wrapper";

/**
 * Login page — server component.
 * Đã sign-in → redirect thẳng vào /admin/tournaments.
 * Chưa sign-in → hiển thị form đăng nhập / đăng ký.
 */
export default async function LoginPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any)?.user) {
    redirect("/admin/tournaments");
  }

  return <LoginFormWrapper />;
}
