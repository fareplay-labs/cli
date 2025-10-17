import chalk from 'chalk';
import inquirer from 'inquirer';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { displaySectionHeader, displayWarningBox } from '../utils/banner';

interface KeygenOptions {
  output?: 'env' | 'json' | 'both';
  label?: string;
}

/**
 * Generate a new Solana keypair for casino configuration
 */
export async function keygenCommand(options: KeygenOptions = {}): Promise<void> {
  console.log(chalk.bold.cyan('\n🔑 Fare Protocol Keypair Generator\n'));

  // Ask what the keypair is for if not provided
  let purpose = options.label;
  if (!purpose) {
    const { selectedPurpose } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedPurpose',
        message: 'What is this keypair for?',
        choices: [
          { name: 'Heartbeat Service (HEARTBEAT_PRIVATE_KEY)', value: 'heartbeat' },
          { name: 'Casino Owner/Manager (SOLANA_OWNER_ADDRESS)', value: 'owner' },
          { name: 'Custom Purpose', value: 'custom' },
        ],
      },
    ]);
    purpose = selectedPurpose;

    if (purpose === 'custom') {
      const { customLabel } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customLabel',
          message: 'Enter a label for this keypair:',
          default: 'custom-key',
        },
      ]);
      purpose = customLabel;
    }
  }

  // Generate keypair
  console.log(chalk.dim('\nGenerating new Solana keypair...'));
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  const privateKeyArray = JSON.stringify(Array.from(keypair.secretKey));

  // Determine output format
  let outputFormat = options.output;
  if (!outputFormat) {
    const { format } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'How would you like to export this keypair?',
        choices: [
          { name: '.env format (for backend)', value: 'env' },
          { name: 'JSON format (byte array)', value: 'json' },
          { name: 'Both formats', value: 'both' },
        ],
      },
    ]);
    outputFormat = format;
  }

  // Display results
  console.log(chalk.green('\n✓ Keypair generated successfully!\n'));

  displaySectionHeader('Public Key (Address)');
  console.log(chalk.bold.white(publicKey));
  console.log(chalk.dim('This is your public address - safe to share.\n'));

  if (outputFormat === 'env' || outputFormat === 'both') {
    displaySectionHeader('.env Format');
    
    if (purpose === 'heartbeat') {
      console.log(chalk.yellow(`HEARTBEAT_PRIVATE_KEY=${privateKeyBase58}`));
      console.log(chalk.dim('\nAdd this to your apps/api/.env file'));
      console.log(chalk.dim('This key signs heartbeat requests to the discovery service.\n'));
    } else if (purpose === 'owner') {
      console.log(chalk.yellow(`SOLANA_OWNER_ADDRESS=${publicKey}`));
      console.log(chalk.dim('\nAdd this to your apps/api/.env file'));
      console.log(chalk.dim('This is the casino owner/manager wallet address.\n'));
      console.log(chalk.red('⚠️  IMPORTANT: Keep the private key secret!'));
      console.log(chalk.dim(`Private Key (base58): ${privateKeyBase58}\n`));
    } else {
      const envVarName = (purpose || 'custom').toUpperCase().replace(/[^A-Z0-9]/g, '_');
      console.log(chalk.yellow(`${envVarName}_PRIVATE_KEY=${privateKeyBase58}`));
      console.log(chalk.dim('\nAdd this to your .env file\n'));
    }
  }

  if (outputFormat === 'json' || outputFormat === 'both') {
    displaySectionHeader('JSON Format (Byte Array)');
    console.log(chalk.yellow(privateKeyArray));
    console.log(chalk.dim('\nUse this format for Solana CLI or wallet imports\n'));
  }

  // Security warning
  displayWarningBox(
    'Security Warning',
    [
      '🔒 Never share your private key with anyone',
      '🔒 Never commit private keys to git',
      '🔒 Store private keys in .env files (which are git-ignored)',
      '🔒 Use different keypairs for different environments',
    ]
  );

  // Save to file option
  const { saveToFile } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveToFile',
      message: 'Would you like to save this to a file?',
      default: false,
    },
  ]);

  if (saveToFile) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: 'Enter filename (without extension):',
        default: `keypair-${purpose}-${Date.now()}`,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Filename cannot be empty';
          }
          return true;
        },
      },
    ]);

    const { fileFormat } = await inquirer.prompt([
      {
        type: 'list',
        name: 'fileFormat',
        message: 'Select file format:',
        choices: [
          { name: 'JSON (Solana standard)', value: 'json' },
          { name: 'Text (base58)', value: 'txt' },
        ],
      },
    ]);

    const sanitizedFilename = filename.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    const filepath = path.join(process.cwd(), `${sanitizedFilename}.${fileFormat}`);

    const content = fileFormat === 'json' 
      ? privateKeyArray 
      : `Public Key: ${publicKey}\nPrivate Key: ${privateKeyBase58}`;

    await fs.writeFile(filepath, content, 'utf-8');
    console.log(chalk.green(`\n✓ Keypair saved to: ${filepath}`));
    console.log(chalk.red('⚠️  Remember to delete this file or move it to a secure location!\n'));
  }

  console.log(chalk.cyan('\n✨ Done!\n'));
}

