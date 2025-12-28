import type { OpenCodeStats, ModelStats, ProviderStats, WeekdayActivity } from "./types";
import { collectMessages, collectProjects, collectSessions } from "./collector";
import { fetchModelsData, getModelDisplayName, getModelProvider, getProviderDisplayName, getModelPricing, type ModelCost } from "./models";

export async function calculateStats(year: number): Promise<OpenCodeStats> {
  const [, allSessions, messages, projects] = await Promise.all([
    fetchModelsData(),
    collectSessions(),
    collectMessages(year),
    collectProjects(),
  ]);

  const sessions = allSessions.filter((s) => new Date(s.time.created).getFullYear() === year);

  // Find first session date (ever, not just this year)
  // Guard against empty sessions array - Math.min() returns Infinity with no arguments
  let firstSessionDate: Date;
  let daysSinceFirstSession: number;

  if (allSessions.length === 0) {
    firstSessionDate = new Date();
    daysSinceFirstSession = 0;
  } else {
    const firstSessionTimestamp = Math.min(...allSessions.map((s) => s.time.created));
    firstSessionDate = new Date(firstSessionTimestamp);
    daysSinceFirstSession = Math.floor((Date.now() - firstSessionTimestamp) / (1000 * 60 * 60 * 24));
  }

  const totalSessions = sessions.length;
  const totalMessages = messages.length;
  const totalProjects = projects.length;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let zenCost = 0;
  let estimatedCost = 0;
  const modelCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();
  const dailyActivity = new Map<string, number>();
  const weekdayCounts: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];

  for (const message of messages) {
    if (message.tokens) {
      totalInputTokens += message.tokens.input || 0;
      totalOutputTokens += message.tokens.output || 0;
    }

    if (message.providerID === "opencode" && message.cost) {
      zenCost += message.cost;
    }

    if (message.providerID !== "opencode" && message.tokens && message.modelID) {
      const pricing = getModelPricing(message.modelID);
      if (pricing) {
        estimatedCost += calculateMessageCost(message.tokens, pricing);
      }
    }

    if (message.role === "assistant") {
      if (message.modelID) {
        modelCounts.set(message.modelID, (modelCounts.get(message.modelID) || 0) + 1);
      }
      if (message.providerID) {
        providerCounts.set(message.providerID, (providerCounts.get(message.providerID) || 0) + 1);
      }
    }

    // Daily activity
    const date = new Date(message.time.created);
    const dateKey = formatDateKey(date);
    dailyActivity.set(dateKey, (dailyActivity.get(dateKey) || 0) + 1);

    // Weekday activity
    weekdayCounts[date.getDay()]++;
  }

  const totalTokens = totalInputTokens + totalOutputTokens;

  const topModels: ModelStats[] = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      name: getModelDisplayName(id),
      providerId: getModelProvider(id),
      count,
      percentage: 0,
    }));

  const topProviders: ProviderStats[] = Array.from(providerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      name: getProviderDisplayName(id),
      count,
      percentage: 0,
    }));

  const { maxStreak, currentStreak, maxStreakDays } = calculateStreaks(dailyActivity, year);

  const mostActiveDay = findMostActiveDay(dailyActivity);
  const weekdayActivity = buildWeekdayActivity(weekdayCounts);

  return {
    year,
    firstSessionDate,
    daysSinceFirstSession,
    totalSessions,
    totalMessages,
    totalProjects,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    zenCost,
    estimatedCost,
    topModels,
    topProviders,
    maxStreak,
    currentStreak,
    maxStreakDays,
    dailyActivity,
    mostActiveDay,
    weekdayActivity,
  };
}

interface TokenCounts {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

function calculateMessageCost(tokens: TokenCounts, pricing: ModelCost): number {
  const MILLION = 1_000_000;

  let cost = 0;
  cost += (tokens.input * pricing.input) / MILLION;
  cost += (tokens.output * pricing.output) / MILLION;

  if (pricing.cacheRead && tokens.cache.read) {
    cost += (tokens.cache.read * pricing.cacheRead) / MILLION;
  }
  if (pricing.cacheWrite && tokens.cache.write) {
    cost += (tokens.cache.write * pricing.cacheWrite) / MILLION;
  }

  return cost;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreaks(
  dailyActivity: Map<string, number>,
  year: number
): { maxStreak: number; currentStreak: number; maxStreakDays: Set<string> } {
  // Get all active dates sorted
  const activeDates = Array.from(dailyActivity.keys())
    .filter((date) => date.startsWith(String(year)))
    .sort();

  if (activeDates.length === 0) {
    return { maxStreak: 0, currentStreak: 0, maxStreakDays: new Set() };
  }

  let maxStreak = 1;
  let tempStreak = 1;
  let tempStreakStart = 0;
  let maxStreakStart = 0;
  let maxStreakEnd = 0;

  for (let i = 1; i < activeDates.length; i++) {
    const prevDate = new Date(activeDates[i - 1]);
    const currDate = new Date(activeDates[i]);

    // Calculate difference in days
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
        maxStreakStart = tempStreakStart;
        maxStreakEnd = i;
      }
    } else {
      tempStreak = 1;
      tempStreakStart = i;
    }
  }

  // Build the set of max streak days
  const maxStreakDays = new Set<string>();
  for (let i = maxStreakStart; i <= maxStreakEnd; i++) {
    maxStreakDays.add(activeDates[i]);
  }

  // Calculate current streak (from today or yesterday backwards)
  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const currentStreak = dailyActivity.has(today)
    ? countStreakBackwards(dailyActivity, new Date())
    : dailyActivity.has(yesterday)
    ? countStreakBackwards(dailyActivity, new Date(Date.now() - 24 * 60 * 60 * 1000))
    : 0;

  return { maxStreak, currentStreak, maxStreakDays };
}

/** Count consecutive days with activity going backwards from startDate (inclusive) */
function countStreakBackwards(dailyActivity: Map<string, number>, startDate: Date): number {
  let streak = 1;
  let checkDate = new Date(startDate);

  while (true) {
    checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    if (dailyActivity.has(formatDateKey(checkDate))) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function findMostActiveDay(dailyActivity: Map<string, number>): { date: string; count: number; formattedDate: string } | null {
  if (dailyActivity.size === 0) {
    return null;
  }

  let maxDate = "";
  let maxCount = 0;

  for (const [date, count] of dailyActivity.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxDate = date;
    }
  }

  if (!maxDate) {
    return null;
  }

  // Parse date string (YYYY-MM-DD) and format as "Mon D"
  const [year, month, day] = maxDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;

  return {
    date: maxDate,
    count: maxCount,
    formattedDate,
  };
}

function buildWeekdayActivity(counts: [number, number, number, number, number, number, number]): WeekdayActivity {
  const WEEKDAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let mostActiveDay = 0;
  let maxCount = 0;
  for (let i = 0; i < 7; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      mostActiveDay = i;
    }
  }

  return {
    counts,
    mostActiveDay,
    mostActiveDayName: WEEKDAY_NAMES_FULL[mostActiveDay],
    maxCount,
  };
}
