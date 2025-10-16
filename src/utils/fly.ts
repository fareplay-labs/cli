import { spawn } from 'child_process';
import chalk from 'chalk';
import { withFlyGraphQL } from './graphql-client';
import { AddOnType } from '../generated/graphql';

/**
 * Get the fly command path
 */
function getFlyCommand(): string {
  // Try common locations
  const possiblePaths = [
    'fly',
    'flyctl',
    `${process.env.HOME}/.fly/bin/fly`,
    `${process.env.HOME}/.fly/bin/flyctl`,
    '/usr/local/bin/fly',
    '/usr/local/bin/flyctl',
  ];

  // Return first available or default to 'fly'
  return possiblePaths[0];
}

/**
 * Execute a fly.io CLI command
 */
async function executeFlyCommand(
  args: string[],
  options: { cwd?: string; input?: string; silent?: boolean; interactive?: boolean } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const flyCmd = getFlyCommand();
    
    // Determine stdio mode
    let stdio: any;
    if (options.interactive) {
      // For interactive commands like auth login
      stdio = 'inherit';
    } else if (options.silent) {
      // For silent execution (during Listr tasks)
      stdio = 'pipe';
    } else if (options.input) {
      stdio = 'pipe';
    } else {
      // Default: pipe for capturing output
      stdio = 'pipe';
    }
    
    const flyProcess = spawn(flyCmd, args, {
      cwd: options.cwd || process.cwd(),
      stdio,
      shell: true, // Use shell to help with PATH resolution
    });

    let stdout = '';
    let stderr = '';

    if (flyProcess.stdout) {
      flyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (flyProcess.stderr) {
      flyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    if (options.input && flyProcess.stdin) {
      flyProcess.stdin.write(options.input);
      flyProcess.stdin.end();
    }

    flyProcess.on('error', (error) => {
      reject(error);
    });

    flyProcess.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });
  });
}

/**
 * Check if Fly CLI is installed and accessible
 */
