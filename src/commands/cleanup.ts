import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import { Listr } from 'listr2';
import { spawn } from 'child_process';

const CASINOS_DIR = path.join(os.homedir(), '.fare-casinos');

/**
 * Get the fly command path - prefer .fly/bin location
 */
function getFlyCommand(): string {
  // Check if installed in user's .fly directory first
  const homeFlyCli = `${process.env.HOME}/.fly/bin/flyctl`;
  return homeFlyCli;
}

/**
 * Execute a fly.io CLI command
 */
async function executeFlyCommand(
  args: string[],
  silent: boolean = true
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const flyCmd = getFlyCommand();
    const proc = spawn(flyCmd, args, {
      stdio: silent ? 'pipe' : 'inherit',
      shell: true,
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
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });
  });
}

/**
 * Get all Fly.io apps that start with 'fare-'
 */
async function getFareApps(): Promise<string[]> {
  const result = await executeFlyCommand(['apps', 'list', '--json']);
  
  if (result.exitCode !== 0) {
    return [];
  }

  try {
    const apps = JSON.parse(result.stdout);
    return apps
      .filter((app: any) => app.Name && app.Name.startsWith('fare-'))
      .map((app: any) => app.Name);
  } catch {
    return [];
  }
}

/**
 * Get all Postgres clusters that start with 'fare-'
 */
async function getFarePostgresClusters(org: string): Promise<Array<{ id: string; name: string }>> {
  const result = await executeFlyCommand(['mpg', 'list', '--org', org]);
  
  if (result.exitCode !== 0) {
    return [];
  }

  const lines = result.stdout.split('\n');
  const clusters: Array<{ id: string; name: string }> = [];
  
  for (const line of lines) {
    if (line.includes('fare-') && line.includes('-db')) {
      const match = line.match(/^([a-z0-9]+)\s+(\S+)/);
      if (match) {
        clusters.push({
          id: match[1],
          name: match[2],
        });
      }
    }
  }
  
  return clusters;
}

/**
 * Get all add-ons (Redis, Tigris, etc) that start with 'fare-'
 */
async function getFareAddOns(org: string, type: 'redis' | 'tigris'): Promise<string[]> {
  const suffix = type === 'redis' ? '-redis' : '-storage';
  const result = await executeFlyCommand([type, 'list', '--org', org]);
  
  if (result.exitCode !== 0) {
    return [];
  }

  const lines = result.stdout.split('\n');
  const instances: string[] = [];
  
  for (const line of lines) {
    if (line.includes('fare-') && line.includes(suffix)) {
      // Parse name from the line (first column)
      const match = line.match(/^(\S+)\s+/);
      if (match) {
        instances.push(match[1]);
      }
    }
  }
  
  return instances;
}

/**
 * Cleanup command - destroy all fare-related resources
 */
