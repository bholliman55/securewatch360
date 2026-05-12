import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { generatePlaybook } from "@/lib/remediationPlaybookGenerator";

export const generateRemediationPlaybookFunction = inngest.createFunction(
  { id: "generate-remediation-playbook", name: "Remediation: Generate AI Playbook" },
  { event: "securewatch/remediation.playbook.requested" },
  async ({ event, step }) => {
    const { remediationActionId, findingId, tenantId } = event.data as {
      remediationActionId: string;
      findingId: string;
      tenantId: string;
    };

    const finding = await step.run("fetch-finding", async () => {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("findings")
        .select("id, title, severity, description, asset_type")
        .eq("id", findingId)
        .eq("tenant_id", tenantId)
        .single();
      if (error) throw new Error(`Finding not found: ${error.message}`);
      return data;
    });

    const playbook = await step.run("generate-playbook", async () => {
      return generatePlaybook(
        {
          title: finding.title as string,
          severity: finding.severity as string,
          description: finding.description as string ?? "",
          assetType: finding.asset_type as string | undefined,
        },
        findingId
      );
    });

    await step.run("save-playbook", async () => {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("remediation_actions")
        .update({ playbook })
        .eq("id", remediationActionId)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(`Failed to save playbook: ${error.message}`);
    });

    await step.sendEvent("emit-generated", {
      name: "securewatch/remediation.playbook.generated",
      data: { remediationActionId, findingId, tenantId, stepCount: playbook.steps.length },
    });

    return { remediationActionId, findingId, stepCount: playbook.steps.length };
  }
);
