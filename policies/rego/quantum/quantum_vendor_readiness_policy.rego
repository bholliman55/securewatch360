package securewatch.quantum.vendor

# Quantum Vendor Readiness Policy
# Evaluates vendor/supply chain PQC readiness declarations.
# Input contract: vendor readiness assessment payload.
#
# Expected input shape:
# {
#   "vendor_name": string,
#   "vendor_pqc_status": "supported" | "roadmap_confirmed" | "evaluating" | "no_roadmap" | "unknown",
#   "is_critical_system": boolean,
#   "product_name": string,
#   "contact_confirmed_at": string | null,   # ISO 8601 or null
#   "pqc_target_date": string | null,        # ISO 8601 or null
#   "uses_classical_crypto": boolean,
#   "nist_pqc_standards_listed": [string]    # e.g. ["FIPS 203", "FIPS 204"]
# }

import rego.v1

# ── Helper Rules ──────────────────────────────────────────────────────────────

vendor_name := input.vendor_name if {
    input.vendor_name != null
    input.vendor_name != ""
} else := "Unknown Vendor"

pqc_status := input.vendor_pqc_status if {
    input.vendor_pqc_status != null
} else := "unknown"

is_critical := input.is_critical_system == true

has_supported_pqc if pqc_status == "supported"
has_supported_pqc if pqc_status == "roadmap_confirmed"

has_no_roadmap if pqc_status == "no_roadmap"
is_unknown_status if pqc_status == "unknown"
is_evaluating if pqc_status == "evaluating"

nist_standards_declared if {
    count(input.nist_pqc_standards_listed) > 0
}

# ── Policy Evaluations ────────────────────────────────────────────────────────

# DENY: Critical system vendor with no PQC roadmap
results contains result if {
    is_critical
    has_no_roadmap
    result := {
        "policy_id":  "QVND-001",
        "severity":   "critical",
        "passed":     false,
        "message":    sprintf("Vendor '%v' supplies a critical system but has declared no PQC migration roadmap. This is an unacceptable supply chain quantum risk.", [vendor_name]),
        "remediation": "Immediately engage vendor to obtain a PQC migration commitment. Evaluate alternative vendors with confirmed NIST PQC roadmaps (FIPS 203/204/205). Include PQC roadmap as a procurement requirement.",
    }
}

# DENY: Non-critical vendor with no roadmap — high severity
results contains result if {
    not is_critical
    has_no_roadmap
    result := {
        "policy_id":  "QVND-002",
        "severity":   "high",
        "passed":     false,
        "message":    sprintf("Vendor '%v' has declared no PQC roadmap. Continued use introduces growing quantum risk.", [vendor_name]),
        "remediation": "Request a PQC readiness statement from the vendor. Add PQC requirements to contract renewal negotiations.",
    }
}

# WARN: PQC status is unknown — cannot assess risk
results contains result if {
    is_unknown_status
    result := {
        "policy_id":  "QVND-003",
        "severity":   "high",
        "passed":     false,
        "message":    sprintf("Vendor '%v' PQC readiness status is unknown. Unable to assess quantum supply chain risk.", [vendor_name]),
        "remediation": "Contact vendor to obtain PQC readiness statement. Request written disclosure of cryptographic algorithms in use and their migration timeline to NIST PQC standards.",
    }
}

# WARN: Vendor is evaluating but hasn't committed — medium risk
results contains result if {
    is_evaluating
    result := {
        "policy_id":  "QVND-004",
        "severity":   "medium",
        "passed":     false,
        "message":    sprintf("Vendor '%v' is evaluating PQC options but has not committed to a migration roadmap or timeline.", [vendor_name]),
        "remediation": "Request a committed PQC migration timeline from the vendor. Monitor quarterly. Escalate if no commitment is made within 90 days.",
    }
}

# WARN: Roadmap confirmed but no NIST standards listed
results contains result if {
    pqc_status == "roadmap_confirmed"
    not nist_standards_declared
    result := {
        "policy_id":  "QVND-005",
        "severity":   "medium",
        "passed":     false,
        "message":    sprintf("Vendor '%v' has confirmed a PQC roadmap but has not specified which NIST PQC standards (FIPS 203/204/205) will be adopted.", [vendor_name]),
        "remediation": "Request vendor to confirm alignment with NIST FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and/or FIPS 205 (SLH-DSA).",
    }
}

# PASS: Vendor supports PQC with NIST standards
results contains result if {
    pqc_status == "supported"
    nist_standards_declared
    result := {
        "policy_id":  "QVND-006",
        "severity":   "low",
        "passed":     true,
        "message":    sprintf("Vendor '%v' supports post-quantum cryptography with declared NIST PQC standards: %v.", [vendor_name, input.nist_pqc_standards_listed]),
        "remediation": "No action required. Validate implementation in next annual vendor review. Confirm FIPS validation certificates.",
    }
}

# PASS: Roadmap confirmed with NIST standards — acceptable posture
results contains result if {
    pqc_status == "roadmap_confirmed"
    nist_standards_declared
    result := {
        "policy_id":  "QVND-007",
        "severity":   "low",
        "passed":     true,
        "message":    sprintf("Vendor '%v' has confirmed a PQC migration roadmap targeting NIST standards: %v.", [vendor_name, input.nist_pqc_standards_listed]),
        "remediation": "Track vendor migration milestones. Request production availability date and validate delivery.",
    }
}
