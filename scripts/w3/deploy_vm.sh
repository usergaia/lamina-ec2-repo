#!/bin/bash

VPC_NAME="auto-vpc-$(date +%Y%m%d_%H%M%S)"
SG_NAME="auto-secgrp-$(date +%Y%m%d_%H%M%S)"

echo "Creating VPC..."

VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$VPC_NAME}]" \
  --query 'Vpc.VpcId' \
  --output text)

echo "VPC created: $VPC_ID"

echo "Creating Security Group..."

SG_ID=$(aws ec2 create-security-group \
  --group-name "$SG_NAME" \
  --description "Auto security group" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' \
  --output text)

echo "Security Group created: $SG_ID"

echo "Adding SSH rule..."

aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

echo "SSH rule added."

echo "VM Setup complete!"