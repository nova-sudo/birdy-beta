"use client";

import { usePlatformStats } from "@/lib/admin-api";
import StatsPanel from "@/components/admin/StatsPanel";

export default function AdminStatsPage() {
  const { data: statsData, isLoading: statsLoading } = usePlatformStats();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-[#1F1B33]">Platform stats</h2>
        <p className="text-sm text-muted-foreground">
          Agencies, active users, sub-accounts, and AI usage over time.
        </p>
      </div>

      <StatsPanel data={statsData} loading={statsLoading} />
    </div>
  );
}
