#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { deployCommand } from './commands/deploy';
import { statusCommand } from './commands/status';
import { logsCommand } from './commands/logs';
import { cleanupCommand } from './commands/cleanup';
import { keygenCommand } from './commands/keygen';

const program = new Command();

program
  .name('fare')
  .description('Command-line installer and deployment tool for Fare Protocol custom casinos on Solana')
  .version('0.1.0');

program
  .command('init <casino-name>')
  .description('Initialize and deploy a new custom casino')
  .action(async (casinoName: string) => {
    try {
      await initCommand(casinoName);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Rebuild and redeploy existing casino')
  .action(async () => {
    try {
      await deployCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check deployment health and status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('logs [service]')
  .description('Stream logs from services (api/processor/ws)')
  .action(async (service?: string) => {
    try {
      await logsCommand(service);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Delete all local casinos and Fly.io resources')
  .option('-o, --org <org>', 'Fly.io organization slug')
  .action(async (options) => {
    try {
      await cleanupCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('keygen')
  .description('Generate a new Solana keypair for casino configuration')
  .option('-o, --output <format>', 'Output format: env, json, or both')
  .option('-l, --label <label>', 'Label for the keypair (e.g., heartbeat, owner)')
  .action(async (options) => {
    try {
      await keygenCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

