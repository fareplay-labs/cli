import { spawn } from 'child_process';

/**
 * Execute an npm command
 */
async function executeNpmCommand(
  args: string[],
  cwd: string,
  silent: boolean = true
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const npmProcess = spawn('npm', args, {
      cwd,
      stdio: silent ? 'pipe' : 'inherit',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    if (npmProcess.stdout) {
      npmProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (npmProcess.stderr) {
      npmProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    npmProcess.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });
  });
}

/**
 * Install npm dependencies
 */
export async function installDependencies(projectPath: string): Promise<void> {
  const result = await executeNpmCommand(['install'], projectPath);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to install dependencies: ${result.stderr}`);
  }
}

/**
 * Run Prisma generate
 */
export async function generatePrismaClient(projectPath: string): Promise<void> {
  const result = await executeNpmCommand(['run', 'db:generate'], projectPath);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to generate Prisma client: ${result.stderr}`);
  }
}

/**
 * Run Prisma migrations with DATABASE_URL
 */
export async function runPrismaMigrations(projectPath: string, databaseUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'db:migrate'], {
      cwd: projectPath,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to run database migrations: ${stderr || stdout}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Build the project
 * Build packages in correct dependency order: utils -> db -> solana -> apps
 */
export async function buildProject(projectPath: string): Promise<void> {
  // Build shared packages first (dependencies)
  const packageOrder = [
    'packages/utils',
    'packages/db',
    'packages/solana',
  ];

  for (const pkg of packageOrder) {
    const result = await executeNpmCommand(['run', 'build', '--workspace', pkg], projectPath, true); // Keep silent
    if (result.exitCode !== 0) {
      // Show error output only on failure
      console.error('\n' + (result.stderr || result.stdout));
      throw new Error(`Failed to build ${pkg}`);
    }
  }

  // Now build all apps (they depend on packages)
  const appResult = await executeNpmCommand(['run', 'build', '--workspace', 'apps/api'], projectPath, true);
  if (appResult.exitCode !== 0) {
    console.error('\n' + (appResult.stderr || appResult.stdout));
    throw new Error(`Failed to build apps/api`);
  }

  const wsResult = await executeNpmCommand(['run', 'build', '--workspace', 'apps/ws'], projectPath, true);
  if (wsResult.exitCode !== 0) {
    console.error('\n' + (wsResult.stderr || wsResult.stdout));
    throw new Error(`Failed to build apps/ws`);
  }

  const procResult = await executeNpmCommand(['run', 'build', '--workspace', 'apps/processor'], projectPath, true);
  if (procResult.exitCode !== 0) {
    console.error('\n' + (procResult.stderr || procResult.stdout));
    throw new Error(`Failed to build apps/processor`);
  }
}