export async function cleanupCommand(options: { org?: string } = {}): Promise<void> {
  console.log(chalk.yellow.bold('\n⚠️  CLEANUP MODE\n'));
  console.log(chalk.gray('This will delete ALL fare-casino resources:\n'));
  console.log(chalk.red('  • Local casino directories in ~/.fare-casinos'));
  console.log(chalk.red('  • Fly.io apps (fare-*)'));
  console.log(chalk.red('  • Postgres clusters (fare-*-db)'));
  console.log(chalk.red('  • Redis instances (fare-*-redis)'));
  console.log(chalk.red('  • Tigris storage (fare-*-storage)'));
  console.log('');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow('Are you sure you want to delete EVERYTHING?'),
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.gray('\nCleanup cancelled.\n'));
    return;
  }

  // Get organization if not provided
  let orgSlug = options.org;
  if (!orgSlug) {
    try {
      const orgResult = await executeFlyCommand(['orgs', 'list', '--json']);
      if (orgResult.exitCode === 0 && orgResult.stdout) {
        const orgs = JSON.parse(orgResult.stdout);
        const orgSlugs = Object.keys(orgs);
        
        if (orgSlugs.length === 0) {
          console.log(chalk.yellow('\nNo organizations found. Nothing to clean up.\n'));
          return;
        }
        
        if (orgSlugs.length === 1) {
          orgSlug = orgSlugs[0];
          console.log(chalk.gray(`Using organization: ${orgs[orgSlug]} (${orgSlug})\n`));
        } else {
          const { selectedOrg } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedOrg',
              message: 'Select organization to clean up:',
              choices: orgSlugs.map(slug => ({ name: `${orgs[slug]} (${slug})`, value: slug })),
            },
          ]);
          orgSlug = selectedOrg;
        }
      } else {
        throw new Error('Failed to get organizations. Are you authenticated? Run: fly auth login');
      }
    } catch (error) {
      throw new Error(`Failed to get organizations: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!orgSlug) {
    throw new Error('Organization is required. Use --org flag or ensure you are authenticated with Fly.io');
  }

  // Scan for resources
  console.log(chalk.cyan('\n🔍 Scanning for resources...\n'));
  
  const [apps, postgresClusters, redisInstances, tigrisInstances] = await Promise.all([
    getFareApps(),
    getFarePostgresClusters(orgSlug),
    getFareAddOns(orgSlug, 'redis'),
    getFareAddOns(orgSlug, 'tigris'),
  ]);

  console.log(chalk.white('Found:'));
  console.log(chalk.gray(`  Apps:      ${apps.length}`));
  console.log(chalk.gray(`  Postgres:  ${postgresClusters.length}`));
  console.log(chalk.gray(`  Redis:     ${redisInstances.length}`));
  console.log(chalk.gray(`  Tigris:    ${tigrisInstances.length}`));
  console.log('');

  if (apps.length === 0 && postgresClusters.length === 0 && redisInstances.length === 0 && tigrisInstances.length === 0) {
    console.log(chalk.green('✓ No Fly.io resources to clean up!\n'));
  }

  // Create cleanup tasks
  const tasks = new Listr([
    {
      title: 'Deleting local casino directories',
      task: async () => {
        try {
          await fs.rm(CASINOS_DIR, { recursive: true, force: true });
        } catch (error) {
          // Directory might not exist, that's OK
        }
      },
    },
    {
      title: `Deleting Fly.io apps (${apps.length})`,
      skip: () => apps.length === 0,
      task: async () => {
        for (const app of apps) {
          await executeFlyCommand(['apps', 'destroy', app, '--yes']);
        }
      },
    },
    {
      title: `Destroying Postgres clusters (${postgresClusters.length})`,
      skip: () => postgresClusters.length === 0,
      task: async () => {
        for (const cluster of postgresClusters) {
          await executeFlyCommand(['mpg', 'destroy', cluster.id, '--yes']);
        }
      },
    },
    {
      title: `Destroying Redis instances (${redisInstances.length})`,
      skip: () => redisInstances.length === 0,
      task: async () => {
        for (const instance of redisInstances) {
          await executeFlyCommand(['redis', 'destroy', instance, '-y']); // No --org flag
        }
      },
    },
    {
      title: `Destroying Tigris storage (${tigrisInstances.length})`,
      skip: () => tigrisInstances.length === 0,
      task: async () => {
        for (const instance of tigrisInstances) {
          await executeFlyCommand(['storage', 'destroy', instance, '-y']); // No --org flag
        }
      },
    },
  ]);

  try {
    await tasks.run();
    
    console.log('');
    console.log(chalk.green.bold('✓ Cleanup complete!\n'));
    console.log(chalk.gray('All fare-casino resources have been deleted.'));
    console.log(chalk.gray('You can now run'), chalk.cyan('fare init {casino-name}'), chalk.gray('to start fresh.\n'));
  } catch (error) {
    console.error(chalk.red.bold('\n✗ Cleanup failed\n'));
    throw error;
  }
}

