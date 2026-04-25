# NIST CSF 2.0 — GV.PO-01 (stub) — see policy_framework_controls for title/enforcement
output "securewatch360_control" {
  description = "NIST control metadata for policy-as-code handoff"
  value = {
    code    = "GV.PO-01"
    version = 1
    mode    = "advisory"
  }
}
