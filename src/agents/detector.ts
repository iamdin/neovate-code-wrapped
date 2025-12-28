import { access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AgentInfo {
  name: string;
  id: string;
  detectionPath: string;
  wrappedCommand: string;
  repoUrl: string;
  brandColor: string;
}

export interface DetectedAgent extends AgentInfo {
  detected: boolean;
}

const AGENTS: AgentInfo[] = [
  {
    name: "Claude Code",
    id: "claude",
    detectionPath: join(homedir(), ".claude"),
    wrappedCommand: "npx cc-wrapped",
    repoUrl: "https://github.com/numman-ali/cc-wrapped",
    brandColor: "#D97757",
  },
  {
    name: "Codex",
    id: "codex",
    detectionPath: join(homedir(), ".codex"),
    wrappedCommand: "npx codex-wrapped",
    repoUrl: "https://github.com/numman-ali/codex-wrapped",
    brandColor: "#3b82f6",
  },
  {
    name: "Gemini CLI",
    id: "gemini",
    detectionPath: join(homedir(), ".gemini"),
    wrappedCommand: "npx gemini-wrapped",
    repoUrl: "https://github.com/jackwotherspoon/gemini-cli-wrapped",
    brandColor: "#CBA6F7",
  },
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectInstalledAgents(): Promise<DetectedAgent[]> {
  const results = await Promise.all(
    AGENTS.map(async (agent) => ({
      ...agent,
      detected: await pathExists(agent.detectionPath),
    }))
  );

  return results.filter((agent) => agent.detected);
}
