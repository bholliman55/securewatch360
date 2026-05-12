# SecureWatch360 — Production environment
# Apply with: terraform -chdir=iac/terraform/environments/production apply

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "securewatch360-tf-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "securewatch360-tf-locks"
  }
}

variable "supabase_organization_id" { type = string }
variable "supabase_db_password"      { type = string; sensitive = true }
variable "supabase_jwt_secret"       { type = string; sensitive = true }
variable "vercel_team_id"            { type = string; default = "" }
variable "git_repository"            { type = string }
variable "anthropic_api_key"         { type = string; sensitive = true }
variable "inngest_event_key"         { type = string; sensitive = true }
variable "inngest_signing_key"       { type = string; sensitive = true }

locals {
  environment = "production"
  site_url    = "https://securewatch360.com"
}

module "supabase" {
  source          = "../../modules/supabase-project"
  organization_id = var.supabase_organization_id
  project_name    = "securewatch360-prod"
  region          = "us-east-1"
  db_password     = var.supabase_db_password
  jwt_secret      = var.supabase_jwt_secret
  site_url        = local.site_url
}

module "secrets" {
  source      = "../../modules/secrets"
  environment = local.environment
  secrets = {
    SUPABASE_SERVICE_ROLE_KEY = module.supabase.service_role_key
    ANTHROPIC_API_KEY         = var.anthropic_api_key
    INNGEST_EVENT_KEY         = var.inngest_event_key
    INNGEST_SIGNING_KEY       = var.inngest_signing_key
  }
  tags = {
    Environment = local.environment
    Project     = "securewatch360"
    ManagedBy   = "terraform"
  }
}

module "app" {
  source         = "../../modules/securewatch360-app"
  environment    = local.environment
  vercel_team_id = var.vercel_team_id
  project_name   = "securewatch360"
  git_repository = var.git_repository
  git_branch     = "main"

  app_env_vars = {
    NEXT_PUBLIC_SUPABASE_URL      = module.supabase.project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY = module.supabase.anon_key
    SUPABASE_SERVICE_ROLE_KEY     = module.supabase.service_role_key
    ANTHROPIC_API_KEY             = var.anthropic_api_key
    INNGEST_EVENT_KEY             = var.inngest_event_key
    INNGEST_SIGNING_KEY           = var.inngest_signing_key
    INNGEST_BASE_URL              = "https://api.inngest.com"
    DECISION_ENGINE_PROVIDER      = "rules"
    REMEDIATION_HUMAN_IN_THE_LOOP = "true"
    APPROVAL_DEFAULT_SLA_HOURS    = "72"
    RISK_EXCEPTION_REVIEW_SLA_HOURS = "168"
    NODE_ENV                      = "production"
  }
}

output "app_url"     { value = module.app.deployment_url }
output "supabase_url" { value = module.supabase.project_url }
