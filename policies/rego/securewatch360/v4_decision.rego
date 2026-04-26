package securewatch.v4

default decision := {
  "action": "allow",
  "requiresApproval": false,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": true,
  "reasonCodes": ["policy_not_matched"],
  "matchedPolicies": [],
  "metadata": {"source": "opa_local_sample"}
}

decision := {
  "action": "create_remediation",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["severity_threshold_exceeded", "remediation_required"],
  "matchedPolicies": [{"policyId": "opa.local.sample", "policyName": "Local OPA Sample", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision"}
} {
  input.severity == "high"
}

decision := {
  "action": "auto_remediate",
  "requiresApproval": false,
  "autoRemediationAllowed": true,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["controlled_auto_remediation_allowed"],
  "matchedPolicies": [{"policyId": "opa.local.sample", "policyName": "Local OPA Sample", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision"}
} {
  input.severity == "critical"
  input.targetType == "container_image"
}
