package securewatch.quantum.tls

# Quantum TLS Policy
# Evaluates TLS configurations for quantum-readiness and deprecated protocol usage.
# Input contract: CryptoInventoryItem with tlsVersion, algorithm, assetType, cryptoUsage.

import rego.v1

# ── Helper Rules ──────────────────────────────────────────────────────────────

tls_version := input.tlsVersion if {
    input.tlsVersion != null
    input.tlsVersion != ""
}

algorithm_upper := upper(input.algorithm)

is_classical_asymmetric if contains(algorithm_upper, "RSA")
is_classical_asymmetric if contains(algorithm_upper, "ECDSA")
is_classical_asymmetric if contains(algorithm_upper, "ECDH")
is_classical_asymmetric if contains(algorithm_upper, "ECC")
is_classical_asymmetric if contains(algorithm_upper, "DSA")
is_classical_asymmetric if contains(algorithm_upper, "DH")

is_pqc_algorithm if contains(algorithm_upper, "ML-KEM")
is_pqc_algorithm if contains(algorithm_upper, "ML-DSA")
is_pqc_algorithm if contains(algorithm_upper, "SLH-DSA")
is_pqc_algorithm if contains(algorithm_upper, "SPHINCS")
is_pqc_algorithm if contains(algorithm_upper, "FALCON")
is_pqc_algorithm if contains(algorithm_upper, "FN-DSA")
is_pqc_algorithm if contains(algorithm_upper, "KYBER")
is_pqc_algorithm if contains(algorithm_upper, "DILITHIUM")

is_public_facing if input.assetType == "public_web_app"
is_public_facing if input.assetType == "api_gateway"
is_public_facing if input.assetType == "email_gateway"
is_public_facing if input.cryptoUsage == "tls"

# ── Policy Evaluations ────────────────────────────────────────────────────────

# DENY: TLS 1.0
results contains result if {
    tls_version == "TLSv1.0"
    result := {
        "policy_id":  "QTLS-001",
        "severity":   "critical",
        "passed":     false,
        "message":    "TLS 1.0 is prohibited by NIST SP 800-52 Rev. 2 and IETF RFC 8996. Immediately disable.",
        "remediation": "Disable TLS 1.0 and enforce TLS 1.2 as minimum. Configure TLS 1.3 as preferred version.",
    }
}

# DENY: TLS 1.1
results contains result if {
    tls_version == "TLSv1.1"
    result := {
        "policy_id":  "QTLS-002",
        "severity":   "critical",
        "passed":     false,
        "message":    "TLS 1.1 is prohibited by NIST SP 800-52 Rev. 2 and IETF RFC 8996. Immediately disable.",
        "remediation": "Disable TLS 1.1 and enforce TLS 1.2 as minimum. Configure TLS 1.3 as preferred version.",
    }
}

# WARN: TLS 1.2 with RSA or ECC certificate — vulnerable to HNDL
results contains result if {
    tls_version == "TLSv1.2"
    is_classical_asymmetric
    result := {
        "policy_id":  "QTLS-003",
        "severity":   "high",
        "passed":     false,
        "message":    sprintf("TLS 1.2 with '%v' certificate is vulnerable to harvest-now-decrypt-later attacks. Recorded sessions may be decrypted by future quantum adversaries.", [input.algorithm]),
        "remediation": "Upgrade to TLS 1.3 with hybrid post-quantum key exchange (X25519MLKEM768 or equivalent). Plan certificate migration to ML-DSA.",
    }
}

# WARN: Public-facing TLS not quantum-ready
results contains result if {
    is_public_facing
    is_classical_asymmetric
    not (tls_version == "TLSv1.0")
    not (tls_version == "TLSv1.1")
    result := {
        "policy_id":  "QTLS-004",
        "severity":   "high",
        "passed":     false,
        "message":    sprintf("Public-facing TLS endpoint uses '%v' which is not quantum-ready. External traffic may be subject to harvest-now-decrypt-later collection.", [input.algorithm]),
        "remediation": "Prioritise post-quantum migration for internet-facing endpoints. Adopt hybrid TLS with IETF draft-ietf-tls-hybrid-design.",
    }
}

# WARN: TLS 1.3 with classical certificate — forward secrecy helps but cert is still vulnerable
results contains result if {
    tls_version == "TLSv1.3"
    is_classical_asymmetric
    result := {
        "policy_id":  "QTLS-005",
        "severity":   "medium",
        "passed":     false,
        "message":    sprintf("TLS 1.3 provides forward secrecy for session keys, but the certificate uses '%v' which remains quantum-vulnerable for authentication.", [input.algorithm]),
        "remediation": "Migrate TLS certificate to ML-DSA (FIPS 204) or a hybrid scheme once supported by your CA.",
    }
}

# PASS: TLS uses a quantum-resistant algorithm
results contains result if {
    is_pqc_algorithm
    result := {
        "policy_id":  "QTLS-006",
        "severity":   "low",
        "passed":     true,
        "message":    sprintf("TLS configuration uses quantum-resistant algorithm '%v'. Compliant with NIST PQC guidance.", [input.algorithm]),
        "remediation": "No action required. Maintain algorithm agility and monitor NIST PQC standard updates.",
    }
}

# PASS: TLS 1.3 (acceptable baseline, even if cert migration pending)
results contains result if {
    tls_version == "TLSv1.3"
    not is_pqc_algorithm
    not is_classical_asymmetric
    result := {
        "policy_id":  "QTLS-007",
        "severity":   "low",
        "passed":     true,
        "message":    "TLS 1.3 is enabled. No deprecated protocol version detected.",
        "remediation": "No action required for protocol version. Ensure certificates migrate to PQC algorithms.",
    }
}
