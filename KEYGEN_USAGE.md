# Keygen Command

The `fare keygen` command generates Solana keypairs for casino configuration.

## Usage

### Interactive Mode (Recommended)
```bash
fare keygen
```

This will prompt you for:
- What the keypair is for (heartbeat, owner, or custom)
- Output format (.env, JSON, or both)
- Whether to save to a file

### Command Line Options

Generate a heartbeat keypair in .env format:
```bash
fare keygen --label heartbeat --output env
```

Generate an owner keypair with both formats:
```bash
fare keygen --label owner --output both
```

Generate a custom keypair in JSON format:
```bash
fare keygen --label my-custom-key --output json
```

## Output Formats

### .env Format
Perfect for backend configuration. Outputs as:
```
HEARTBEAT_PRIVATE_KEY=5Jv8...base58...
```

### JSON Format  
Solana standard format (byte array):
```json
[123,45,67,...]
```

## Common Use Cases

### 1. Heartbeat Service Key
Generate a keypair for the heartbeat service that pings the discovery service:

```bash
fare keygen --label heartbeat --output env
```

Add the output to `apps/api/.env`:
```env
HEARTBEAT_PRIVATE_KEY=<generated-key>
```

### 2. Casino Owner/Manager Key
Generate or use an existing wallet as the casino manager:

```bash
fare keygen --label owner --output env
```

Add the **public key** to `apps/api/.env`:
```env
SOLANA_OWNER_ADDRESS=<public-key>
```

⚠️ **IMPORTANT**: Keep the private key in a secure wallet. Only add the public address to your .env file for the owner.

### 3. Custom Keys
For any other Solana keypair needs:

```bash
fare keygen --label custom --output both
```

## Security Best Practices

🔒 **Never commit private keys to git**
- `.env` files are git-ignored by default
- Double-check before committing any configuration

🔒 **Use different keys for different environments**
- Development
- Staging  
- Production

🔒 **Store production keys securely**
- Use Fly.io secrets: `fly secrets set HEARTBEAT_PRIVATE_KEY=...`
- Use a password manager for backups
- Consider hardware wallets for high-value owner keys

## Examples

### Quick Generate for Development
```bash
# Generate heartbeat key
fare keygen --label heartbeat --output env

# Copy output to .env file
# HEARTBEAT_PRIVATE_KEY=...
```

### Generate and Save to File
```bash
fare keygen
# Choose options in interactive mode
# Select "Yes" when asked to save to file
# Move the file to a secure location
```

### Generate Multiple Keys
```bash
# Heartbeat service
fare keygen --label heartbeat --output env

# Custom event processor
fare keygen --label event-processor --output env

# Backup/recovery key  
fare keygen --label backup --output json
```

## Troubleshooting

### "Non-base58 character" Error
This means your private key is not in the correct format. Use `fare keygen` to generate a new one in the correct base58 format.

### Where to Add Keys
- **Backend**: `apps/api/.env`
- **Production**: Use `fly secrets set` command
- **Local Development**: Local `.env` files (never committed)

