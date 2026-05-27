provider "aws" {
  region = "ap-southeast-1"
}

resource "aws_instance" "tf_ec2_instance" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.subnet1.id

  tags = {
    Name = "TerraformEC2InVPC"
  }
}