// Data collector - reads OpenCode storage and returns raw data

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionData, MessageData, ProjectData } from "./types";

const OPENCODE_DATA_PATH = join(process.env.HOME || "~", ".local/share/opencode/storage");

export async function checkOpenCodeDataExists(): Promise<boolean> {
  try {
    await readdir(OPENCODE_DATA_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function collectSessions(year?: number): Promise<SessionData[]> {
  const sessionsPath = join(OPENCODE_DATA_PATH, "session");

  try {
    const projectDirs = await readdir(sessionsPath);

    const results = await Promise.all(
      projectDirs.map(async (projectDir) => {
        const projectPath = join(sessionsPath, projectDir);
        try {
          const sessionFiles = await readdir(projectPath);
          return Promise.all(
            sessionFiles
              .filter((f) => f.endsWith(".json"))
              .map(async (sessionFile) => {
                try {
                  const session = (await Bun.file(join(projectPath, sessionFile)).json()) as SessionData;
                  if (year && new Date(session.time.created).getFullYear() !== year) return null;
                  return session;
                } catch {
                  return null;
                }
              })
          );
        } catch {
          return [];
        }
      })
    );

    return results.flat().filter((s): s is SessionData => s !== null);
  } catch (error) {
    throw new Error(`Failed to read sessions: ${error}`);
  }
}

export async function collectMessages(year?: number): Promise<MessageData[]> {
  const messagesPath = join(OPENCODE_DATA_PATH, "message");

  try {
    const sessionDirs = await readdir(messagesPath);

    const results = await Promise.all(
      sessionDirs.map(async (sessionDir) => {
        const sessionPath = join(messagesPath, sessionDir);
        try {
          const messageFiles = await readdir(sessionPath);
          return Promise.all(
            messageFiles
              .filter((f) => f.endsWith(".json"))
              .map(async (messageFile) => {
                try {
                  const message = (await Bun.file(join(sessionPath, messageFile)).json()) as MessageData;
                  if (year && new Date(message.time.created).getFullYear() !== year) return null;
                  return message;
                } catch {
                  return null;
                }
              })
          );
        } catch {
          return [];
        }
      })
    );

    return results.flat().filter((m): m is MessageData => m !== null);
  } catch (error) {
    throw new Error(`Failed to read messages: ${error}`);
  }
}

export async function collectProjects(): Promise<ProjectData[]> {
  const projectsPath = join(OPENCODE_DATA_PATH, "project");

  try {
    const projectFiles = await readdir(projectsPath);
    const jsonFiles = projectFiles.filter((f) => f.endsWith(".json"));

    // Read all project files in parallel
    const results = await Promise.all(
      jsonFiles.map(async (projectFile) => {
        try {
          const filePath = join(projectsPath, projectFile);
          const content = await Bun.file(filePath).json();
          return content as ProjectData;
        } catch {
          return null; // Skip invalid JSON files
        }
      })
    );

    return results.filter((p): p is ProjectData => p !== null);
  } catch {
    // Projects directory might not exist
    return [];
  }
}
