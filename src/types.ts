// Types for OpenCode Wrapped

export interface SessionData {
  id: string;
  version: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
}

export interface MessageData {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: {
    created: number;
    completed?: number;
  };
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  agent?: string;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  finish?: string;
}

export interface ProjectData {
  id: string;
  worktree: string;
  vcsDir: string;
  vcs: string;
  time: {
    created: number;
    updated: number;
    initialized?: number;
  };
}

export interface ModelStats {
  id: string;
  name: string;
  providerId: string;
  count: number;
  percentage: number;
}

export interface ProviderStats {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface OpenCodeStats {
  year: number;

  // Time-based
  firstSessionDate: Date;
  daysSinceFirstSession: number;

  // Counts
  totalSessions: number;
  totalMessages: number;
  totalProjects: number;

  // Tokens
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;

  // Cost (only from OpenCode Zen provider)
  zenCost: number;
  // Cost from all other providers combined
  estimatedCost: number;

  // Models (sorted by usage)
  topModels: ModelStats[];

  // Providers (sorted by usage)
  topProviders: ProviderStats[];

  // Streak
  maxStreak: number;
  currentStreak: number;
  maxStreakDays: Set<string>; // Days that form the max streak (for heatmap highlighting)

  // Activity heatmap (for the year)
  dailyActivity: Map<string, number>; // "2025-01-15" -> count

  // Most active day
  mostActiveDay: {
    date: string;
    count: number;
    formattedDate: string;
  } | null;

  // Weekday activity distribution (0=Sunday, 6=Saturday)
  weekdayActivity: WeekdayActivity;
}

export interface WeekdayActivity {
  counts: [number, number, number, number, number, number, number];
  mostActiveDay: number;
  mostActiveDayName: string;
  maxCount: number;
}

export interface CliArgs {
  year?: number;
  help?: boolean;
}
