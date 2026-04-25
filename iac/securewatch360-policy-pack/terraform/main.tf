# Reference layout for GET /api/policy/export/terraform?tenantId=…
# Catalog stores sources like: modules/policies/nist_gv_po_01
# This repository ships minimal valid modules at those relative paths for terraform validate.
#
# Copy this directory into your infrastructure repo, or re-point `source` to a registry module.

module "nist_gv_po_01" {
  source = "../modules/policies/nist_gv_po_01"
}

module "nist_id_am_01" {
  source = "../modules/policies/nist_id_am_01"
}

module "nist_pr_ds_01" {
  source = "../modules/policies/nist_pr_ds_01"
}
