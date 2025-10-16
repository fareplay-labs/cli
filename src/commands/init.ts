import chalk from 'chalk';
import { Listr } from 'listr2';
import { cloneCasinoBackend, casinoExists, getCasinoPath } from '../utils/git';
import { runConfigWizard } from '../utils/prompts';
import { saveCasinoConfig, generateEnvFile } from '../utils/config';
import { 
  checkFlyCliInstalled, 
  checkFlyAuth, 
  authenticateFly,
  selectOrganization,
  createFlyApp,
  provisionPostgres,
  provisionRedis,
  provisionTigris,
  setSecrets,
  deployToFly,
  getAppInfo,
} from '../utils/fly';
import {
  installDependencies,
  generatePrismaClient,
  runPrismaMigrations,
  buildProject,
} from '../utils/npm';
import { installFlyCli, fixFlyPermissions, addToCurrentProcessPath } from '../utils/install';
import { displayBanner, displayCasinoDetails, displayInfoBox, displaySectionHeader } from '../utils/banner';
import { CasinoConfig } from '../types';
import inquirer from 'inquirer';
import { withFullscreen } from '../utils/terminal';

interface InitContext {
  casinoName: string;
  casinoPath: string;
  config: CasinoConfig;
  flyAppName: string;
  flyOrgSlug: string;
  postgresPassword: string;
}

/**
 * Validate casino name
 */
function validateCasinoName(name: string): void {
  const validNameRegex = /^[a-z0-9-]+$/;
  
  if (!name) {
    throw new Error('Casino name is required');
  }
  
  if (!validNameRegex.test(name)) {
    throw new Error(
      'Casino name must contain only lowercase letters, numbers, and hyphens'
    );
  }
  
  if (name.length < 3) {
    throw new Error('Casino name must be at least 3 characters long');
  }
  
  if (name.length > 30) {
    throw new Error('Casino name must be less than 30 characters');
  }
  
  if (name.startsWith('-') || name.endsWith('-')) {
    throw new Error('Casino name cannot start or end with a hyphen');
  }
}

/**
 * Generate a Fly.io app name from casino name
 */
function generateFlyAppName(casinoName: string): string {
  // Fly.io app names must be unique, so we could add a random suffix
  return `fare-${casinoName}`;
}

/**
 * Initialize a new custom casino
 */
