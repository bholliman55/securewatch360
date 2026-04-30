variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CMMC-AC.L2-3"; framework = "CMMC"
    title = "Control CUI Flow"
    description = "Control the flow of Controlled Unclassified Information (CUI) in accordance with approved authorizations"
    version = 1; mode = var.enforcement_mode
    checklist = ["CUI data flows mapped", "Data flow controls enforced at boundary", "Approved transfer mechanisms documented", "Unauthorized exfiltration alerts configured"]
  }
}
