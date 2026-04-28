# Compliance evidence: high/critical workstreams require explainability.
package securewatch.compliance

default evidence_required = false

evidence_required if {
  input.severity == "high"
}

evidence_required if {
  input.severity == "critical"
}
