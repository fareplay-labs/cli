import chalk from 'chalk';
import { getCurrentCasinoPath, loadCasinoConfig } from '../utils/config';
import { checkFlyAuth, getAppStatus, appExists } from '../utils/fly';
import { displaySectionHeader, displayInfoBox } from '../utils/banner';
import { withFullscreen } from '../utils/terminal';

/**
 * Status command - check deployment health and status
 */
export async function statusCommand(): Promise<void> {
  return withFullscreen(async () => {
    displaySectionHeader('📊 Casino Status');
  
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

  // Check if app exists
  const exists = await appExists(flyAppName);
  if (!exists) {
    console.log(chalk.red('✗ App not found on Fly.io\n'));
    console.log(chalk.yellow('This casino may not have been deployed yet.'));
    console.log(chalk.gray('Run'), chalk.cyan('fareplay deploy'), chalk.gray('to deploy it.\n'));
    return;
  }

  // Get app status
  console.log(chalk.gray('Fetching status from Fly.io...\n'));
  const appStatus = await getAppStatus(flyAppName);

  // Display app info
  const statusColor = appStatus.status === 'running' ? chalk.green : chalk.yellow;
  
  displayInfoBox('🚀 Deployment Status', [
    `${chalk.gray('App:')}        ${chalk.white(flyAppName)}`,
    `${chalk.gray('Status:')}     ${statusColor(appStatus.status)}`,
    `${chalk.gray('Hostname:')}   ${chalk.cyan(appStatus.hostname)}`,
  ]);

  // Display process groups
  if (appStatus.machines && appStatus.machines.length > 0) {
    const processGroups = new Map<string, Array<{ id: string; state: string; region: string }>>();
    
    for (const machine of appStatus.machines) {
      const group = machine.process_group || 'default';
      if (!processGroups.has(group)) {
        processGroups.set(group, []);
      }
      processGroups.get(group)!.push({
        id: machine.id,
        state: machine.state,
        region: machine.region,
      });
    }

    const processInfo: string[] = [];
    for (const [group, machines] of processGroups) {
      const runningCount = machines.filter(m => m.state === 'started').length;
      const totalCount = machines.length;
      const stateColor = runningCount === totalCount ? chalk.green : chalk.yellow;
      
      processInfo.push(
        `${chalk.gray(`${group}:`)}  ${stateColor(`${runningCount}/${totalCount} running`)}  ${chalk.gray(`(${machines[0]?.region || 'unknown'})`)}`
      );
    }

    displayInfoBox('⚙️  Processes', processInfo);
  }

  // Display service URLs
  displayInfoBox('🌐 Service URLs', [
    `${chalk.gray('API:')}        ${chalk.cyan(`https://${appStatus.hostname}`)}`,
    `${chalk.gray('WebSocket:')}  ${chalk.cyan(`wss://${appStatus.hostname}:3001`)}`,
    `${chalk.gray('Health:')}     ${chalk.cyan(`https://${appStatus.hostname}/health`)}`,
  ]);

  // Display helpful commands
  displaySectionHeader('Quick Actions');
  console.log(chalk.white('  •'), chalk.cyan('View logs:'));
  console.log(chalk.gray(`    fareplay logs\n`));
  console.log(chalk.white('  •'), chalk.cyan('Test API:'));
  console.log(chalk.gray(`    curl https://${appStatus.hostname}/health\n`));
  console.log(chalk.white('  •'), chalk.cyan('Redeploy:'));
  console.log(chalk.gray(`    fareplay deploy\n`));
  console.log('');
  }); // Close withFullscreen
}

