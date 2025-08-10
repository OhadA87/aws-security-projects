
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = var.region }

locals { project = "aws-pki-certificate-lifecycle-automation" }

resource "aws_kms_key" "artifacts" {
  description             = "KMS for ${local.project} artifacts"
  deletion_window_in_days = 7
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.project}-${var.account_suffix}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.artifacts.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

output "artifacts_bucket"       { value = aws_s3_bucket.artifacts.bucket }
output "artifacts_kms_key_arn"  { value = aws_kms_key.artifacts.arn }
