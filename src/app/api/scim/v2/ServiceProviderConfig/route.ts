import { NextResponse } from "next/server";

/**
 * SCIM 2.0 service provider discovery (skeleton for enterprise provisioning).
 * Full /Users + group sync is a follow-on; this endpoint unblocks IdP test connections.
 */
export async function GET() {
  return NextResponse.json(
    {
      documentationUri: "https://github.com/bholliman55/securewatch360/blob/main/docs/SSO-SCIM-SETUP.md",
      patch: { supported: false },
      filter: { supported: false, maxResults: 0 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        { type: "oauthbearertoken", name: "OAuth Bearer", description: "Planned: tenant-scoped SCIM token." },
      ],
    },
    { status: 200 }
  );
}
