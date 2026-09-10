"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@topEleven-gamepress/ui/components/button";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Đăng xuất thành công");
          router.push("/login");
        },
        onError: (error) => {
          toast.error(error.error.message || "Đăng xuất thất bại");
        },
      },
    });
  };

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Đăng Xuất
    </Button>
  );
}
