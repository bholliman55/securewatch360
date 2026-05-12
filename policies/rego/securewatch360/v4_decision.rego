package securewatch.v4

is_str(v) if {
  is_string(v)
}

hipaa_signal if {
  is_str(input.category)
  contains(lower(input.category), "hipaa")
}

hipaa_signal if {
  is_str(input.category)
  contains(lower(input.category), "ephi")
}

hipaa_signal if {
  is_str(input.category)
  contains(lower(input.category), "phi")
}

hipaa_signal if {
  is_str(input.category)
  contains(lower(input.category), "health")
}

hipaa_signal if {
  is_str(input.category)
  contains(lower(input.category), "medical")
}

hipaa_signal if {
  some i
  input.regulatedFrameworks[i] == "hipaa"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "soc2"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "cmmc"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "nist"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "iso27001"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "pci_dss"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "cis"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "gdpr"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "fedramp"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "ccpa"
}

framework_signal if {
  some i
  input.regulatedFrameworks[i] == "cobit"
}

hipaa_internet if {
  input.exposure == "internet"
  hipaa_signal
}

framework_internet if {
  input.exposure == "internet"
  framework_signal
}

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
  "action": "escalate",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["compliance_control_required", "internet_exposed_asset"],
  "matchedPolicies": [{"policyId": "opa.hipaa.internet-escalation", "policyName": "OPA HIPAA Internet Escalation", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision", "hipaaStrictReview": true}
} if {
  hipaa_signal
  input.severity == "critical"
  input.exposure == "internet"
}

decision := {
  "action": "escalate",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["compliance_control_required", "internet_exposed_asset"],
  "matchedPolicies": [{"policyId": "opa.framework.internet-escalation", "policyName": "OPA Framework Internet Escalation", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision", "frameworkStrictReview": true}
} if {
  not hipaa_signal
  framework_signal
  input.severity == "critical"
  input.exposure == "internet"
}

decision := {
  "action": "auto_remediate",
  "requiresApproval": false,
  "autoRemediationAllowed": true,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["controlled_auto_remediation_allowed"],
  "matchedPolicies": [{"policyId": "opa.local.sample", "policyName": "Local OPA Sample", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision"}
} if {
  input.severity == "critical"
  input.targetType == "container_image"
  not hipaa_internet
  not framework_internet
}

decision := {
  "action": "create_remediation",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["compliance_control_required", "remediation_required"],
  "matchedPolicies": [{"policyId": "opa.hipaa.strict-review", "policyName": "OPA HIPAA Strict Review", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision", "hipaaStrictReview": true}
} if {
  hipaa_signal
  input.severity == "high"
}

decision := {
  "action": "create_remediation",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["compliance_control_required", "documentation_required"],
  "matchedPolicies": [{"policyId": "opa.framework.strict-review", "policyName": "OPA Framework Strict Review", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision", "frameworkStrictReview": true}
} if {
  not hipaa_signal
  framework_signal
  input.severity == "high"
}

decision := {
  "action": "create_remediation",
  "requiresApproval": true,
  "autoRemediationAllowed": false,
  "riskAcceptanceAllowed": false,
  "reasonCodes": ["severity_threshold_exceeded", "remediation_required"],
  "matchedPolicies": [{"policyId": "opa.local.sample", "policyName": "Local OPA Sample", "version": "v1"}],
  "metadata": {"source": "opa_local_sample", "path": "securewatch/v4/decision"}
} if {
  input.severity == "high"
  not hipaa_signal
  not framework_signal
}
