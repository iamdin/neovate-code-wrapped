import type { NeovateStats, ModelStats, ProviderStats, WeekdayActivity } from "./types";
import { collectMessages, collectProjects, collectSessions } from "./collector";
import { fetchModelsData, getModelDisplayName, getProviderDisplayName, getModelProvider } from "./models";

export async function calculateStats(year: number): Promise<NeovateStats> {
  const [, allSessions, messages, projects] = await Promise.all([
    fetchModelsData(),
    collectSessions(),
    collectMessages(year),
    collectProjects(),
  ]);

  const sessions = allSessions.filter((s) => new Date(s.firstMessageTime).getFullYear() === year);

  let firstSessionDate: Date;
  let daysSinceFirstSession: number;

  if (allSessions.length === 0) {
    firstSessionDate = new Date();
    daysSinceFirstSession = 0;
  } else {
    const firstSessionTimestamp = Math.min(...allSessions.map((s) => s.firstMessageTime));
    firstSessionDate = new Date(firstSessionTimestamp);
    daysSinceFirstSession = Math.floor((Date.now() - firstSessionTimestamp) / (1000 * 60 * 60 * 24));
  }

  const totalSessions = sessions.length;
  const totalMessages = messages.length;
  const totalProjects = projects.length;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const modelCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();
  const dailyActivity = new Map<string, number>();
  const weekdayCounts: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];

  // Tool call tracking
  let totalToolCalls = 0;
  const toolCounts = new Map<string, number>();

  for (const message of messages) {
    if (message.usage) {
      totalInputTokens += message.usage.input_tokens || 0;
      totalOutputTokens += message.usage.output_tokens || 0;
    }

    // Parse model string "provider/model-id"
    let providerID = "unknown";
    let modelID = "unknown";
    if (message.model) {
      const parts = message.model.split("/");
      if (parts.length >= 2) {
        providerID = parts[0];
        modelID = parts.slice(1).join("/");
      } else {
        modelID = message.model;
      }
    }

    // Count tool calls
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.name) {
          toolCounts.set(toolCall.name, (toolCounts.get(toolCall.name) || 0) + 1);
          totalToolCalls++;
        }
      }
    }

    // Also check content array for tool_use blocks
    if (Array.isArray(message.content)) {
      for (const contentBlock of message.content) {
        if (contentBlock.type === "tool_use" && contentBlock.name) {
          toolCounts.set(contentBlock.name, (toolCounts.get(contentBlock.name) || 0) + 1);
          totalToolCalls++;
        }
      }
    }

    if (message.role === "assistant") {
      if (modelID !== "unknown") {
        modelCounts.set(modelID, (modelCounts.get(modelID) || 0) + 1);
      }
      if (providerID !== "unknown") {
        providerCounts.set(providerID, (providerCounts.get(providerID) || 0) + 1);
      }
    }

    // Daily activity
    const date = new Date(message.timestamp);
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

  const topTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
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
    totalToolCalls,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    topModels,
    topProviders,
    topTools,
    maxStreak,
    currentStreak,
    maxStreakDays,
    dailyActivity,
    mostActiveDay,
    weekdayActivity,
  };
}

function getModelProvider(modelId: string): string {
  return "unknown";
}

interface TokenCounts {
  input_tokens: number;
  output_tokens: number;
}

function calculateMessageCost(usage: TokenCounts, pricing: ModelCost): number {
  const MILLION = 1_000_000;

  let cost = 0;
  cost += (usage.input_tokens * pricing.input) / MILLION;
  cost += (usage.output_tokens * pricing.output) / MILLION;

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

  const maxStreakDays = new Set<string>();
  for (let i = maxStreakStart; i <= maxStreakEnd; i++) {
    maxStreakDays.add(activeDates[i]);
  }

  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const currentStreak = dailyActivity.has(today)
    ? countStreakBackwards(dailyActivity, new Date())
    : dailyActivity.has(yesterday)
    ? countStreakBackwards(dailyActivity, new Date(Date.now() - 24 * 60 * 60 * 1000))
    : 0;

  return { maxStreak, currentStreak, maxStreakDays };
}

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
