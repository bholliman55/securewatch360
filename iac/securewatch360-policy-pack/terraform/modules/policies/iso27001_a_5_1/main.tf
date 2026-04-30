variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "ISO27001-A.5.1"; framework = "ISO 27001"
    title = "Information Security Policies"
    description = "Define, approve, publish, and review information security policies"
    version = 1; mode = var.enforcement_mode
    checklist = ["ISMS policy approved by management", "Policy communicated to staff", "Annual policy review completed", "Policy exceptions tracked"]
  }
}
