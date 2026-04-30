variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "ISO27001-A.8.1"; framework = "ISO 27001"
    title = "User Endpoint Devices"
    description = "Protect information on user endpoint devices including mobile and remote devices"
    version = 1; mode = var.enforcement_mode
    checklist = ["Endpoint MDM enrolled", "Full-disk encryption enforced", "Remote wipe capability confirmed", "Screen lock policies applied"]
  }
}
