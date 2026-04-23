package securewatch.policy.critical_public_asset_requires_approval

default requires_approval := false

public_exposure := {"internet", "external"}

requires_approval if {
  input.severity == "critical"
  input.exposure in public_exposure
  not input.targetType == "container_image"
  not input.targetType == "package_manifest"
  not input.targetType == "dependency_manifest"
}

decision := {
  "action": "create_remediation",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["internet_exposed_asset", "critical_asset_type", "severity_threshold_exceeded"],
  "matchedPolicies": [
    {
      "policyId": "sample.critical_public_asset_requires_approval",
      "policyName": "Critical Public Asset Requires Approval",
      "version": "v1",
    },
  ],
} if requires_approval
