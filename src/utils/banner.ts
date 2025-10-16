import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Display the Fare Protocol banner
 */
export function displayBanner(): void {
  try {
    // Read logo from text file
    // Pick a random text file from assets directory as logo
    const assetsDir = join(__dirname, '..', 'assets');
    const logoFiles = require('fs').readdirSync(assetsDir)
      .filter((file: string) => file.startsWith('logo') && file.endsWith('.txt'));
    const chosenLogo = logoFiles[Math.floor(Math.random() * logoFiles.length)] || 'logo.txt';
    const logoPath = join(assetsDir, chosenLogo);
    const logo = readFileSync(logoPath, 'utf-8');
    
    // Apply gradient to logo
    const gradientLogo = gradient.pastel.multiline(logo);
    
    console.log(gradientLogo);
  } catch (error) {
    // Fallback if logo file not found
    console.log(chalk.cyan.bold('\n  FARE Protocol Casino Deployer\n'));
  }
}

/**
 * Display a success box
 */
export function displaySuccessBox(title: string, content: string[]): void {
  const message = [
    chalk.green.bold(title),
    '',
    ...content,
  ].join('\n');

  console.log(
    boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
    })
  );
}

/**
 * Display an info box
 */
export function displayInfoBox(title: string, content: string[]): void {
  const message = [
    chalk.cyan.bold(title),
    '',
    ...content,
  ].join('\n');

  console.log(
    boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
}

/**
 * Display a warning box
 */
export function displayWarningBox(title: string, content: string[]): void {
  const message = [
    chalk.yellow.bold(title),
    '',
    ...content,
  ].join('\n');

  console.log(
    boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    })
  );
}

/**
 * Display a section header with gradient
 */
export function displaySectionHeader(text: string): void {
  const header = `\n  ${text}  `;
  console.log(gradient.cristal(header));
  console.log(chalk.gray('  ' + '─'.repeat(text.length)));
}

/**
 * Display casino details in a nice box
 */
export function displayCasinoDetails(details: {
  name: string;
  owner: string;
  app: string;
  apiUrl: string;
  wsUrl: string;
  healthUrl: string;
  postgres: string;
  redis: string;
  tigris?: string;
  password?: string;
}): void {
  const content = [
    `${chalk.cyan('Casino Name:')}    ${chalk.white(details.name)}`,
    `${chalk.cyan('Owner Wallet:')}   ${chalk.white(details.owner.substring(0, 20) + '...')}`,
    `${chalk.cyan('Fly.io App:')}     ${chalk.white(details.app)}`,
    '',
    chalk.bold('🌐 Endpoints:'),
    `  ${chalk.gray('API:')}        ${chalk.white(details.apiUrl)}`,
    `  ${chalk.gray('WebSocket:')}  ${chalk.white(details.wsUrl)}`,
    `  ${chalk.gray('Health:')}     ${chalk.white(details.healthUrl)}`,
    '',
    chalk.bold('🗄️  Infrastructure:'),
    `  ${chalk.gray('Postgres:')}   ${chalk.white(details.postgres)}`,
    `  ${chalk.gray('Redis:')}      ${chalk.white(details.redis)}`,
  ];

  if (details.tigris) {
    content.push(`  ${chalk.gray('Storage:')}    ${chalk.white(details.tigris)}`);
  }

  if (details.password && !details.password.includes('DATABASE_URL')) {
    content.push(`  ${chalk.gray('DB Password:')} ${chalk.white(details.password)}`);
  } else {
    content.push(`  ${chalk.gray('Connection:')} ${chalk.white('Via DATABASE_URL env var')}`);
  }

  displaySuccessBox('🎉 Your Casino is Live!', content);
}

