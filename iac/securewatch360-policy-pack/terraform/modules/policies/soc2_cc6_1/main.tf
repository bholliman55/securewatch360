variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "SOC2-CC6.1"; framework = "SOC 2"
    title = "Logical and Physical Access Controls"
    description = "Limit logical and physical access to systems and data to authorized individuals"
    version = 1; mode = var.enforcement_mode
    checklist = ["MFA enforced for all privileged accounts", "Quarterly access review completed", "Terminated user access removed within 24h", "Least-privilege principle documented"]
  }
}
