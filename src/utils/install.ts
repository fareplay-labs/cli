import { spawn } from 'child_process';
import { platform, homedir } from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Execute a shell command
 */
async function executeCommand(
  command: string,
  args: string[],
  options: { shell?: boolean } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: options.shell || false,
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
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Detect the user's shell
 */
function detectShell(): string {
  const shell = process.env.SHELL || '';
  
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  
  // Default to zsh on macOS, bash on Linux
  return platform() === 'darwin' ? 'zsh' : 'bash';
}

/**
 * Get shell config file path
 */
function getShellConfigPath(shell: string): string {
  const home = homedir();
  
  switch (shell) {
    case 'zsh':
      return path.join(home, '.zshrc');
    case 'bash':
      // Check for .bash_profile first (macOS), then .bashrc
      return platform() === 'darwin'
        ? path.join(home, '.bash_profile')
        : path.join(home, '.bashrc');
    case 'fish':
      return path.join(home, '.config', 'fish', 'config.fish');
    default:
      return path.join(home, '.profile');
  }
}

/**
 * Add Fly to PATH in shell config
 */
async function addToPath(shell: string): Promise<void> {
  const configPath = getShellConfigPath(shell);
  const flyPath = path.join(homedir(), '.fly');
  
  const pathExport = shell === 'fish'
    ? `\n# Fly.io\nset -gx FLYCTL_INSTALL "$HOME/.fly"\nset -gx PATH "$FLYCTL_INSTALL/bin" $PATH\n`
    : `\n# Fly.io\nexport FLYCTL_INSTALL="$HOME/.fly"\nexport PATH="$FLYCTL_INSTALL/bin:$PATH"\n`;

  try {
    // Read existing config
    let configContent = '';
    try {
      configContent = await fs.readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist, that's okay
    }

    // Check if already added
    if (configContent.includes('FLYCTL_INSTALL')) {
      console.log(chalk.gray('Fly.io already in PATH config\n'));
      return;
    }

    // Append to config
    await fs.appendFile(configPath, pathExport, 'utf-8');
    console.log(chalk.green(`✓ Added Fly to ${configPath}\n`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not update ${configPath}: ${error}\n`));
  }
}

/**
 * Get the full path to flyctl after installation
 */
function getFlyCLIPath(): string {
  return path.join(homedir(), '.fly', 'bin', 'flyctl');
}

/**
 * Set environment PATH for current process
 */
export function addToCurrentProcessPath(): void {
  const flyPath = path.join(homedir(), '.fly', 'bin');
  process.env.PATH = `${flyPath}:${process.env.PATH}`;
  process.env.FLYCTL_INSTALL = path.join(homedir(), '.fly');
}

/**
 * Install Fly CLI based on the operating system
 */
export async function installFlyCli(): Promise<boolean> {
  const os = platform();
  const shell = detectShell();

  console.log(chalk.cyan(`\n📦 Installing Fly CLI for ${os}...\n`));

  try {
    let installSuccess = false;

    switch (os) {
      case 'darwin': {
        // macOS - try brew first, fallback to install script
        console.log(chalk.gray('Checking for Homebrew...\n'));
        
        const brewCheck = await executeCommand('which', ['brew']);
        
        if (brewCheck.exitCode === 0) {
          console.log(chalk.green('✓ Homebrew found, installing flyctl...\n'));
          const result = await executeCommand('brew', ['install', 'flyctl']);
          installSuccess = result.exitCode === 0;
          
          if (installSuccess) {
            console.log(chalk.green('✓ Fly CLI installed via Homebrew\n'));
          }
        } else {
          console.log(chalk.yellow('Homebrew not found, using install script...\n'));
          const result = await executeCommand(
            'sh',
            ['-c', 'curl -L https://fly.io/install.sh | sh'],
            { shell: true }
          );
          installSuccess = result.exitCode === 0;
          
          if (installSuccess) {
            console.log(chalk.green('\n✓ Fly CLI installed\n'));
            
            // Add to shell config
            console.log(chalk.cyan('📝 Configuring your shell...\n'));
            await addToPath(shell);
            
            // Add to current process PATH so it works immediately
            addToCurrentProcessPath();
            console.log(chalk.green('✓ Fly CLI is now available in this session\n'));
          }
        }
        break;
      }

      case 'linux': {
        console.log(chalk.gray('Using install script...\n'));
        const result = await executeCommand(
          'sh',
          ['-c', 'curl -L https://fly.io/install.sh | sh'],
          { shell: true }
        );
        installSuccess = result.exitCode === 0;
        
        if (installSuccess) {
          console.log(chalk.green('\n✓ Fly CLI installed\n'));
          
          // Add to shell config
          console.log(chalk.cyan('📝 Configuring your shell...\n'));
          await addToPath(shell);
          
          // Add to current process PATH so it works immediately
          addToCurrentProcessPath();
          console.log(chalk.green('✓ Fly CLI is now available in this session\n'));
        }
        break;
      }

      case 'win32': {
        console.log(chalk.gray('Using PowerShell install script...\n'));
        const result = await executeCommand(
          'powershell',
          ['-Command', 'iwr https://fly.io/install.ps1 -useb | iex'],
          { shell: true }
        );
        installSuccess = result.exitCode === 0;
        
        if (installSuccess) {
          console.log(chalk.green('\n✓ Fly CLI installed\n'));
          // Windows installer typically handles PATH automatically
        }
        break;
      }

      default: {
        console.log(chalk.red(`\n✗ Unsupported operating system: ${os}\n`));
        console.log(chalk.cyan('Please install Fly CLI manually:\n'));
        console.log(chalk.gray('  https://fly.io/docs/hands-on/install-flyctl/\n'));
        return false;
      }
    }

    return installSuccess;
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to install Fly CLI:\n'));
    console.error(error);
    return false;
  }
}

/**
 * Check if a command exists
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const result = await executeCommand('which', [command]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Fix fly CLI permissions if needed
 */
export async function fixFlyPermissions(): Promise<boolean> {
  const flyPath = path.join(homedir(), '.fly', 'bin', 'flyctl');
  
  try {
    // Check if file exists
    await fs.access(flyPath);
    
    // Try to fix permissions
    console.log(chalk.cyan('🔧 Fixing Fly CLI permissions...\n'));
    await fs.chmod(flyPath, 0o755);
    
    // Also create symlink if needed
    const flySymlink = path.join(homedir(), '.fly', 'bin', 'fly');
    try {
      await fs.unlink(flySymlink);
    } catch {
      // Symlink might not exist
    }
    
    try {
      await fs.symlink(flyPath, flySymlink);
    } catch {
      // Symlink creation failed, not critical
    }
    
    console.log(chalk.green('✓ Fly CLI permissions fixed\n'));
    
    // Add to current PATH
    addToCurrentProcessPath();
    
    return true;
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not fix permissions: ${error}\n`));
    return false;
  }
}

