import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type AuthUser = { id: string; created_at: string };

async function listAllUsers(adminClient: SupabaseClient): Promise<AuthUser[]> {
  const all: AuthUser[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    for (const u of users) {
      if (u.id && u.created_at) all.push({ id: u.id, created_at: u.created_at });
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin" && roleData?.role !== "reviewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Week boundaries
    const now = new Date();
    const startOfThisWeek = new Date(now);
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfThisWeek.setUTCDate(now.getUTCDate() - daysSinceMonday);
    startOfThisWeek.setUTCHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);

    // Activity window for retention/cohort/DAU calculations: last 45 days
    const activityWindowStart = daysAgo(45);

    // Fetch all auth users (paginated)
    const allUsers = await listAllUsers(adminClient);
    const totalUsers = allUsers.length;

    const signupsThisWeek = allUsers.filter(u => new Date(u.created_at) >= startOfThisWeek).length;
    const signupsLastWeek = allUsers.filter(u => {
      const created = new Date(u.created_at);
      return created >= startOfLastWeek && created < endOfLastWeek;
    }).length;

    // Activity data for retention window
    const { data: activityData } = await adminClient
      .from("word_progress")
      .select("user_id, updated_at")
      .gte("updated_at", activityWindowStart.toISOString());

    // Build per-user set of active days
    const userActiveDays = new Map<string, Set<string>>();
    // Track first ever activity per user
    const userFirstActivity = new Map<string, string>();
    for (const row of activityData || []) {
      if (!row.user_id || !row.updated_at) continue;
      const day = dayKey(row.updated_at);
      if (!userActiveDays.has(row.user_id)) userActiveDays.set(row.user_id, new Set());
      userActiveDays.get(row.user_id)!.add(day);

      const prev = userFirstActivity.get(row.user_id);
      if (!prev || row.updated_at < prev) {
        userFirstActivity.set(row.user_id, row.updated_at);
      }
    }

    // WAU = active on 2+ different days this week
    let wau = 0;
    let wauChange = 0;
    const thisWeekKey = dayKey(startOfThisWeek.toISOString());
    const lastWeekKey = dayKey(startOfLastWeek.toISOString());
    for (const days of userActiveDays.values()) {
      const thisWeekDays = Array.from(days).filter(d => d >= thisWeekKey);
      const lastWeekDays = Array.from(days).filter(d => d >= lastWeekKey && d < thisWeekKey);
      if (thisWeekDays.length >= 2) wau += 1;
      if (lastWeekDays.length >= 2) wauChange += 1;
    }

    // DAU trend: last 14 days
    const dauTrend: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = daysAgo(i);
      const k = dayKey(d.toISOString());
      let count = 0;
      for (const days of userActiveDays.values()) {
        if (days.has(k)) count += 1;
      }
      dauTrend.push({ date: k, count });
    }

    // Stickiness = DAU (today) / MAU (last 30 days)
    const today = dayKey(now.toISOString());
    const thirtyDaysAgoKey = dayKey(daysAgo(30).toISOString());
    let dauToday = 0;
    let mau = 0;
    for (const days of userActiveDays.values()) {
      if (days.has(today)) dauToday += 1;
      const hasMonthActivity = Array.from(days).some(d => d >= thirtyDaysAgoKey);
      if (hasMonthActivity) mau += 1;
    }
    const stickiness = mau > 0 ? dauToday / mau : 0;

    // Reviews counts (week)
    const { count: reviewsThisWeek } = await adminClient
      .from("word_progress")
      .select("*", { count: "exact", head: true })
      .gte("updated_at", startOfThisWeek.toISOString());

    const { count: reviewsLastWeek } = await adminClient
      .from("word_progress")
      .select("*", { count: "exact", head: true })
      .gte("updated_at", startOfLastWeek.toISOString())
      .lt("updated_at", endOfLastWeek.toISOString());

    // Total reviews via RPC (sum of review_count)
    const { data: totalReviewsData } = await adminClient.rpc("get_user_review_stats");
    const totalReviews = totalReviewsData?.reduce(
      (sum: number, r: { total_reviews: number }) => sum + (r.total_reviews || 0),
      0,
    ) || 0;

    // Custom words counts
    const { count: customWordsThisWeek } = await adminClient
      .from("words")
      .select("*", { count: "exact", head: true })
      .not("user_id", "is", null)
      .gte("created_at", startOfThisWeek.toISOString());

    const { count: customWordsLastWeek } = await adminClient
      .from("words")
      .select("*", { count: "exact", head: true })
      .not("user_id", "is", null)
      .gte("created_at", startOfLastWeek.toISOString())
      .lt("created_at", endOfLastWeek.toISOString());

    const { count: totalCustomWords } = await adminClient
      .from("words")
      .select("*", { count: "exact", head: true })
      .not("user_id", "is", null);

    // Activation funnel: signups -> onboarding_completed -> first review -> 2+ day active
    const { data: profileRows } = await adminClient
      .from("user_profiles")
      .select("id, onboarding_completed");
    const onboardedUserIds = new Set<string>(
      (profileRows || [])
        .filter(p => p.onboarding_completed && p.id)
        .map(p => p.id as string),
    );

    // Activation: only count for users created in last 45d to keep it relevant + fresh
    const fortyFiveDaysAgo = activityWindowStart.getTime();
    const recentUsers = allUsers.filter(u => new Date(u.created_at).getTime() >= fortyFiveDaysAgo);
    const recentSignups = recentUsers.length;
    let recentOnboarded = 0;
    let recentFirstReview = 0;
    let recentMultiDay = 0;
    for (const u of recentUsers) {
      if (onboardedUserIds.has(u.id)) recentOnboarded += 1;
      const days = userActiveDays.get(u.id);
      if (days && days.size >= 1) recentFirstReview += 1;
      if (days && days.size >= 2) recentMultiDay += 1;
    }

    // Day-N retention: for users who signed up exactly N days ago (±0), did they review on day N?
    // We compute the cohort as users who signed up in [N+1, N] days ago (1-day cohort window),
    // and check whether they had any activity on the N-th day after signup.
    function dayNRetention(N: number): { cohortSize: number; returned: number; rate: number } {
      const cohortStart = daysAgo(N + 7); // widen cohort for more signal
      const cohortEnd = daysAgo(N);
      let cohortSize = 0;
      let returned = 0;
      for (const u of allUsers) {
        const created = new Date(u.created_at);
        if (created < cohortStart || created >= cohortEnd) continue;
        cohortSize += 1;
        const days = userActiveDays.get(u.id);
        if (!days) continue;
        // window: from N days after signup to N+2 days after signup (give a small grace period)
        const winStart = new Date(created);
        winStart.setUTCDate(winStart.getUTCDate() + N);
        winStart.setUTCHours(0, 0, 0, 0);
        const winEnd = new Date(winStart);
        winEnd.setUTCDate(winEnd.getUTCDate() + 2);
        const winStartKey = dayKey(winStart.toISOString());
        const winEndKey = dayKey(winEnd.toISOString());
        const hit = Array.from(days).some(d => d >= winStartKey && d < winEndKey);
        if (hit) returned += 1;
      }
      const rate = cohortSize > 0 ? returned / cohortSize : 0;
      return { cohortSize, returned, rate };
    }

    const day1 = dayNRetention(1);
    const day7 = dayNRetention(7);
    const day30 = dayNRetention(30);

    // Time-to-first-review (median, in hours) for recent signups who have any activity
    const ttfrHours: number[] = [];
    for (const u of recentUsers) {
      const first = userFirstActivity.get(u.id);
      if (!first) continue;
      const delta = (new Date(first).getTime() - new Date(u.created_at).getTime()) / 36e5;
      if (delta >= 0 && delta < 24 * 90) ttfrHours.push(delta);
    }
    ttfrHours.sort((a, b) => a - b);
    const medianTimeToFirstReviewHours = ttfrHours.length
      ? ttfrHours[Math.floor(ttfrHours.length / 2)]
      : null;

    return NextResponse.json({
      wau,
      wauChange,
      signupsThisWeek,
      signupsLastWeek,
      reviewsThisWeek: reviewsThisWeek || 0,
      reviewsLastWeek: reviewsLastWeek || 0,
      customWordsThisWeek: customWordsThisWeek || 0,
      customWordsLastWeek: customWordsLastWeek || 0,
      totalUsers,
      totalReviews,
      totalCustomWords: totalCustomWords || 0,
      dauToday,
      mau,
      stickiness,
      dauTrend,
      activation: {
        windowDays: 45,
        signups: recentSignups,
        onboarded: recentOnboarded,
        firstReview: recentFirstReview,
        multiDay: recentMultiDay,
      },
      retention: { day1, day7, day30 },
      medianTimeToFirstReviewHours,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
