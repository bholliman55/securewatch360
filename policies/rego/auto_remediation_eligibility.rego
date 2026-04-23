package securewatch.policy.auto_remediation_eligibility

default allow_auto_remediation := false

eligible_target_types := {
  "container_image",
  "package_manifest",
  "dependency_manifest",
}

allow_auto_remediation if {
  input.severity == "critical"
  input.exposure == "internet"
  input.targetType in eligible_target_types
}

decision := {
  "action": "auto_remediate",
  "requiresApproval": false,
  "autoRemediationAllowed": allow_auto_remediation,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["controlled_auto_remediation_allowed", "internet_exposed_asset", "critical_asset_type"],
  "matchedPolicies": [
    {
      "policyId": "sample.auto_remediation_eligibility",
      "policyName": "Auto Remediation Eligibility",
      "version": "v1",
    },
  ],
} if allow_auto_remediation
