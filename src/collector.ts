// Data collector - reads Neovate storage and returns raw data

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionData, MessageData, ProjectData } from "./types";

const NEOVATE_DATA_PATH = join(process.env.HOME!, ".neovate/projects");

export async function checkNeovateDataExists(): Promise<boolean> {
  try {
    await readdir(NEOVATE_DATA_PATH);
    return true;
  } catch {
    return false;
  }
}

function parseJsonl(content: string): any[] {
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((item) => item !== null);
}

export async function collectMessages(year?: number): Promise<MessageData[]> {
  try {
    const projectDirs = await readdir(NEOVATE_DATA_PATH);
    const allMessages: MessageData[] = [];

    for (const projectDir of projectDirs) {
      const projectPath = join(NEOVATE_DATA_PATH, projectDir);

      try {
        const files = await readdir(projectPath);
        const sessionFiles = files.filter((f) => f.endsWith(".jsonl") && !f.includes("/"));

        for (const sessionFile of sessionFiles) {
          try {
            const filePath = join(projectPath, sessionFile);
            const content = await Bun.file(filePath).text();
            const messages = parseJsonl(content) as MessageData[];

            for (const message of messages) {
              if (message.type !== "message") continue;

              if (year) {
                const messageDate = new Date(message.timestamp);
                if (messageDate.getFullYear() !== year) continue;
              }

              allMessages.push(message);
            }
          } catch {
            // Skip invalid files
          }
        }
      } catch {
        // Skip invalid project directories
      }
    }

    return allMessages;
  } catch (error) {
    throw new Error(`Failed to read messages: ${error}`);
  }
}

export async function collectSessions(year?: number): Promise<SessionData[]> {
  try {
    const projectDirs = await readdir(NEOVATE_DATA_PATH);
    const sessions: SessionData[] = [];

    for (const projectDir of projectDirs) {
      const projectPath = join(NEOVATE_DATA_PATH, projectDir);

      try {
        const files = await readdir(projectPath);
        const sessionFiles = files.filter((f) => f.endsWith(".jsonl") && !f.includes("/"));

        for (const sessionFile of sessionFiles) {
          try {
            const filePath = join(projectPath, sessionFile);
            const content = await Bun.file(filePath).text();
            const messages = parseJsonl(content) as MessageData[];

            if (messages.length === 0) continue;

            const validMessages = messages.filter((m) => m.type === "message");
            if (validMessages.length === 0) continue;

            const timestamps = validMessages.map((m) => new Date(m.timestamp).getTime());
            const firstTime = Math.min(...timestamps);
            const lastTime = Math.max(...timestamps);

            if (year) {
              const firstDate = new Date(firstTime);
              if (firstDate.getFullYear() !== year) continue;
            }

            const sessionId = sessionFile.replace(".jsonl", "");

            sessions.push({
              id: sessionId,
              projectPath: projectDir,
              firstMessageTime: firstTime,
              lastMessageTime: lastTime,
              messageCount: validMessages.length,
            });
          } catch {
            // Skip invalid files
          }
        }
      } catch {
        // Skip invalid project directories
      }
    }

    return sessions;
  } catch (error) {
    throw new Error(`Failed to read sessions: ${error}`);
  }
}

export async function collectProjects(): Promise<ProjectData[]> {
  try {
    const projectDirs = await readdir(NEOVATE_DATA_PATH);
    const projects: ProjectData[] = [];

    for (const projectDir of projectDirs) {
      const projectPath = join(NEOVATE_DATA_PATH, projectDir);

      try {
        const stat = await Bun.file(projectPath).exists();
        // Check if it's a directory by trying to read it
        await readdir(projectPath);

        projects.push({
          id: projectDir,
          path: projectPath,
          encodedName: projectDir,
        });
      } catch {
        // Not a directory, skip
      }
    }

    return projects;
  } catch {
    return [];
  }
}
