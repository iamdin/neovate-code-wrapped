// Types for Neovate Code Wrapped

export interface MessageData {
  parentUuid: string | null;
  uuid: string;
  role: "user" | "assistant";
  content: string | Array<{ type: string; text: string }>;
  text?: string;
  type: "message";
  timestamp: string;
  sessionId: string;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface SessionData {
  id: string;
  projectPath: string;
  firstMessageTime: number;
  lastMessageTime: number;
  messageCount: number;
}

export interface ProjectData {
  id: string;
  path: string;
  encodedName: string;
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

export interface NeovateStats {
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

  // Cost (estimated from usage)
  estimatedCost: number;

  // Models (sorted by usage)
  topModels: ModelStats[];

  // Providers (sorted by usage)
  topProviders: ProviderStats[];

  // Streak
  maxStreak: number;
  currentStreak: number;
  maxStreakDays: Set<string>;

  // Activity heatmap (for the year)
  dailyActivity: Map<string, number>;

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
