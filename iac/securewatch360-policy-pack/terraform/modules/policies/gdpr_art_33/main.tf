variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "GDPR-ART-33"; framework = "GDPR"
    title = "Notification of a Personal Data Breach"
    description = "Notify the supervisory authority of a personal data breach within 72 hours of becoming aware"
    version = 1; mode = var.enforcement_mode
    checklist = ["Breach detection process documented", "72-hour notification SLA tracked", "DPA contact details current", "Breach register maintained"]
  }
}
