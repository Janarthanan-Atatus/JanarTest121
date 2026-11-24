provider "aws" {
  region = "us-east-1"
}

resource "aws_kms_key" "data" {
  description         = "S3 data bucket key"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "data" {
  bucket = "demo-vulnerable-bucket"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
  }
}

variable "vpc_id" {
  type = string
}

variable "app_cidr" {
  type        = string
  description = "CIDR allowed to reach the app"
}

resource "aws_security_group" "app" {
  name        = "app-restricted"
  description = "Allow app traffic from a known CIDR only"
  vpc_id      = var.vpc_id

  ingress {
    description = "App HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.app_cidr]
  }

  egress {
    description = "HTTPS out"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "kubernetes_pod" "app" {
  metadata {
    name = "app"
  }
  spec {
    automount_service_account_token = false
    container {
      name  = "app"
      image = "node:22-bookworm-slim"
      security_context {
        privileged                 = false
        allow_privilege_escalation = false
        read_only_root_filesystem  = true
        run_as_non_root            = true
        run_as_user                = 1000
        capabilities {
          drop = ["ALL"]
        }
      }
      resources {
        limits = {
          cpu    = "500m"
          memory = "256Mi"
        }
        requests = {
          cpu    = "100m"
          memory = "128Mi"
        }
      }
    }
  }
}
