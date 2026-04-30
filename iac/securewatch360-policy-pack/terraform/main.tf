# SecureWatch360 Policy Pack — all 11 frameworks
# Reference layout for GET /api/policy/export/terraform?tenantId=…
# Copy this directory into your infrastructure repo, or re-point `source` to a registry module.

variable "enforcement_mode" {
  description = "Global enforcement mode: advisory | enforced"
  type        = string
  default     = "advisory"
}

# ── NIST CSF 2.0 ─────────────────────────────────────────────────────────────
module "nist_gv_po_01" { source = "../modules/policies/nist_gv_po_01"; enforcement_mode = var.enforcement_mode }
module "nist_id_am_01" { source = "../modules/policies/nist_id_am_01"; enforcement_mode = var.enforcement_mode }
module "nist_pr_ds_01" { source = "../modules/policies/nist_pr_ds_01"; enforcement_mode = var.enforcement_mode }

# ── HIPAA ─────────────────────────────────────────────────────────────────────
module "hipaa_164_308_a_1" { source = "../modules/policies/hipaa_164_308_a_1"; enforcement_mode = var.enforcement_mode }
module "hipaa_164_308_a_5" { source = "../modules/policies/hipaa_164_308_a_5"; enforcement_mode = var.enforcement_mode }

# ── PCI-DSS ───────────────────────────────────────────────────────────────────
module "pci_dss_req_1" { source = "../modules/policies/pci_dss_req_1"; enforcement_mode = var.enforcement_mode }
module "pci_dss_req_6" { source = "../modules/policies/pci_dss_req_6"; enforcement_mode = var.enforcement_mode }

# ── ISO 27001 ─────────────────────────────────────────────────────────────────
module "iso27001_a_5_1" { source = "../modules/policies/iso27001_a_5_1"; enforcement_mode = var.enforcement_mode }
module "iso27001_a_8_1" { source = "../modules/policies/iso27001_a_8_1"; enforcement_mode = var.enforcement_mode }

# ── SOC 2 ─────────────────────────────────────────────────────────────────────
module "soc2_cc6_1" { source = "../modules/policies/soc2_cc6_1"; enforcement_mode = var.enforcement_mode }
module "soc2_cc7_1" { source = "../modules/policies/soc2_cc7_1"; enforcement_mode = var.enforcement_mode }

# ── CIS Controls ──────────────────────────────────────────────────────────────
module "cis_csc_1" { source = "../modules/policies/cis_csc_1"; enforcement_mode = var.enforcement_mode }
module "cis_csc_3" { source = "../modules/policies/cis_csc_3"; enforcement_mode = var.enforcement_mode }

# ── GDPR ──────────────────────────────────────────────────────────────────────
module "gdpr_art_32" { source = "../modules/policies/gdpr_art_32"; enforcement_mode = var.enforcement_mode }
module "gdpr_art_33" { source = "../modules/policies/gdpr_art_33"; enforcement_mode = var.enforcement_mode }

# ── FedRAMP ───────────────────────────────────────────────────────────────────
module "fedramp_ac_2" { source = "../modules/policies/fedramp_ac_2"; enforcement_mode = var.enforcement_mode }
module "fedramp_au_2" { source = "../modules/policies/fedramp_au_2"; enforcement_mode = var.enforcement_mode }

# ── CMMC ──────────────────────────────────────────────────────────────────────
module "cmmc_ac_l2_3" { source = "../modules/policies/cmmc_ac_l2_3"; enforcement_mode = var.enforcement_mode }
module "cmmc_ir_l2_3" { source = "../modules/policies/cmmc_ir_l2_3"; enforcement_mode = var.enforcement_mode }

# ── COBIT ─────────────────────────────────────────────────────────────────────
module "cobit_apo12" { source = "../modules/policies/cobit_apo12"; enforcement_mode = var.enforcement_mode }
module "cobit_dss05" { source = "../modules/policies/cobit_dss05"; enforcement_mode = var.enforcement_mode }

# ── CCPA ──────────────────────────────────────────────────────────────────────
module "ccpa_s1798_100" { source = "../modules/policies/ccpa_s1798_100"; enforcement_mode = var.enforcement_mode }
module "ccpa_s1798_105" { source = "../modules/policies/ccpa_s1798_105"; enforcement_mode = var.enforcement_mode }

# ── Aggregate output ──────────────────────────────────────────────────────────
output "all_controls" {
  description = "All provisioned policy controls"
  value = [
    module.nist_gv_po_01.securewatch360_control,
    module.nist_id_am_01.securewatch360_control,
    module.nist_pr_ds_01.securewatch360_control,
    module.hipaa_164_308_a_1.securewatch360_control,
    module.hipaa_164_308_a_5.securewatch360_control,
    module.pci_dss_req_1.securewatch360_control,
    module.pci_dss_req_6.securewatch360_control,
    module.iso27001_a_5_1.securewatch360_control,
    module.iso27001_a_8_1.securewatch360_control,
    module.soc2_cc6_1.securewatch360_control,
    module.soc2_cc7_1.securewatch360_control,
    module.cis_csc_1.securewatch360_control,
    module.cis_csc_3.securewatch360_control,
    module.gdpr_art_32.securewatch360_control,
    module.gdpr_art_33.securewatch360_control,
    module.fedramp_ac_2.securewatch360_control,
    module.fedramp_au_2.securewatch360_control,
    module.cmmc_ac_l2_3.securewatch360_control,
    module.cmmc_ir_l2_3.securewatch360_control,
    module.cobit_apo12.securewatch360_control,
    module.cobit_dss05.securewatch360_control,
    module.ccpa_s1798_100.securewatch360_control,
    module.ccpa_s1798_105.securewatch360_control,
  ]
}
