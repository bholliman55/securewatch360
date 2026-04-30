variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "GDPR-ART-32"; framework = "GDPR"
    title = "Security of Processing"
    description = "Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk"
    version = 1; mode = var.enforcement_mode
    checklist = ["Pseudonymisation applied where appropriate", "Encryption of personal data in transit and at rest", "Ongoing confidentiality, integrity and availability assurance", "Regular testing of security measures"]
  }
}
