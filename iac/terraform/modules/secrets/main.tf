# Secrets management module
# Creates and manages secrets in AWS Secrets Manager (or GCP/Azure equivalent).
# SecureWatch360 reads secrets via environment variables at runtime —
# this module provisions the source-of-truth store and outputs ARNs for CI/CD use.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type = string
}

variable "secrets" {
  description = "Map of secret names to their values"
  type        = map(string)
  sensitive   = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  prefix = "securewatch360/${var.environment}"
}

resource "aws_secretsmanager_secret" "app_secrets" {
  for_each = var.secrets

  name        = "${local.prefix}/${each.key}"
  description = "SecureWatch360 ${var.environment} — ${each.key}"
  tags        = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each      = var.secrets
  secret_id     = aws_secretsmanager_secret.app_secrets[each.key].id
  secret_string = each.value
}

output "secret_arns" {
  description = "Map of secret name → ARN for IAM policy attachment"
  value       = { for k, v in aws_secretsmanager_secret.app_secrets : k => v.arn }
}
