variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "FedRAMP-AC-2"; framework = "FedRAMP"
    title = "Account Management"
    description = "Manage information system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts"
    version = 1; mode = var.enforcement_mode
    checklist = ["Account creation requires owner approval", "Inactive accounts disabled after 90 days", "Privileged accounts reviewed monthly", "Shared accounts prohibited"]
  }
}
