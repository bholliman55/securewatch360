variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CIS-CSC-01"; framework = "CIS"
    title = "Inventory and Control of Enterprise Assets"
    description = "Actively manage hardware assets so only authorized devices are granted access"
    version = 1; mode = var.enforcement_mode
    checklist = ["Asset inventory automated and current", "Unauthorized devices blocked", "DHCP logs monitored", "Asset lifecycle tracked"]
  }
}
