"use client";

import { useState } from "react";
import { ComplianceScanLauncher } from "./ComplianceScanLauncher";
import { ComplianceScanResults } from "./ComplianceScanResults";

type Props = {
  tenantId: string;
};

export function CompliancePageClient({ tenantId }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <ComplianceScanLauncher
        onScanLaunched={() => {
          // Bump key after a short delay so scan has time to queue
          setTimeout(() => setRefreshKey((k) => k + 1), 3000);
        }}
      />
      <ComplianceScanResults tenantId={tenantId} refreshKey={refreshKey} />
    </div>
  );
}
