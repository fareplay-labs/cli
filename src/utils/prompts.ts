import inquirer from 'inquirer';
import crypto from 'crypto';
import chalk from 'chalk';
import { CasinoConfig } from '../types';

/**
 * Generate a secure random JWT secret
 */
function generateJwtSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate Solana wallet address (basic validation)
 */
function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Run interactive configuration wizard
 */
export async function runConfigWizard(casinoName: string): Promise<CasinoConfig> {
  console.log(chalk.cyan('\n🎰 Casino Configuration Wizard\n'));
  console.log(chalk.gray('Please provide the following information to configure your casino:\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'ownerWallet',
      message: 'Solana owner wallet address:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Owner wallet address is required';
        }
        if (!isValidSolanaAddress(input.trim())) {
          return 'Please enter a valid Solana wallet address (base58 encoded, 32-44 characters)';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'rpcType',
      message: 'Solana RPC provider:',
      choices: [
        { name: 'Mainnet Beta (default)', value: 'mainnet' },
        { name: 'Devnet', value: 'devnet' },
        { name: 'Custom RPC URL', value: 'custom' },
      ],
      default: 'mainnet',
    },
    {
      type: 'input',
      name: 'customRpcUrl',
      message: 'Custom Solana RPC URL:',
      when: (answers: any) => answers.rpcType === 'custom',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'RPC URL is required';
        }
        try {
          new URL(input.trim());
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'confirm',
      name: 'autoGenerateJwt',
      message: 'Auto-generate JWT secret?',
      default: true,
    },
    {
      type: 'password',
      name: 'jwtSecret',
      message: 'JWT secret:',
      when: (answers: any) => !answers.autoGenerateJwt,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'JWT secret is required';
        }
        if (input.length < 32) {
          return 'JWT secret should be at least 32 characters for security';
        }
        return true;
      },
    },
  ]);

  // Determine RPC URL based on selection
  let solanaRpcUrl: string;
  switch (answers.rpcType) {
    case 'mainnet':
      solanaRpcUrl = 'https://api.mainnet-beta.solana.com';
      break;
    case 'devnet':
      solanaRpcUrl = 'https://api.devnet.solana.com';
      break;
    case 'custom':
      solanaRpcUrl = answers.customRpcUrl;
      break;
    default:
      solanaRpcUrl = 'https://api.mainnet-beta.solana.com';
  }

  // Generate or use provided JWT secret
  const jwtSecret = answers.autoGenerateJwt ? generateJwtSecret() : answers.jwtSecret;

  const config: CasinoConfig = {
    casinoName,
    ownerWallet: answers.ownerWallet.trim(),
    jwtSecret,
    solanaRpcUrl,
  };

  // Display configuration summary
  console.log(chalk.green('\n✓ Configuration complete!\n'));
  console.log(chalk.cyan('Summary:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`Casino Name:    ${chalk.white(config.casinoName)}`);
  console.log(`Owner Wallet:   ${chalk.white(config.ownerWallet)}`);
  console.log(`Solana RPC:     ${chalk.white(config.solanaRpcUrl)}`);
  console.log(`JWT Secret:     ${chalk.white(jwtSecret.substring(0, 8) + '...')}`);
  console.log(chalk.gray('─'.repeat(50)));

  const { confirmConfig } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmConfig',
      message: 'Proceed with this configuration?',
      default: true,
    },
  ]);

  if (!confirmConfig) {
    console.log(chalk.yellow('\nConfiguration cancelled. Please run the command again.'));
    process.exit(0);
  }

  return config;
}

/**
 * Prompt for confirmation before destructive operations
 */
export async function confirmDestructiveAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);

  return confirmed;
}

