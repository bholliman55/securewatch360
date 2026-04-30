variable "enforcement_mode" {
  description = "advisory | enforced"
  type        = string
  default     = "advisory"
}

output "securewatch360_control" {
  description = "HIPAA § 164.308(a)(1) — Security Management Process"
  value = {
    code        = "HIPAA-164.308(a)(1)"
    framework   = "HIPAA"
    title       = "Security Management Process"
    description = "Implement policies to prevent, detect, contain, and correct security violations"
    version     = 1
    mode        = var.enforcement_mode
    checklist = [
      "Risk analysis documented and current",
      "Risk management plan in place",
      "Sanction policy enforced",
      "Information system activity reviewed",
    ]
  }
}
