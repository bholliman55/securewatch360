# Supabase project module
# Provisions the Supabase project, configures auth, and wires up RLS-required settings.

terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

variable "organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "project_name" {
  description = "Supabase project display name"
  type        = string
  default     = "securewatch360"
}

variable "region" {
  description = "Supabase project region"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Postgres database password (min 16 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for Supabase Auth (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "site_url" {
  description = "Application base URL for Auth redirects"
  type        = string
}

variable "enable_email_auth" {
  description = "Enable email/password authentication"
  type        = bool
  default     = true
}

variable "enable_magic_link" {
  description = "Enable magic link (passwordless email) auth"
  type        = bool
  default     = true
}

variable "smtp_host" {
  description = "SMTP host for transactional email (optional — uses Supabase default if empty)"
  type        = string
  default     = ""
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_pass" {
  description = "SMTP password"
  type        = string
  default     = ""
  sensitive   = true
}

resource "supabase_project" "main" {
  organization_id   = var.organization_id
  name              = var.project_name
  database_password = var.db_password
  region            = var.region

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion of the database
  }
}

resource "supabase_settings" "auth" {
  project_ref = supabase_project.main.id

  auth = jsonencode({
    site_url              = var.site_url
    additional_redirect_urls = ["${var.site_url}/auth/callback"]
    jwt_expiry            = 3600
    refresh_token_rotation_enabled = true
    security_captcha_enabled       = false
    email = {
      enable_signup         = var.enable_email_auth
      enable_confirmations  = true
      magic_link_enabled    = var.enable_magic_link
    }
    smtp = var.smtp_host != "" ? {
      host     = var.smtp_host
      user     = var.smtp_user
      pass     = var.smtp_pass
      port     = 587
      sender   = "no-reply@${replace(var.site_url, "https://", "")}"
    } : null
  })
}

output "project_id" {
  description = "Supabase project reference ID"
  value       = supabase_project.main.id
}

output "project_url" {
  description = "Supabase project API URL"
  value       = "https://${supabase_project.main.id}.supabase.co"
}

output "anon_key" {
  description = "Supabase anonymous (public) key"
  value       = supabase_project.main.anon_key
  sensitive   = true
}

output "service_role_key" {
  description = "Supabase service role key (server-side only)"
  value       = supabase_project.main.service_role_key
  sensitive   = true
}
