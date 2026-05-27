output "instance_id" {
  value = aws_instance.tf_ec2_instance.id
}

output "public_ip" {
  value = aws_instance.tf_ec2_instance.public_ip
}

output "instance_type" {
  value = aws_instance.tf_ec2_instance.instance_type
}

output "private_ip" {
  value = aws_instance.tf_ec2_instance.private_ip
}

output "vpc_id" {
  value = aws_vpc.main.id
}