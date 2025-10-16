import simpleGit, { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const CASINO_BACKEND_REPO = 'https://github.com/fareplay-labs/custom-casino-backend.git';
const CASINOS_DIR = path.join(os.homedir(), '.fare-casinos');

/**
 * Get the base directory where casinos are stored
 */
export function getCasinosDirectory(): string {
  return CASINOS_DIR;
}

/**
 * Get the deployment path for a specific casino
 */
export function getCasinoPath(casinoName: string): string {
  return path.join(CASINOS_DIR, casinoName);
}

/**
 * Ensure the casinos directory exists
 */
async function ensureCasinosDirectory(): Promise<void> {
  try {
    await fs.mkdir(CASINOS_DIR, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create casinos directory: ${error}`);
  }
}

/**
 * Check if a casino directory already exists
 */
export async function casinoExists(casinoName: string): Promise<boolean> {
  const casinoPath = getCasinoPath(casinoName);
  try {
    await fs.access(casinoPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone the custom-casino-backend repository using child_process for better control
 */
export async function cloneCasinoBackend(casinoName: string): Promise<string> {
  await ensureCasinosDirectory();

  const casinoPath = getCasinoPath(casinoName);

  // Check if directory already exists
  if (await casinoExists(casinoName)) {
    throw new Error(
      `Casino directory already exists at ${casinoPath}. Please choose a different name or remove the existing directory.`
    );
  }

  return new Promise((resolve, reject) => {
    const gitProcess = spawn('git', [
      'clone',
      '--depth',
      '1',
      '--progress',
      CASINO_BACKEND_REPO,
      casinoPath,
    ]);

    let errorOutput = '';

    gitProcess.stderr.on('data', (data) => {
      // Git outputs progress to stderr
      errorOutput += data.toString();
    });

    gitProcess.on('error', (error) => {
      reject(new Error(`Failed to start git clone: ${error.message}`));
    });

    gitProcess.on('close', async (code) => {
      if (code === 0) {
        resolve(casinoPath);
      } else {
        // Clean up partial clone on error
        try {
          await fs.rm(casinoPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
        reject(new Error(`Failed to clone repository (exit code ${code}): ${errorOutput}`));
      }
    });
  });
}

/**
 * Get git repository info for a casino
 */
export async function getRepoInfo(casinoPath: string): Promise<{
  branch: string;
  commit: string;
  remote: string;
}> {
  const git: SimpleGit = simpleGit(casinoPath);

  try {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const commit = await git.revparse(['HEAD']);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin');

    return {
      branch: branch.trim(),
      commit: commit.trim().substring(0, 7),
      remote: origin?.refs.fetch || 'unknown',
    };
  } catch (error) {
    throw new Error(`Failed to get repository info: ${error}`);
  }
}

/**
 * Pull latest changes from the repository
 */
export async function pullLatestChanges(casinoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(casinoPath);

  try {
    await git.pull();
  } catch (error) {
    throw new Error(`Failed to pull latest changes: ${error}`);
  }
}

