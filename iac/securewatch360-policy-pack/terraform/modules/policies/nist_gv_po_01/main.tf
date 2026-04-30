variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  description = "NIST CSF 2.0 — GV.PO-01 Organizational Context"
  value = {
    code = "GV.PO-01"; framework = "NIST"
    title = "Organizational Context"
    description = "The circumstances — mission, stakeholder expectations, dependencies — surrounding the organization's cybersecurity risk management decisions are understood"
    version = 1; mode = var.enforcement_mode
    checklist = ["Mission and objectives documented", "Stakeholder risk tolerance defined", "Legal and regulatory obligations inventoried", "Internal/external context reviewed annually"]
  }
}
