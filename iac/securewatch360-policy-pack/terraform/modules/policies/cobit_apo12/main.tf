variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "COBIT-APO12"; framework = "COBIT"
    title = "Managed Risk"
    description = "Integrate the management of IT-related enterprise risk with overall enterprise risk management"
    version = 1; mode = var.enforcement_mode
    checklist = ["IT risk register maintained", "Risk appetite approved by board", "Risk treatment plans active", "Risk KPIs reported quarterly"]
  }
}
