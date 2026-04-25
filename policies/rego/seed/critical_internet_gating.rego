# Escalation: critical + internet exposure
package securewatch.escalation

default require_escalation = false

require_escalation {
  input.severity == "critical"
  input.exposure == "internet"
}
