/**
 * Centralized tenant boundary checks for APIs and workers — pair with `requireTenantAccess()` in routes.
 */

export class TenantAuthorizationError extends Error {
  readonly code = "tenant_authorization_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "TenantAuthorizationError";
  }
}

export function assertSameTenant(actorTenantId: string, resourceTenantId: string): void {
  if (actorTenantId !== resourceTenantId) {
    throw new TenantAuthorizationError(
      `Cross-tenant access denied: actor tenant ${actorTenantId} cannot access resource tenant ${resourceTenantId}.`,
    );
  }
}

export function isSameTenant(actorTenantId: string, resourceTenantId: string): boolean {
  return actorTenantId === resourceTenantId;
}

/**
 * MSP / support break-glass: default deny unless explicitly allowed by policy layer.
 */
export function assertTenantAllowed(args: {
  actorTenantId: string;
  resourceTenantId: string;
  allow_cross_tenant_support?: boolean;
  support_actor?: boolean;
}): void {
  if (args.actorTenantId === args.resourceTenantId) return;
  if (args.allow_cross_tenant_support && args.support_actor) return;
  assertSameTenant(args.actorTenantId, args.resourceTenantId);
}
