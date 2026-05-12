# SecureWatch360 application deployment module
# Manages Vercel (or generic) deployment, Inngest project, and environment secrets.

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
  }
}

# ── Variables ────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment: production | staging"
  type        = string
  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be 'production' or 'staging'."
  }
}

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Vercel project name"
  type        = string
  default     = "securewatch360"
}

variable "git_repository" {
  description = "GitHub repository in owner/repo format"
  type        = string
}

variable "git_branch" {
  description = "Branch to deploy"
  type        = string
  default     = "main"
}

variable "app_env_vars" {
  description = "Map of environment variable names to values for the Next.js app"
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "app_env_vars_sensitive_keys" {
  description = "List of env var keys that should be marked sensitive in Vercel"
  type        = list(string)
  default = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "INNGEST_SIGNING_KEY",
    "INNGEST_EVENT_KEY",
  ]
}

# ── Vercel Project ────────────────────────────────────────────────────────────

resource "vercel_project" "app" {
  name      = var.project_name
  team_id   = var.vercel_team_id != "" ? var.vercel_team_id : null
  framework = "nextjs"

  git_repository = {
    type              = "github"
    repo              = var.git_repository
    production_branch = var.git_branch
  }

  build_command    = "npm run build"
  output_directory = ".next"

  serverless_function_region = "iad1"
}

# ── Environment Variables ─────────────────────────────────────────────────────

resource "vercel_project_environment_variable" "env_vars" {
  for_each = var.app_env_vars

  project_id = vercel_project.app.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = each.key
  value      = each.value
  target     = [var.environment == "production" ? "production" : "preview"]
  sensitive  = contains(var.app_env_vars_sensitive_keys, each.key)
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "project_id" {
  description = "Vercel project ID"
  value       = vercel_project.app.id
}

output "deployment_url" {
  description = "Primary deployment URL"
  value       = "https://${var.project_name}.vercel.app"
}
