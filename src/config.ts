import { z } from "zod";

const address = /^0x[0-9a-fA-F]{40}$/;
const key = /^0x[0-9a-fA-F]{64}$/;

export const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  SEALEDCASH_SERVICE_TOKEN: z.string().min(32),
  SEALEDCASH_RELAYER_KEY: z.string().regex(key),
  SEALEDCASH_RPC_URL: z.string().url(),
  SEALEDCASH_CHAIN_ID: z.coerce.number().int().positive(),
  SEALEDCASH_POOL_ADDRESS: z.string().regex(address),
  SEALEDCASH_MAX_GAS: z.coerce.bigint().positive().default(800000n),
  SEALEDCASH_IDEMPOTENCY_TTL_MS: z.coerce.number().int().min(1000).max(86400000).default(900000),
  SEALEDCASH_LOG_LEVEL: z.enum(["silent", "info", "warn", "error"]).default("info")
});

export type RelayerConfig = z.infer<typeof configSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): RelayerConfig {
  return configSchema.parse(env);
}

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const result = configSchema.safeParse(env);
  return result.success;
}