variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "CMMC-IR.L2-3"; framework = "CMMC"
    title = "Incident Reporting"
    description = "Track, document, and report incidents to designated officials and/or authorities both internal and external to the organization"
    version = 1; mode = var.enforcement_mode
    checklist = ["Incident reporting chain documented", "US-CERT reporting timelines met", "Incident records retained >= 3 years", "After-action reviews completed"]
  }
}
