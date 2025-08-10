
variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "account_suffix" {
  description = "Unique suffix for bucket naming"
  type        = string
}