export async function initCommand(casinoName: string): Promise<void> {
  return withFullscreen(async () => {
    // Display banner
    displayBanner();

  // Validate casino name
  try {
    validateCasinoName(casinoName);
  } catch (error) {
    throw new Error(`Invalid casino name: ${error instanceof Error ? error.message : error}`);
  }

  // Check if casino already exists
  if (await casinoExists(casinoName)) {
    throw new Error(
      `Casino "${casinoName}" already exists at ${getCasinoPath(casinoName)}\n` +
      'Please choose a different name or remove the existing directory.'
    );
  }

  console.log(chalk.cyan('  Casino:'), chalk.white.bold(casinoName));
  console.log('');

  // Check Fly CLI installation - REQUIRED
  console.log(chalk.cyan('🔍 Checking prerequisites...\n'));
  
  let flyInstalled = await checkFlyCliInstalled();
  
  if (!flyInstalled) {
    // Try to fix permissions first (in case it's installed but not executable)
    console.log(chalk.gray('Checking for Fly CLI installation issues...\n'));
    const fixed = await fixFlyPermissions();
    
    if (fixed) {
      flyInstalled = await checkFlyCliInstalled();
    }
  }
  
  if (!flyInstalled) {
    console.log(chalk.yellow('⚠️  Fly CLI is not installed.\n'));
    
    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: 'Would you like to install Fly CLI now?',
        default: true,
      },
    ]);

    if (shouldInstall) {
      const installSuccess = await installFlyCli();
      
      if (!installSuccess) {
        console.log(chalk.red('\n✗ Failed to install Fly CLI automatically.\n'));
        console.log(chalk.cyan('Please install manually:\n'));
        console.log(chalk.gray('  https://fly.io/docs/hands-on/install-flyctl/\n'));
        throw new Error('Fly CLI is required. Please install it and try again.');
      }
      
      // Installation successful and added to current process PATH
      flyInstalled = true;
    } else {
      console.log(chalk.red('\n✗ Fly CLI is required to deploy your casino.\n'));
      console.log(chalk.cyan('Install instructions:\n'));
      console.log(chalk.white('macOS:'));
      console.log(chalk.gray('  brew install flyctl\n'));
      console.log(chalk.white('Linux:'));
      console.log(chalk.gray('  curl -L https://fly.io/install.sh | sh\n'));
      console.log(chalk.white('Windows:'));
      console.log(chalk.gray('  powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"\n'));
      console.log(chalk.cyan('More info: https://fly.io/docs/hands-on/install-flyctl/\n'));
      throw new Error('Fly CLI is required. Please install it and try again.');
    }
  }

  console.log(chalk.green('✓ Fly CLI installed\n'));

  // Check Fly authentication - REQUIRED
  const flyAuthed = await checkFlyAuth();
  if (!flyAuthed) {
    console.log(chalk.yellow('⚠️  Not authenticated with Fly.io\n'));
    await authenticateFly();
    
    // Verify authentication succeeded
    const authCheck = await checkFlyAuth();
    if (!authCheck) {
      throw new Error('Fly.io authentication failed. Please try again.');
    }
  }

  console.log(chalk.green('✓ Authenticated with Fly.io\n'));

  // Let user select organization
  const flyOrgSlug = await selectOrganization();

  // Run configuration wizard
  const config = await runConfigWizard(casinoName);

  const flyAppName = generateFlyAppName(casinoName);

  const context: Partial<InitContext> = {
    casinoName,
    config,
    flyAppName,
    flyOrgSlug,
  };

  // Create task list for initialization
  const tasks = new Listr<InitContext>([
    {
      title: 'Cloning custom-casino-backend repository',
      task: async (ctx) => {
        ctx.casinoPath = await cloneCasinoBackend(ctx.casinoName);
      },
    },
    {
      title: 'Installing dependencies',
      task: async (ctx) => {
        await installDependencies(ctx.casinoPath);
      },
    },
    {
      title: 'Generating Prisma client',
      task: async (ctx) => {
        await generatePrismaClient(ctx.casinoPath);
      },
    },
    {
      title: 'Building project',
      task: async (ctx) => {
        await buildProject(ctx.casinoPath);
      },
    },
    {
      title: 'Creating Fly.io app',
      task: async (ctx) => {
        await createFlyApp(ctx.flyAppName, ctx.flyOrgSlug);
      },
    },
    {
      title: 'Provisioning Redis instance',
      task: async (ctx) => {
        const redisUrl = await provisionRedis(ctx.flyAppName, ctx.flyOrgSlug);
        ctx.config.redisUrl = redisUrl;
      },
    },
    {
      title: 'Provisioning Tigris object storage',
      task: async (ctx) => {
        const { bucketName } = await provisionTigris(ctx.flyAppName, ctx.flyOrgSlug);
        ctx.config.tigrisBucket = bucketName;
      },
    },
    {
      title: 'Provisioning Postgres database',
      task: async (ctx) => {
        const { connectionString, password } = await provisionPostgres(ctx.flyAppName, ctx.flyOrgSlug);
        ctx.config.postgresUrl = connectionString;
        ctx.config.databasePassword = password;
        ctx.postgresPassword = password;
      },
    },
    {
      title: 'Generating configuration files',
      task: async (ctx) => {
        await saveCasinoConfig(ctx.casinoName, ctx.config);
        await generateEnvFile(ctx.casinoName, ctx.config);
      },
    },
    {
      title: 'Setting environment secrets',
      task: async (ctx) => {
        const secrets = {
          CASINO_NAME: ctx.config.casinoName,
          OWNER_WALLET: ctx.config.ownerWallet,
          SOLANA_RPC_URL: ctx.config.solanaRpcUrl,
          JWT_SECRET: ctx.config.jwtSecret,
          DATABASE_URL: ctx.config.postgresUrl!,
          REDIS_URL: ctx.config.redisUrl!,
          NODE_ENV: 'production',
        };
        await setSecrets(ctx.flyAppName, secrets, ctx.casinoPath);
      },
    },
    {
      title: 'Deploying to Fly.io',
      task: async (ctx) => {
        await deployToFly(ctx.casinoPath, ctx.flyAppName);
      },
    },
  ]);

  try {
    await tasks.run(context as InitContext);

    // Get app info
    const appInfo = await getAppInfo(context.flyAppName!);
    
    // Display success with beautiful box
    displayCasinoDetails({
      name: context.config!.casinoName,
      owner: context.config!.ownerWallet,
      app: context.flyAppName!,
      apiUrl: `https://${appInfo.hostname}`,
      wsUrl: `wss://${appInfo.hostname}:3001`,
      healthUrl: `https://${appInfo.hostname}/health`,
      postgres: `${context.flyAppName}-db`,
      redis: `${context.flyAppName}-redis`,
      tigris: `${context.flyAppName}-storage`,
      password: context.postgresPassword,
    });

    // Display local files info
    displayInfoBox('📁 Local Files', [
      `${chalk.gray('Project:')}      ${chalk.white(context.casinoPath)}`,
      `${chalk.gray('Config:')}       ${chalk.white('fare.config.json')}`,
      `${chalk.gray('Environment:')}  ${chalk.white('.env')}`,
    ]);

    // Display next steps
    displaySectionHeader('Next Steps');
    console.log(chalk.white('  1.'), chalk.cyan('Test your API:'));
    console.log(chalk.gray(`     curl https://${appInfo.hostname}/health\n`));
    console.log(chalk.white('  2.'), chalk.cyan('View logs:'));
    console.log(chalk.gray(`     fare logs\n`));
    console.log(chalk.white('  3.'), chalk.cyan('Check status:'));
    console.log(chalk.gray(`     fare status\n`));
    console.log(chalk.white('  4.'), chalk.cyan('Build your frontend and connect to the API!'));
    console.log('');

  } catch (error) {
    console.error(chalk.red.bold('\n✗ Initialization failed\n'));
    throw error;
  }
  }); // Close withFullscreen
}
