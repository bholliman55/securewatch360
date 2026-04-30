variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "FedRAMP-AU-2"; framework = "FedRAMP"
    title = "Event Logging"
    description = "Identify the types of events that the information system is capable of logging in support of the audit function"
    version = 1; mode = var.enforcement_mode
    checklist = ["Audit log policy defined", "Authentication events logged", "Privileged operations logged", "Log integrity protected"]
  }
}
