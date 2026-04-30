variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CCPA-§1798.100"; framework = "CCPA"
    title = "Right to Know — Personal Information Disclosure"
    description = "Consumers have the right to request disclosure of personal information collected, used, disclosed, or sold"
    version = 1; mode = var.enforcement_mode
    checklist = ["Privacy notice published and current", "Data inventory supports disclosure requests", "45-day response SLA tracked", "Disclosure request process documented"]
  }
}
