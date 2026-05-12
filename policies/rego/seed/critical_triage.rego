# Gating: critical severity forces explicit review (OPA can compile this; runtime endpoint merges with SecureWatch decision shape).
package securewatch.gating

default allow = false

allow if {
  input.severity == "critical"
}
