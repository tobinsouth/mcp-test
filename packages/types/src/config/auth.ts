import { z } from 'zod';

/**
 * No authentication configuration
 */
export const NoAuthSchema = z.object({
  type: z.literal('none'),
});

/**
 * OAuth 2.0 Client Credentials flow configuration
 */
export const ClientCredentialsAuthSchema = z.object({
  type: z.literal('client_credentials'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  tokenEndpoint: z.string().url().optional(),
});

/**
 * OAuth 2.0 Authorization Code flow configuration
 */
export const AuthorizationCodeAuthSchema = z.object({
  type: z.literal('authorization_code'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  clientMetadataUrl: z.string().url().optional(),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  useDCR: z.boolean().default(true),
  interactive: z.boolean().default(false),
});

/**
 * Discriminated union of all auth configurations
 */
export const AuthConfigSchema = z.discriminatedUnion('type', [
  NoAuthSchema,
  ClientCredentialsAuthSchema,
  AuthorizationCodeAuthSchema,
]);

export type NoAuthConfig = z.infer<typeof NoAuthSchema>;
export type ClientCredentialsAuthConfig = z.infer<typeof ClientCredentialsAuthSchema>;
export type AuthorizationCodeAuthConfig = z.infer<typeof AuthorizationCodeAuthSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
