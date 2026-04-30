variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "COBIT-DSS05"; framework = "COBIT"
    title = "Managed Security Services"
    description = "Protect enterprise information to maintain the level of information security risk acceptable to the enterprise"
    version = 1; mode = var.enforcement_mode
    checklist = ["Security baselines defined per asset type", "Endpoint protection deployed", "Network intrusion detection active", "Security event management operational"]
  }
}
