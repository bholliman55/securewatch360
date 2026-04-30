variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "HIPAA-164.308(a)(5)"; framework = "HIPAA"
    title = "Security Awareness and Training"
    description = "Implement a security awareness and training program for workforce members"
    version = 1; mode = var.enforcement_mode
    checklist = ["Workforce training completed annually", "Security reminders distributed", "Malicious software protection training", "Log-in monitoring training"]
  }
}
