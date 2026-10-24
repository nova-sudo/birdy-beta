"use client";

import { usePlatformStats } from "@/lib/admin-api";
import AdminHeader from "@/components/admin/AdminHeader";
import StatsPanel from "@/components/admin/StatsPanel";

export default function AdminStatsPage() {
  const { data: statsData, error: statsError, isLoading: statsLoading, mutate: refetchStats } = usePlatformStats();

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="Platform stats"
        description="Agencies, active users, sub-accounts, and AI usage over time."
      />

      <StatsPanel data={statsData} loading={statsLoading} error={statsError} onRetry={() => refetchStats()} />
    </div>
  );
}
