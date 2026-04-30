variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "SOC2-CC7.1"; framework = "SOC 2"
    title = "System Monitoring"
    description = "Monitor system components, detect anomalies, and respond to security events"
    version = 1; mode = var.enforcement_mode
    checklist = ["SIEM alerts configured", "Anomaly detection tuned", "Incident response playbooks current", "Log retention >= 12 months"]
  }
}
