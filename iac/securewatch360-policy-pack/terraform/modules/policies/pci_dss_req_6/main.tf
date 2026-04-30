variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "PCI-DSS-REQ-06"; framework = "PCI-DSS"
    title = "Develop and Maintain Secure Systems and Software"
    description = "Protect systems and networks from malicious exploitation through secure development practices"
    version = 1; mode = var.enforcement_mode
    checklist = ["Vulnerability management process active", "Critical patches applied within 30 days", "SAST/DAST in CI/CD", "Web application firewall deployed"]
  }
}
