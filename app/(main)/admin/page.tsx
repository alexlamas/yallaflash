"use client";

import { useState, useEffect } from "react";
import { Loader2, Users, BookOpen, PenLine, TrendingUp, Flame, Clock, Activity } from "lucide-react";

interface RetentionPoint {
  cohortSize: number;
  returned: number;
  rate: number;
}

interface AdminStats {
  wau: number;
  wauChange: number;
  signupsThisWeek: number;
  signupsLastWeek: number;
  reviewsThisWeek: number;
  reviewsLastWeek: number;
  customWordsThisWeek: number;
  customWordsLastWeek: number;
  totalUsers: number;
  totalReviews: number;
  totalCustomWords: number;
  dauToday: number;
  mau: number;
  stickiness: number;
  dauTrend: { date: string; count: number }[];
  activation: {
    windowDays: number;
    signups: number;
    onboarded: number;
    firstReview: number;
    multiDay: number;
  };
  retention: { day1: RetentionPoint; day7: RetentionPoint; day30: RetentionPoint };
  medianTimeToFirstReviewHours: number | null;
}

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  const changePercent = change !== undefined && change !== 0
    ? Math.round(((value - change) / (change || 1)) * 100)
    : 0;
  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;

  return (
    <div className="bg-white border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        {change !== undefined && changePercent !== 0 && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isPositive ? "bg-emerald-100 text-emerald-700" :
            isNegative ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-600"
          }`}>
            {isPositive ? "+" : ""}{changePercent}%
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-gray-900 mb-1">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : value.toLocaleString()}
      </div>
      <div className="text-sm text-gray-500">{title}</div>
      {changeLabel && change !== undefined && (
        <div className="text-xs text-gray-400 mt-1">
          vs {change.toLocaleString()} {changeLabel}
        </div>
      )}
    </div>
  );
}

function FunnelStep({
  label,
  count,
  total,
  loading,
}: {
  label: string;
  count: number;
  total: number;
  loading?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-white border rounded-2xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-xl font-semibold text-gray-900">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : count.toLocaleString()}
        </div>
        {!loading && total > 0 && (
          <div className="text-xs text-gray-500">{pct}%</div>
        )}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RetentionCard({
  label,
  point,
  loading,
}: {
  label: string;
  point?: RetentionPoint;
  loading?: boolean;
}) {
  const pct = point ? Math.round(point.rate * 100) : 0;
  const tone = pct >= 40 ? "text-emerald-700" : pct >= 20 ? "text-amber-700" : "text-red-700";
  return (
    <div className="bg-white border rounded-2xl p-5">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${pct}%`}
      </div>
      {point && !loading && (
        <div className="text-xs text-gray-500 mt-1">
          {point.returned} / {point.cohortSize} returned
        </div>
      )}
    </div>
  );
}

function DauSparkline({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="bg-white border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">DAU — last 14 days</div>
        <div className="text-xs text-gray-400">max {max}</div>
      </div>
      <div className="flex items-end gap-1 h-20">
        {data.map(d => {
          const h = (d.count / max) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 bg-gray-900 rounded-sm transition-all"
              style={{ height: `${Math.max(h, 4)}%`, opacity: d.count === 0 ? 0.15 : 1 }}
              title={`${d.date}: ${d.count}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to load admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const ttfr = stats?.medianTimeToFirstReviewHours;
  const ttfrLabel = ttfr === null || ttfr === undefined
    ? "—"
    : ttfr < 1
      ? `${Math.round(ttfr * 60)}m`
      : ttfr < 48
        ? `${ttfr.toFixed(1)}h`
        : `${(ttfr / 24).toFixed(1)}d`;

  return (
    <div className="p-4 pt-12 max-w-4xl mx-auto pb-20">
      <h1 className="text-lg font-semibold mb-6">Summary</h1>

      {/* This week's activity */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">This week</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Active users"
            value={stats?.wau ?? 0}
            change={stats?.wauChange}
            changeLabel="last week"
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            title="Sign ups"
            value={stats?.signupsThisWeek ?? 0}
            change={stats?.signupsLastWeek}
            changeLabel="last week"
            icon={TrendingUp}
            loading={isLoading}
          />
          <StatCard
            title="Reviews"
            value={stats?.reviewsThisWeek ?? 0}
            change={stats?.reviewsLastWeek}
            changeLabel="last week"
            icon={BookOpen}
            loading={isLoading}
          />
          <StatCard
            title="Words added"
            value={stats?.customWordsThisWeek ?? 0}
            change={stats?.customWordsLastWeek}
            changeLabel="last week"
            icon={PenLine}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Engagement */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard
            title="DAU today"
            value={stats?.dauToday ?? 0}
            icon={Activity}
            loading={isLoading}
          />
          <StatCard
            title="MAU (30d)"
            value={stats?.mau ?? 0}
            icon={Users}
            loading={isLoading}
          />
          <div className="bg-white border rounded-2xl p-5">
            <div className="flex items-start mb-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {isLoading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : `${Math.round((stats?.stickiness ?? 0) * 100)}%`}
            </div>
            <div className="text-sm text-gray-500">Stickiness</div>
            <div className="text-xs text-gray-400 mt-1">DAU / MAU</div>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="flex items-start mb-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : ttfrLabel}
            </div>
            <div className="text-sm text-gray-500">Time to 1st review</div>
            <div className="text-xs text-gray-400 mt-1">median, 45d</div>
          </div>
        </div>
        {stats?.dauTrend && <DauSparkline data={stats.dauTrend} />}
      </div>

      {/* Activation funnel */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Activation funnel
          <span className="text-xs text-gray-400 ml-2">
            last {stats?.activation.windowDays ?? 45} days
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FunnelStep
            label="Signed up"
            count={stats?.activation.signups ?? 0}
            total={stats?.activation.signups ?? 0}
            loading={isLoading}
          />
          <FunnelStep
            label="Onboarded"
            count={stats?.activation.onboarded ?? 0}
            total={stats?.activation.signups ?? 0}
            loading={isLoading}
          />
          <FunnelStep
            label="Did 1+ review"
            count={stats?.activation.firstReview ?? 0}
            total={stats?.activation.signups ?? 0}
            loading={isLoading}
          />
          <FunnelStep
            label="Returned (2+ days)"
            count={stats?.activation.multiDay ?? 0}
            total={stats?.activation.signups ?? 0}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Retention cohorts */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Retention by signup day
          <span className="text-xs text-gray-400 ml-2">
            % of cohort active on day N after signup
          </span>
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <RetentionCard label="Day 1" point={stats?.retention.day1} loading={isLoading} />
          <RetentionCard label="Day 7" point={stats?.retention.day7} loading={isLoading} />
          <RetentionCard label="Day 30" point={stats?.retention.day30} loading={isLoading} />
        </div>
      </div>

      {/* All time totals */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">All time</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-2xl font-semibold text-gray-900">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalUsers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total users</div>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-2xl font-semibold text-gray-900">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalReviews.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total reviews</div>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-2xl font-semibold text-gray-900">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalCustomWords.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Custom words</div>
          </div>
        </div>
      </div>
    </div>
  );
}
