variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CCPA-§1798.105"; framework = "CCPA"
    title = "Right to Delete"
    description = "Consumers have the right to request deletion of personal information collected"
    version = 1; mode = var.enforcement_mode
    checklist = ["Deletion request workflow operational", "45-day response SLA tracked", "Third-party processor deletion notifications sent", "Deletion exceptions documented (legal hold, etc.)"]
  }
}
