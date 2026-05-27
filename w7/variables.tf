variable "instance_type" {
  description = "Type of EC2 instance"
  default     = "t3.micro"
}

variable "ami_id" {
  description = "AMI to use"
  default     = "ami-0e8bf7e1d1f339c74"
}
