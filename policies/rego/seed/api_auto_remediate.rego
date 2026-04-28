# Remediation hint: high API findings may be auto-remediated when business rules allow.
package securewatch.remediation

default auto_remediate = false

auto_remediate if {
  input.targetType == "api"
  input.severity == "high"
}
