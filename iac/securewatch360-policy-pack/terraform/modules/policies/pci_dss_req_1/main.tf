variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "PCI-DSS-REQ-01"; framework = "PCI-DSS"
    title = "Network Security Controls"
    description = "Install and maintain network security controls to protect the cardholder data environment"
    version = 1; mode = var.enforcement_mode
    checklist = ["Firewall rules documented and reviewed quarterly", "Inbound/outbound traffic restricted to CDE", "Network diagrams current", "Wireless networks segmented from CDE"]
  }
}
