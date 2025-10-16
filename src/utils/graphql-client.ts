import { GraphQLClient } from 'graphql-request';
import { getSdk } from '../generated/graphql';
import { spawn } from 'child_process';

/**
 * Get Fly.io API token
 */
async function getFlyAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('fly', ['auth', 'token'], {
      stdio: 'pipe',
      shell: true,
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

    proc.on('error', (error) => {
      reject(error);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to get Fly auth token: ${stderr}`));
        return;
      }

      // Get the first line (the actual token)
      const token = stdout.trim().split('\n')[0];
      resolve(token);
    });
  });
}

/**
 * Create a GraphQL client for Fly.io API
 */
export async function createFlyGraphQLClient() {
  const token = await getFlyAuthToken();
  
  const client = new GraphQLClient('https://api.fly.io/graphql', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return getSdk(client);
}

/**
 * Execute a GraphQL operation with automatic token handling
 */
export async function withFlyGraphQL<T>(
  operation: (sdk: ReturnType<typeof getSdk>) => Promise<T>
): Promise<T> {
  const sdk = await createFlyGraphQLClient();
  return operation(sdk);
}

