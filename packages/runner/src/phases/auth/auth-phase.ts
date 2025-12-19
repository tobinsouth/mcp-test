import type { AuthConfig } from "@mcp-qa/types";
import {
  TestOAuthProvider,
  type AuthCheckRecorder,
  type InteractiveAuthHandler,
} from "@mcp-qa/core";
import { createCheckRecorder, createTimer, type ExtendedPhaseResult } from "../base/index.js";
import * as checks from "./checks.js";

export interface AuthPhaseOptions {
  recorder: AuthCheckRecorder;
  interactiveHandler?: InteractiveAuthHandler;
}

/**
 * Run OAuth discovery/validation phase.
 *
 * This phase ONLY performs discovery and validation checks.
 * It does NOT perform the actual auth flow - that's handled by the
 * transport in the protocol phase, allowing proper 401 handling.
 */
export async function runAuthPhase(
  serverUrl: string,
  authConfig: AuthConfig,
  options: AuthPhaseOptions
): Promise<ExtendedPhaseResult> {
  const timer = createTimer();
  const localRecorder = createCheckRecorder((check) => options.recorder.pushCheck(check));

  // For no-auth servers, just test basic connectivity
  if (authConfig.type === "none") {
    return await testNoAuth(serverUrl, localRecorder, timer);
  }

  // Build provider - this will be passed to the transport later
  const provider = buildProvider(authConfig, localRecorder, options.interactiveHandler);

  // === Discovery Check 1: PRM ===
  let prmMetadata:
    | {
        resource?: string;
        authorization_servers?: string[];
        scopes_supported?: string[];
      }
    | undefined;

  try {
    // Dynamically import to avoid bundling issues
    const { discoverOAuthProtectedResourceMetadata } =
      await import("@modelcontextprotocol/sdk/client/auth.js");
    prmMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl);

    if (prmMetadata) {
      localRecorder.pushCheck(checks.prmDiscoveredCheck(prmMetadata));
    }
  } catch (error) {
    localRecorder.pushCheck(
      checks.prmNotFoundCheck(error instanceof Error ? error.message : String(error))
    );
  }

  // === Discovery Check 2: AS Metadata ===
  const authServerUrl =
    prmMetadata?.authorization_servers?.[0] || new URL("/", serverUrl).toString();

  try {
    const { discoverOAuthMetadata } = await import("@modelcontextprotocol/sdk/client/auth.js");
    const asMetadata = await discoverOAuthMetadata(authServerUrl);

    if (asMetadata) {
      localRecorder.pushCheck(checks.asDiscoveredCheck(asMetadata));

      // Validate PKCE support
      const pkceSupported = asMetadata.code_challenge_methods_supported?.includes("S256");
      localRecorder.pushCheck(checks.pkceSupported(pkceSupported ?? false));

      // Check DCR support
      if (asMetadata.registration_endpoint) {
        localRecorder.pushCheck(checks.dcrAvailableCheck());
      }

      // Check CIMD support
      if ((asMetadata as Record<string, unknown>).client_id_metadata_document_supported) {
        localRecorder.pushCheck(checks.cimdSupportedCheck());
      }
    }
  } catch (error) {
    localRecorder.pushCheck(
      checks.asDiscoveryFailedCheck(error instanceof Error ? error.message : String(error))
    );
  }

  localRecorder.pushCheck(checks.discoveryCompleteCheck());

  return {
    phase: "auth",
    name: "Authentication Discovery",
    description: `Discovered auth configuration for ${authConfig.type}`,
    startTime: timer.startTime,
    endTime: timer.getEndTime(),
    durationMs: timer.getDurationMs(),
    checks: localRecorder.checks,
    summary: localRecorder.getSummary(),
    provider,
  };
}

async function testNoAuth(
  serverUrl: string,
  recorder: ReturnType<typeof createCheckRecorder>,
  timer: ReturnType<typeof createTimer>
): Promise<ExtendedPhaseResult> {
  try {
    const response = await fetch(serverUrl, { method: "OPTIONS" });

    recorder.pushCheck(checks.serverAccessibleCheck(response.status));
  } catch (error) {
    recorder.pushCheck(
      checks.connectionFailedCheck(error instanceof Error ? error.message : String(error))
    );
  }

  return {
    phase: "auth",
    name: "Authentication Testing",
    description: "Testing no-auth configuration",
    startTime: timer.startTime,
    endTime: timer.getEndTime(),
    durationMs: timer.getDurationMs(),
    checks: recorder.checks,
    summary: recorder.getSummary(),
  };
}

function buildProvider(
  authConfig: AuthConfig,
  recorder: ReturnType<typeof createCheckRecorder>,
  interactiveHandler?: InteractiveAuthHandler
): TestOAuthProvider {
  if (authConfig.type === "none") {
    throw new Error("Cannot build provider for no-auth config");
  }

  if (authConfig.type === "client_credentials") {
    return new TestOAuthProvider(
      {
        redirectUrl: undefined,
        grantType: "client_credentials",
        clientMetadata: {
          grant_types: ["client_credentials"],
          redirect_uris: [],
          scope: authConfig.scopes?.join(" "),
          token_endpoint_auth_method: "client_secret_basic",
        },
        preRegisteredClient: authConfig.clientId
          ? { client_id: authConfig.clientId, client_secret: authConfig.clientSecret }
          : undefined,
      },
      recorder
    );
  }

  if (authConfig.type === "authorization_code") {
    const redirectUri = authConfig.redirectUri || "http://localhost:3456/oauth/callback";
    return new TestOAuthProvider(
      {
        redirectUrl: redirectUri,
        clientMetadata: {
          grant_types: ["authorization_code", "refresh_token"],
          redirect_uris: [redirectUri],
          scope: authConfig.scopes?.join(" "),
        },
        clientMetadataUrl: authConfig.useDCR ? undefined : authConfig.clientMetadataUrl,
        preRegisteredClient: authConfig.clientId
          ? { client_id: authConfig.clientId, client_secret: authConfig.clientSecret }
          : undefined,
      },
      recorder,
      interactiveHandler
    );
  }

  throw new Error(`Unsupported auth type: ${(authConfig as { type: string }).type}`);
}
