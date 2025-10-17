export interface CasinoConfig {
  casinoName: string;
  ownerWallet: string;
  jwtSecret: string;
  solanaRpcUrl: string;
  heartbeatPrivateKey: string;
  frontendUrl: string;
  postgresUrl?: string;
  redisUrl?: string;
  tigrisBucket?: string;
  databasePassword?: string;
}

export interface CasinoMetadata {
  casinoName: string;
  createdAt: string;
  deploymentPath: string;
  flyAppName?: string;
}

