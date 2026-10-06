import { useForm } from "@tanstack/react-form";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Label } from "@topEleven-gamepress/ui/components/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            // Người mới đăng ký sẽ có role = "user". Đi thẳng vào form tạo
            // giải đấu đầu tiên — giải đó sẽ tự gán `ownerId = <bản thân>`
            // nên đăng ký chính là cách để trở thành "chủ giải đấu" tạm thời.
            // Sau này admin toàn cục có thể chuyển quyền sang tài khoản khác.
            toast.success("Đăng ký thành công — bạn đã có thể tạo giải đấu!");
            router.push("/admin/tournaments/new");
          },
          onError: (error) => {
            // better-auth trả cùng mã lỗi chung cho mọi trường hợp đăng ký
            // thất bại (email trùng, mật khẩu yếu, …). Thông báo chung.
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
        email: z.string().min(1, "Email không được để trống").email("Email không hợp lệ"),
        password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
      }),
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Tạo Tài Khoản</CardTitle>
          <CardDescription>Đăng ký tài khoản quản trị mới</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <div>
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Tên</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-xs text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Email</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="admin@example.com"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-xs text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Mật khẩu</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-xs text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Subscribe
              selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Đang xử lý..." : "Đăng Ký"}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Đã có tài khoản? </span>
            <Button
              variant="link"
              onClick={onSwitchToSignIn}
              className="p-0 h-auto text-sm font-medium text-primary"
            >
              Đăng Nhập
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
