variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CIS-CSC-03"; framework = "CIS"
    title = "Data Protection"
    description = "Develop processes and technical controls to identify, classify, and securely handle data"
    version = 1; mode = var.enforcement_mode
    checklist = ["Data classification scheme published", "Sensitive data encrypted at rest", "DLP controls deployed", "Data retention policy enforced"]
  }
}
