import { inngest } from "@/inngest/client";
import { runVendorRiskAssessment } from "@/agents/vendor-risk/vendorRiskService";

export const runVendorRiskAssessmentFunction = inngest.createFunction(
  { id: "run-vendor-risk-assessment", name: "Vendor Risk: Assessment" },
  { event: "securewatch/vendor_risk.assessment.requested" },
  async ({ event, step }) => {
    const { vendorName, vendorDomain, tenantId, clientId, scanId } = event.data as {
      vendorName: string;
      vendorDomain?: string;
      tenantId: string;
      clientId?: string;
      scanId?: string;
    };

    if (!vendorName) throw new Error("vendorName is required");
    if (!tenantId) throw new Error("tenantId is required");

    const result = await step.run("assess-vendor", async () => {
      return runVendorRiskAssessment({ vendorName, vendorDomain, tenantId, clientId, scanId });
    });

    await step.sendEvent("emit-assessed", {
      name: "securewatch/vendor_risk.assessed",
      data: {
        scanId: result.scanId,
        tenantId,
        vendorName: result.vendorName,
        riskTier: result.riskTier,
        overallScore: result.overallScore,
        signalCount: result.signalCount,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: result.scanId,
      vendorName: result.vendorName,
      riskTier: result.riskTier,
      overallScore: result.overallScore,
      signalCount: result.signalCount,
    };
  }
);
