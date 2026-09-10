"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Label } from "@topEleven-gamepress/ui/components/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, LogIn, User } from "lucide-react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/utils/trpc";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checkedEmail, setCheckedEmail] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);

      // Check if email exists first (only if not already checked for this email)
      if (checkedEmail !== value.email) {
        try {
          const result = await trpcClient.checkEmail.query({ email: value.email });
          if (!result.exists) {
            toast.error("Email không tồn tại. Vui lòng kiểm tra lại hoặc đăng ký tài khoản mới.");
            setIsLoading(false);
            return;
          }
          setCheckedEmail(value.email);
        } catch {
          // If check fails, still try sign-in
          setCheckedEmail(value.email);
        }
      }

      // Now attempt sign-in
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            toast.success("Đăng nhập thành công");
            router.push("/admin/tournaments");
          },
          onError: (error) => {
            // Since we verified email exists, this must be the password
            if (
              error.error.statusText === "Unauthorized" ||
              error.error.code === "INVALID_EMAIL_OR_PASSWORD"
            ) {
              toast.error("Mật khẩu không chính xác. Vui lòng thử lại.");
            } else {
              toast.error(error.error.message || error.error.statusText);
            }
            setIsLoading(false);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.string().min(1, "Email không được để trống").email("Email không hợp lệ"),
        password: z.string().min(1, "Mật khẩu không được để trống"),
      }),
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Chào Mừng Trở Lại</CardTitle>
          <CardDescription>Nhập thông tin đăng nhập để truy cập tài khoản</CardDescription>
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
            <div className="space-y-2">
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={field.name} className="text-sm font-medium">
                        Email
                      </Label>
                    </div>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="admin@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        setCheckedEmail(null);
                        field.handleChange(e.target.value);
                      }}
                      className="h-10"
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

            <div className="space-y-2">
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={field.name} className="text-sm font-medium">
                        Mật khẩu
                      </Label>
                    </div>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      placeholder="••••••••"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="h-10"
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
                <Button
                  type="submit"
                  className="h-10 w-full gap-2"
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Đang đăng nhập...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Đăng Nhập
                    </>
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Chưa có tài khoản? </span>
            <Button variant="link" onClick={onSwitchToSignUp} className="p-0 h-auto text-sm font-medium text-primary">
              Đăng Ký
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
