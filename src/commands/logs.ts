import chalk from 'chalk';
import { getCurrentCasinoPath, loadCasinoConfig } from '../utils/config';
import { checkFlyAuth, streamLogs, appExists } from '../utils/fly';
import { displaySectionHeader } from '../utils/banner';

// Valid process groups based on fly.toml
const VALID_PROCESSES = ['api', 'ws', 'processor'];

/**
 * Logs command - stream logs from Fly.io
 */
export async function logsCommand(service?: string): Promise<void> {
  displaySectionHeader('📋 Casino Logs');
  
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
  
  if (service) {
    // Validate service name
    if (!VALID_PROCESSES.includes(service)) {
      console.log('');
      throw new Error(
        `Invalid process: "${service}"\n` +
        `Valid processes: ${VALID_PROCESSES.join(', ')}`
      );
    }
    console.log(chalk.cyan('  Process:'), chalk.white(service));
  } else {
    console.log(chalk.cyan('  Process:'), chalk.white('all'));
  }
  
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

  console.log(chalk.gray('Streaming logs... (Press Ctrl+C to stop)\n'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');

  try {
    // Stream logs from Fly.io
    await streamLogs(flyAppName, {
      process: service,
      follow: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('signal')) {
      // User interrupted with Ctrl+C
      console.log('');
      console.log(chalk.gray('\nLog streaming stopped.'));
    } else {
      throw error;
    }
  }
}

