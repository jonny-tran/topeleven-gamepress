"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trophy } from "lucide-react";

import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Label } from "@topEleven-gamepress/ui/components/label";

export default function NewTournamentPage() {
  const router = useRouter();
  const createTournament = useMutation(
    trpc.tournament.create.mutationOptions({
      onSuccess: (data: { id: string }) => {
        toast.success("Tạo giải đấu thành công!");
        router.push(`/admin/tournaments/${data.id}`);
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;
    const isoDate = new Date(startDate + "T00:00:00.000Z").toISOString();
    createTournament.mutate({ name: name.trim(), startDate: isoDate });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/admin/tournaments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tất cả giải đấu
      </Link>

      <div className="mb-6">
        <p className="cn-section-title">Khởi tạo</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Tạo Giải Đấu Mới
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          6 bảng (A–F) sẽ được tạo tự động. Bạn có thể nhập 24 đội ngay sau đó.
        </p>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/30">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="cn-section-title">Thông tin cơ bản</p>
              <p className="text-xs text-muted-foreground">
                Tên và ngày khởi tranh.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs font-bold">
                Tên giải đấu
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Giao Hữu Lạc Hồng 2026"
                className="mt-1.5 h-11 text-base"
                required
                maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="startDate" className="text-xs font-bold">
                Ngày khởi tranh
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 h-11 text-base"
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Các trận vòng bảng sẽ được sắp lịch vào các ngày trong tuần kể từ
                ngày này.
              </p>
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                type="submit"
                size="lg"
                disabled={
                  createTournament.isPending || !name.trim() || !startDate
                }
                className="px-8 font-bold shadow-md shadow-primary/20"
              >
                {createTournament.isPending ? "Đang tạo…" : "Tạo Giải Đấu"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => router.push("/admin/tournaments")}
              >
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
