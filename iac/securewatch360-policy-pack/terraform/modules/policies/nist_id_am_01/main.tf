variable "enforcement_mode" { type = string; default = "advisory" }
output "securewatch360_control" {
  value = {
    code = "ID.AM-01"; framework = "NIST"
    title = "Asset Inventory — Hardware"
    description = "Inventories of hardware managed by the organization are maintained"
    version = 1; mode = var.enforcement_mode
    checklist = ["Hardware asset inventory current", "Unauthorized devices flagged", "Lifecycle status tracked", "Inventory reviewed quarterly"]
  }
}
