package securewatch.quantum.crypto

# Quantum Cryptography Policy
# Evaluates individual cryptographic assets against post-quantum readiness standards.
# Input contract: CryptoInventoryItem-shaped object.

import rego.v1

# ── Helper Rules ──────────────────────────────────────────────────────────────

algorithm_upper := upper(input.algorithm)

is_rsa if contains(algorithm_upper, "RSA")
is_ecdsa if contains(algorithm_upper, "ECDSA")
is_ecdh if contains(algorithm_upper, "ECDH")
is_ecc if contains(algorithm_upper, "ECC")
is_dsa if contains(algorithm_upper, "DSA")
is_dh if contains(algorithm_upper, "DH")
is_diffie_hellman if contains(algorithm_upper, "DIFFIE-HELLMAN")

is_ml_kem if contains(algorithm_upper, "ML-KEM")
is_ml_kem if contains(algorithm_upper, "KYBER")
is_ml_dsa if contains(algorithm_upper, "ML-DSA")
is_ml_dsa if contains(algorithm_upper, "DILITHIUM")
is_slh_dsa if contains(algorithm_upper, "SLH-DSA")
is_slh_dsa if contains(algorithm_upper, "SPHINCS")
is_falcon if contains(algorithm_upper, "FALCON")
is_falcon if contains(algorithm_upper, "FN-DSA")
is_lms if algorithm_upper == "LMS"
is_xmss if algorithm_upper == "XMSS"

is_quantum_vulnerable if is_rsa
is_quantum_vulnerable if is_ecdsa
is_quantum_vulnerable if is_ecdh
is_quantum_vulnerable if is_ecc
is_quantum_vulnerable if is_dsa
is_quantum_vulnerable if is_dh
is_quantum_vulnerable if is_diffie_hellman

is_quantum_resistant if is_ml_kem
is_quantum_resistant if is_ml_dsa
is_quantum_resistant if is_slh_dsa
is_quantum_resistant if is_falcon
is_quantum_resistant if is_lms
is_quantum_resistant if is_xmss

rsa_key_length := to_number(input.keyLength) if {
    input.keyLength != null
}

# ── Policy Evaluations ────────────────────────────────────────────────────────

# DENY: RSA key length below 2048 bits
results contains result if {
    is_rsa
    rsa_key_length < 2048
    result := {
        "policy_id":  "QCP-001",
        "severity":   "critical",
        "passed":     false,
        "message":    sprintf("RSA key length %v is below the 2048-bit minimum. Immediate replacement required.", [rsa_key_length]),
        "remediation": "Replace with ML-KEM-768 (NIST FIPS 203) or at minimum upgrade to RSA-2048 as an interim step.",
    }
}

# DENY: MD5 usage
results contains result if {
    contains(upper(input.algorithm), "MD5")
    result := {
        "policy_id":  "QCP-002",
        "severity":   "critical",
        "passed":     false,
        "message":    "MD5 is cryptographically broken and must not be used for any security purpose.",
        "remediation": "Replace with SHA-384 or SHA-512.",
    }
}

# DENY: SHA-1 usage
results contains result if {
    alg := upper(input.algorithm)
    contains(alg, "SHA-1")
    not contains(alg, "SHA-1024")
    result := {
        "policy_id":  "QCP-003",
        "severity":   "critical",
        "passed":     false,
        "message":    "SHA-1 is deprecated and broken. NIST deprecated SHA-1 for most uses as of 2011.",
        "remediation": "Replace with SHA-384 or SHA-512.",
    }
}

# WARN: RSA/ECC/ECDSA/ECDH usage (any key size — quantum-vulnerable)
results contains result if {
    is_quantum_vulnerable
    not (is_rsa and rsa_key_length < 2048)   # already covered by critical deny above
    result := {
        "policy_id":  "QCP-004",
        "severity":   "high",
        "passed":     false,
        "message":    sprintf("Algorithm '%v' is vulnerable to Shor's algorithm on a cryptographically-relevant quantum computer (CRQC).", [input.algorithm]),
        "remediation": "Begin migration planning to ML-KEM (FIPS 203) for key encapsulation or ML-DSA (FIPS 204) for digital signatures.",
    }
}

# WARN: 3DES usage
results contains result if {
    alg := upper(input.algorithm)
    any([contains(alg, "3DES"), contains(alg, "TRIPLE-DES"), contains(alg, "TDEA")])
    result := {
        "policy_id":  "QCP-005",
        "severity":   "critical",
        "passed":     false,
        "message":    "3DES is deprecated (NIST SP 800-131A) and vulnerable to meet-in-the-middle and Grover attacks.",
        "remediation": "Replace with AES-256-GCM.",
    }
}

# WARN: AES-128 — weakened by Grover's algorithm
results contains result if {
    alg := upper(input.algorithm)
    contains(alg, "AES-128")
    result := {
        "policy_id":  "QCP-006",
        "severity":   "high",
        "passed":     false,
        "message":    "AES-128 provides only ~64-bit security against Grover's algorithm. Insufficient for long-term confidentiality.",
        "remediation": "Upgrade to AES-256-GCM.",
    }
}

# PASS: Quantum-resistant algorithm confirmed
results contains result if {
    is_quantum_resistant
    result := {
        "policy_id":  "QCP-007",
        "severity":   "low",
        "passed":     true,
        "message":    sprintf("Algorithm '%v' is quantum-resistant and NIST-approved.", [input.algorithm]),
        "remediation": "No action required. Maintain cryptographic agility for future algorithm updates.",
    }
}
