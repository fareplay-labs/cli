import chalk from 'chalk';
import { Listr } from 'listr2';
import { getCurrentCasinoPath, loadCasinoConfig } from '../utils/config';
import { checkFlyAuth, deployToFly, getAppInfo } from '../utils/fly';
import { buildProject, runPrismaMigrations } from '../utils/npm';
import { displaySectionHeader, displayInfoBox } from '../utils/banner';
import { withFullscreen } from '../utils/terminal';

interface DeployContext {
  casinoPath: string;
  casinoName: string;
  flyAppName: string;
}

/**
 * Deploy command - rebuild and redeploy existing casino
 */
export async function deployCommand(): Promise<void> {
  return withFullscreen(async () => {
    displaySectionHeader('🚀 Deploy Casino');
  
  // Get current casino path
  let casinoPath: string;
  try {
    casinoPath = await getCurrentCasinoPath();
  } catch (error) {
    throw new Error('Not in a casino directory. Please navigate to a casino directory first.');
  }

  // Load casino configuration
  const config = await loadCasinoConfig(casinoPath);
  const flyAppName = `fare-${config.casinoName}`;

  console.log(chalk.cyan('  Casino:'), chalk.white.bold(config.casinoName));
  console.log(chalk.cyan('  Fly App:'), chalk.white(flyAppName));
  console.log('');

  // Check Fly authentication
  const flyAuthed = await checkFlyAuth();
  if (!flyAuthed) {
    throw new Error(
      'Not authenticated with Fly.io. Please run:\n' +
      chalk.cyan('  fly auth login')
    );
  }

  const context: DeployContext = {
    casinoPath,
    casinoName: config.casinoName,
    flyAppName,
  };

  // Create task list for deployment
  const tasks = new Listr<DeployContext>([
    {
      title: 'Building project',
      task: async (ctx) => {
        await buildProject(ctx.casinoPath);
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
    await tasks.run(context);

    // Get app info
    const appInfo = await getAppInfo(flyAppName);
    
    // Display success
    console.log('');
    displayInfoBox('✅ Deployment Successful', [
      `${chalk.gray('App:')}        ${chalk.white(flyAppName)}`,
      `${chalk.gray('API URL:')}    ${chalk.cyan(`https://${appInfo.hostname}`)}`,
      `${chalk.gray('WS URL:')}     ${chalk.cyan(`wss://${appInfo.hostname}:3001`)}`,
      `${chalk.gray('Health:')}     ${chalk.cyan(`https://${appInfo.hostname}/health`)}`,
      `${chalk.gray('Status:')}     ${chalk.green(appInfo.status)}`,
    ]);

    // Display next steps
    displaySectionHeader('Next Steps');
    console.log(chalk.white('  1.'), chalk.cyan('Test your deployment:'));
    console.log(chalk.gray(`     curl https://${appInfo.hostname}/health\n`));
    console.log(chalk.white('  2.'), chalk.cyan('View logs:'));
    console.log(chalk.gray(`     fareplay logs\n`));
    console.log(chalk.white('  3.'), chalk.cyan('Check status:'));
    console.log(chalk.gray(`     fareplay status\n`));
    console.log('');

  } catch (error) {
    console.error(chalk.red.bold('\n✗ Deployment failed\n'));
    throw error;
  }
  }); // Close withFullscreen
}