export async function checkFlyCliInstalled(): Promise<boolean> {
  try {
    // Try multiple command variants
    const commands = ['fly', 'flyctl'];
    
    for (const cmd of commands) {
      try {
        const result = await new Promise<{ exitCode: number }>((resolve) => {
          const proc = spawn(cmd, ['version'], { 
            stdio: 'ignore',
            shell: true,
          });
          
          proc.on('error', () => {
            resolve({ exitCode: 1 });
          });
          
          proc.on('close', (code) => {
            resolve({ exitCode: code || 0 });
          });
        });
        
        if (result.exitCode === 0) {
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user is authenticated with Fly.io
 */
export async function checkFlyAuth(): Promise<boolean> {
  try {
    const commands = ['fly', 'flyctl'];
    
    for (const cmd of commands) {
      try {
        const result = await new Promise<{ exitCode: number }>((resolve) => {
          const proc = spawn(cmd, ['auth', 'whoami'], {
            stdio: 'ignore',
            shell: true,
          });
          
          proc.on('error', () => {
            resolve({ exitCode: 1 });
          });
          
          proc.on('close', (code) => {
            resolve({ exitCode: code || 0 });
          });
        });
        
        if (result.exitCode === 0) {
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Authenticate with Fly.io (opens browser)
 */
export async function authenticateFly(): Promise<void> {
  console.log(chalk.cyan('\n🔐 Opening browser for Fly.io authentication...\n'));
  const result = await executeFlyCommand(['auth', 'login'], { interactive: true });
  
  if (result.exitCode !== 0) {
    throw new Error('Fly.io authentication failed');
  }
}

/**
 * Get available organizations
 */
async function getOrganizations(): Promise<Record<string, string>> {
  const result = await executeFlyCommand(['orgs', 'list', '--json'], { silent: true });
  
  if (result.exitCode !== 0) {
    throw new Error('Failed to get organizations');
  }
  
  const data = JSON.parse(result.stdout);
  
  // The output format is: { "org-slug": "Org Name", "another-slug": "Another Name" }
  // Keys are org slugs, values are org names
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid organization data format');
  }
  
  const orgSlugs = Object.keys(data);
  
  if (orgSlugs.length === 0) {
    throw new Error('No organizations found. Please ensure you have access to at least one Fly.io organization.');
  }
  
  return data;
}

/**
 * Prompt user to select an organization
 */
export async function selectOrganization(): Promise<string> {
  const orgs = await getOrganizations();
  const orgSlugs = Object.keys(orgs);
  
  // If only one org, use it automatically
  if (orgSlugs.length === 1) {
    const slug = orgSlugs[0];
    console.log(chalk.green(`✓ Using organization: ${orgs[slug]} (${slug})\n`));
    return slug;
  }
  
  // Multiple orgs - let user choose
  const inquirer = (await import('inquirer')).default;
  
  const choices = orgSlugs.map(slug => ({
    name: `${orgs[slug]} (${slug})`,
    value: slug,
  }));
  
  // Put personal org first if it exists
  const personalIndex = choices.findIndex(c => c.value === 'personal' || c.value.toLowerCase().includes('personal'));
  if (personalIndex > 0) {
    const personalOrg = choices.splice(personalIndex, 1)[0];
    choices.unshift(personalOrg);
  }
  
  const { selectedOrg } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedOrg',
      message: 'Select a Fly.io organization:',
      choices,
      default: choices[0].value,
    },
  ]);
  
  return selectedOrg;
}

/**
 * Create a new Fly.io app using GraphQL
 */
export async function createFlyApp(appName: string, orgSlug: string, region: string = 'iad'): Promise<void> {
  try {
    // First get the organization ID from slug
    const orgs = await withFlyGraphQL(async (sdk) => {
      const result = await sdk.GetCurrentUser();
      return result.data.viewer.organizations?.nodes || [];
    });
    
    const org = orgs?.find((o: any) => o.slug === orgSlug);
    if (!org) {
      throw new Error(`Organization '${orgSlug}' not found`);
    }

    // Create the app via GraphQL
    await withFlyGraphQL(async (sdk) => {
      return sdk.CreateApp({
        input: {
          organizationId: org.id,
          name: appName,
          preferredRegion: region,
          machines: true, // Use machines platform
        },
      });
    });
  } catch (error) {
    throw new Error(`Failed to create Fly.io app: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Provision Managed Postgres database (fly mpg)
 */
export async function provisionPostgres(
  appName: string,
  orgSlug: string,
  region: string = 'iad'
): Promise<{ connectionString: string; password: string }> {
  const dbName = `${appName}-db`;
  
  // Create Managed Postgres with specific tier to avoid interactive prompts
  const createResult = await executeFlyCommand(
    [
      'mpg',
      'create',
      '--name',
      dbName,
      '--org',
      orgSlug,
      '--region',
      region,
      '--plan',
      'basic',
      '--volume-size',
      '10',
    ],
    { silent: true }
  );

  if (createResult.exitCode !== 0) {
    const errorMsg = createResult.stderr || createResult.stdout || 'Unknown error';
    throw new Error(`Failed to create Managed Postgres database: ${errorMsg}`);
  }

  console.log(chalk.gray(`\n  Cluster creation initiated. Waiting for initialization...\n`));
  
  // Give the cluster a moment to start initializing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Wait for cluster to be ready by polling via CLI
  console.log(chalk.gray(`  Polling cluster status...`));
  const maxRetries = 20;
  let clusterReady = false;
  let clusterId = '';
  
  for (let i = 0; i < maxRetries; i++) {
    // List clusters to find ours and get its status
    const listResult = await executeFlyCommand(['mpg', 'list', '--org', orgSlug], { silent: true });
    
    if (listResult.exitCode === 0) {
      const lines = listResult.stdout.split('\n');
      const clusterLine = lines.find(line => line.includes(dbName));
      
      if (clusterLine) {
        // Parse the cluster ID and status from the line
        // Format: "ID              	NAME                    	ORG    	REGION	STATUS	PLAN"
        const match = clusterLine.match(/^([a-z0-9]+)\s+\S+\s+\S+\s+\S+\s+(\S+)/);
        
        if (match) {
          clusterId = match[1];
          const status = match[2];
          
          console.log(chalk.gray(`  [${i + 1}/${maxRetries}] Cluster ${clusterId}: ${status}`));
          
          if (status === 'ready') {
            clusterReady = true;
            console.log(chalk.green(`  ✓ Cluster is ready!\n`));
            break;
          }
        }
      } else {
        console.log(chalk.gray(`  [${i + 1}/${maxRetries}] Waiting for cluster to appear...`));
      }
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    }
  }

  if (!clusterReady || !clusterId) {
    throw new Error(`Postgres cluster ${dbName} is not ready after ${maxRetries * 3} seconds. Check with: fly mpg list --org ${orgSlug}`);
  }

  // Now attach via CLI using the cluster ID (not name!)
  console.log(chalk.gray(`  Attaching cluster ${clusterId} to app ${appName}...\n`));
  const attachResult = await executeFlyCommand(
    [
      'mpg',
      'attach',
      clusterId,  // Use cluster ID, not name!
      '--app',
      appName,
    ],
    { silent: true }
  );

  if (attachResult.exitCode !== 0) {
    const errorMsg = attachResult.stderr || attachResult.stdout || 'Unknown error';
    throw new Error(`Failed to attach Managed Postgres database: ${errorMsg}`);
  }

  // Get the actual connection string by checking the cluster status
  const statusResult = await executeFlyCommand(['mpg', 'status', clusterId, '--json'], { silent: true });
  
  let connectionString = 'postgresql://placeholder';
  let password = 'unknown';
  
  if (statusResult.exitCode === 0) {
    try {
      const statusData = JSON.parse(statusResult.stdout);
      if (statusData.credentials?.pgbouncer_uri) {
        connectionString = statusData.credentials.pgbouncer_uri;
        password = statusData.credentials.password || 'unknown';
      }
    } catch (error) {
      console.log(chalk.yellow('  Warning: Could not parse connection string from status'));
    }
  }

  return {
    connectionString,
    password,
  };
}

/**
 * Provision Redis instance using GraphQL
 */
export async function provisionRedis(
  appName: string,
  orgSlug: string,
  region: string = 'iad'
): Promise<string> {
  const redisName = `${appName}-redis`;
  
  try {
    // Get organization ID
    const orgs = await withFlyGraphQL(async (sdk) => {
      const result = await sdk.GetCurrentUser();
      return result.data.viewer.organizations?.nodes || [];
    });
    
    const org = orgs?.find((o: any) => o.slug === orgSlug);
    if (!org) {
      throw new Error(`Organization '${orgSlug}' not found`);
    }

    // Get app ID to attach Redis to
    const appData = await withFlyGraphQL(async (sdk) => sdk.GetApp({ name: appName }));
    if (!appData.data.app) {
      throw new Error(`App '${appName}' not found`);
    }

    // Create Redis add-on via GraphQL
    const result = await withFlyGraphQL(async (sdk) => {
      return sdk.CreateRedis({
        input: {
          organizationId: org.id,
          appId: appData.data.app!.id,  // Attach to app automatically
          type: AddOnType.UpstashRedis,
          name: redisName,
          primaryRegion: region,
        },
      });
    });

    const addOn = result.data.createAddOn?.addOn;
    if (!addOn) {
      throw new Error('Failed to create Redis add-on');
    }

    // Redis URL is available in the environment
    const redisUrl = addOn.publicUrl || `redis://${redisName}.internal:6379`;
    return redisUrl;
  } catch (error) {
    throw new Error(`Failed to create Redis instance: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Provision Tigris object storage using GraphQL
 */
export async function provisionTigris(
  appName: string,
  orgSlug: string,
  region: string = 'iad'
): Promise<{ bucketName: string; credentials: any }> {
  const tigrisName = `${appName}-storage`;
  
  try {
    // Get organization ID
    const orgs = await withFlyGraphQL(async (sdk) => {
      const result = await sdk.GetCurrentUser();
      return result.data.viewer.organizations?.nodes || [];
    });
    
    const org = orgs?.find((o: any) => o.slug === orgSlug);
    if (!org) {
      throw new Error(`Organization '${orgSlug}' not found`);
    }

    // Get app ID to attach Tigris to
    const appData = await withFlyGraphQL(async (sdk) => sdk.GetApp({ name: appName }));
    if (!appData.data.app) {
      throw new Error(`App '${appName}' not found`);
    }

    // Create Tigris storage via GraphQL
    const result = await withFlyGraphQL(async (sdk) => {
      return sdk.CreateTigris({
        input: {
          organizationId: org.id,
          appId: appData.data.app!.id,  // Attach to app automatically
          type: AddOnType.Tigris,
          name: tigrisName,
          primaryRegion: region,
        },
      });
    });

    const addOn = result.data.createAddOn?.addOn;
    if (!addOn) {
      throw new Error('Failed to create Tigris storage');
    }

    // Tigris credentials are in the environment
    return {
      bucketName: tigrisName,
      credentials: addOn.environment || {},
    };
  } catch (error) {
    throw new Error(`Failed to create Tigris storage: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Set environment secrets using GraphQL
 */
export async function setSecrets(
  appName: string,
  secrets: Record<string, string>,
  cwd: string
): Promise<void> {
  try {
    // Get the app to find its ID
    const appData = await withFlyGraphQL(async (sdk) => {
      return sdk.GetApp({ name: appName });
    });

    const app = appData.data.app;
    if (!app) {
      throw new Error(`App '${appName}' not found`);
    }

    // Set secrets via GraphQL
    await withFlyGraphQL(async (sdk) => {
      return sdk.SetSecrets({
        input: {
          appId: app.id,
          secrets: Object.entries(secrets).map(([key, value]) => ({ key, value })),
        },
      });
    });
  } catch (error) {
    throw new Error(`Failed to set secrets: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Deploy to Fly.io
 */
export async function deployToFly(appPath: string, appName: string): Promise<void> {
  const result = await executeFlyCommand(
    ['deploy', '--app', appName],
    { cwd: appPath, silent: true }
  );

  if (result.exitCode !== 0) {
    throw new Error(`Deployment failed: ${result.stderr || result.stdout}`);
  }
}

/**
 * Get app status and URLs
 */
export async function getAppInfo(appName: string): Promise<{
  hostname: string;
  status: string;
}> {
  const result = await executeFlyCommand(
    ['status', '--app', appName, '--json'],
    { silent: true }
  );

  if (result.exitCode !== 0) {
    // If status fails, just return default values
    return {
      hostname: `${appName}.fly.dev`,
      status: 'deployed',
    };
  }

  try {
    const status = JSON.parse(result.stdout);
    return {
      hostname: status.Hostname || `${appName}.fly.dev`,
      status: status.Status || 'unknown',
    };
  } catch {
    return {
      hostname: `${appName}.fly.dev`,
      status: 'deployed',
    };
  }
}

/**
 * Open the app in the browser
 */
export async function openApp(appName: string): Promise<void> {
  await executeFlyCommand(['open', '--app', appName]);
}

/**
 * Get detailed app status including machines using GraphQL
 */
export async function getAppStatus(appName: string): Promise<{
  status: string;
  hostname: string;
  machines?: Array<{
    id: string;
    state: string;
    region: string;
    process_group?: string;
  }>;
}> {
  try {
    const appData = await withFlyGraphQL(async (sdk) => {
      return sdk.GetApp({ name: appName });
    });

    if (!appData.data.app) {
      throw new Error(`App '${appName}' not found`);
    }

    // Extract machine info
    const machines = appData.data.app.machines?.nodes?.map((m: any) => ({
      id: m.id,
      state: m.state,
      region: m.region,
      process_group: m.name, // Machine name often indicates process group
    })) || [];

    return {
      status: appData.data.app.status || 'unknown',
      hostname: appData.data.app.hostname || `${appName}.fly.dev`,
      machines,
    };
  } catch (error) {
    // Fallback to default if app not found
    return {
      status: 'unknown',
      hostname: `${appName}.fly.dev`,
      machines: [],
    };
  }
}

/**
 * Stream logs from Fly.io
 */
export async function streamLogs(appName: string, options: {
  process?: string;
  follow?: boolean;
} = {}): Promise<void> {
  const args = ['logs', '--app', appName];
  
  if (options.process) {
    args.push('--process', options.process);
  }
  
  if (options.follow !== false) {
    args.push('--follow');
  }

  await executeFlyCommand(args, { interactive: true });
}

/**
 * Check if an app exists using GraphQL
 */
export async function appExists(appName: string): Promise<boolean> {
  try {
    const appData = await withFlyGraphQL(async (sdk) => {
      return sdk.GetApp({ name: appName });
    });
    
    return !!appData.data.app;
  } catch {
    return false;
  }
}
