variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "PR.DS-01"; framework = "NIST"
    title = "Data-at-Rest Protection"
    description = "The confidentiality, integrity, and availability of data-at-rest are protected"
    version = 1; mode = var.enforcement_mode
    checklist = ["Encryption at rest enforced for all datastores", "Key management process documented", "Encryption algorithm complies with FIPS 140-3", "Data classification drives encryption requirements"]
  }
}
