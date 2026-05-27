# DOCUMENTATION

Week 7 provisions AWS infrastructure declaratively with Terraform: a VPC, a subnet, and an EC2 instance launched inside that subnet. The configuration is split across four `.tf` files so inputs, outputs, networking, and compute can be edited independently. All resources are deployed to `ap-southeast-1`.

## Quick Start

For anyone cloning this repository who wants to provision the stack immediately without reading the full guide.

Prerequisites: Terraform, the AWS CLI, and AWS credentials configured locally (`aws configure`).

```powershell
# 1. Initialize the working directory (downloads the AWS provider plugin)
cd w7
terraform init

# 2. Preview the changes
terraform plan

# 3. Apply — creates VPC + subnet + EC2
terraform apply

# 4. View the deployed resource details
terraform output
```

The configuration deploys to `ap-southeast-1` and uses the Amazon Linux 2 AMI pinned in `variables.tf`. The EC2 instance type defaults to `t3.micro` and can be overridden by editing `variables.tf` or passing `-var="instance_type=..."` on the CLI.

To tear everything down later, see [Section VII](#vii-cleanup).

## I. Prerequisites and Provider Setup

Terraform talks to AWS through the AWS provider, which authenticates using the credentials already configured for the AWS CLI. The provider block declares the target region; everything in the configuration is region-scoped to `ap-southeast-1` (Singapore).

Verification commands:

```powershell
terraform -v
aws --version
aws sts get-caller-identity
```

The `get-caller-identity` call returns the IAM user ARN, confirming both the credentials and the network path to AWS.

Provider declaration in `w7/main.tf`:

```hcl
provider "aws" {
  region = "ap-southeast-1"
}
```

Result:

`terraform init` downloads the AWS provider plugin into `.terraform/providers/` and writes a lockfile (`.terraform.lock.hcl`) pinning the provider version. The lockfile is committed so subsequent inits resolve to the same plugin build.

## II. EC2 Instance

The compute resource is a single Amazon Linux 2 EC2 instance. The AMI ID is region-specific — the value pinned in `variables.tf` is the most recent Amazon Linux 2 image for `ap-southeast-1` at the time of provisioning. New IDs can be looked up with:

```powershell
aws ec2 describe-images --region ap-southeast-1 --owners amazon `
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" `
  --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text
```

Resource definition in `w7/main.tf`:

```hcl
resource "aws_instance" "tf_ec2_instance" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.subnet1.id

  tags = {
    Name = "TerraformEC2InVPC"
  }
}
```

The `subnet_id` argument places the instance into the VPC subnet defined in [Section IV](#iv-vpc-and-subnet). Without this argument, AWS would auto-place the instance into the account's default VPC.

Result:

`terraform apply` provisions the instance in roughly 30-60 seconds. The instance comes up with a private IP from the subnet's CIDR (`10.0.1.0/24`) and no public IP — see [Section V](#v-network-characteristics) for why.

## III. Variables and Outputs

Configuration values are split out of `main.tf` so the same resource definitions can be reused with different inputs. Defaults live in `variables.tf` and can be overridden per-run.

File: `w7/variables.tf`

```hcl
variable "instance_type" {
  description = "Type of EC2 instance"
  default     = "t3.micro"
}

variable "ami_id" {
  description = "AMI to use"
  default     = "ami-0e8bf7e1d1f339c74"
}
```

Variables are referenced from resources with the `var.` prefix (e.g. `var.ami_id`). This namespace distinguishes input variables from resource attributes, local values, and data source results, all of which share Terraform's expression syntax.

Outputs expose useful attributes of the deployed resources for inspection without having to query AWS directly.

File: `w7/output.tf`

```hcl
output "instance_id"   { value = aws_instance.tf_ec2_instance.id }
output "public_ip"     { value = aws_instance.tf_ec2_instance.public_ip }
output "instance_type" { value = aws_instance.tf_ec2_instance.instance_type }
output "private_ip"    { value = aws_instance.tf_ec2_instance.private_ip }
output "vpc_id"        { value = aws_vpc.main.id }
```

Reading outputs after apply:

```powershell
terraform output                    # prints all outputs
terraform output -raw instance_id   # prints a single value, unquoted
```

Result:

After `apply`, the output block prints the instance ID, private IP, VPC ID, and configured instance type. Outputs refresh automatically on every successful apply and can be re-read at any time without re-applying.

## IV. VPC and Subnet

The VPC is a logically isolated network in AWS. A subnet carves out an IP range within the VPC and is bound to a specific Availability Zone. Both resources are declared together so they can be applied or destroyed as a unit.

File: `w7/vpc.tf`

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = { Name = "TerraformVPC" }
}

resource "aws_subnet" "subnet1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "ap-southeast-1a"
  tags = { Name = "TerraformSubnet1" }
}
```

The subnet's `vpc_id = aws_vpc.main.id` reference creates an **implicit dependency**: Terraform knows the VPC must exist before the subnet can be created and orders the API calls accordingly. The same mechanism orders the EC2 after the subnet in [Section II](#ii-ec2-instance).

Result:

`terraform apply` creates the VPC first, then the subnet, then the EC2 instance — visible as three sequential `Creation complete after Ns` lines in the apply output. The resource graph is computed automatically; no explicit ordering is required in the configuration.

## V. Network Characteristics

The EC2 instance is reachable inside the VPC by its private IP but has **no public IP** by default. This is the standard behavior of a custom subnet: `map_public_ip_on_launch` is `false` unless explicitly overridden. Default VPCs, by contrast, ship with this flag enabled, which is why instances launched without a `subnet_id` argument receive a public IP automatically.

Inspecting the instance's networking from the CLI:

```powershell
aws ec2 describe-instances --instance-ids $(terraform output -raw instance_id) `
  --query "Reservations[0].Instances[0].[VpcId,SubnetId,PrivateIpAddress,PublicIpAddress]" `
  --output table
```

To enable an auto-assigned public IP, add `map_public_ip_on_launch = true` to the subnet resource:

```hcl
resource "aws_subnet" "subnet1" {
  # ...
  map_public_ip_on_launch = true
}
```

This change is a `forceNew` attribute on the instance, so applying it replaces the existing EC2 rather than modifying it in place (see [Section VI](#vi-resource-lifecycle)).

Even with a public IP attached, the instance is not internet-reachable. A complete public-facing stack also requires an Internet Gateway, a route table entry of `0.0.0.0/0 → igw-...`, a route table association on the subnet, and a security group permitting inbound traffic. None of these are declared here; the configuration intentionally stays minimal.

Result:

The provisioned EC2 sits in a private network position. The `public_ip` output evaluates to an empty string. Outbound and inbound connectivity from outside the VPC is not available without additional networking resources.

## VI. Resource Lifecycle

Terraform records the state of every managed resource in `terraform.tfstate`. Each subsequent `plan` diffs the state file against the configuration and the live AWS API, producing one of three operations per resource: `create`, `update in-place`, or `replace` (destroy + create).

Some attributes are mutable on a running resource; others are launch-time-only and cannot be changed without recreating the resource. Examples:

| Change                                      | Operation        |
| ------------------------------------------- | ---------------- |
| `tags = { Name = "X" }` → `"Y"`             | Update in-place  |
| `instance_type = "t3.micro"` → `"t3.small"` | Replace (forced) |
| `subnet_id = subnet1` → `subnet2`           | Replace (forced) |
| Adding a new resource block                 | Create           |
| Removing a resource block                   | Destroy          |

The plan output annotates the reason with `# forces replacement` next to the attribute that triggered it. Example plan after editing `instance_type` in `variables.tf`:

```
  # aws_instance.tf_ec2_instance must be replaced
-/+ resource "aws_instance" "tf_ec2_instance" {
      ~ instance_type = "t3.micro" -> "t3.small" # forces replacement
      ...
    }

Plan: 1 to add, 0 to change, 1 to destroy.
```

Inspecting state directly:

```powershell
terraform state list                       # every resource Terraform tracks
terraform state show aws_vpc.main          # full attributes of one resource
```

Result:

State management is what makes `terraform plan` accurate and `terraform destroy` complete. Resources created outside Terraform (Console clicks, AWS CLI calls, other Terraform projects) are invisible to this state file and will not be touched by any command run from `w7/`. Conversely, deleting a managed resource manually in the Console leaves a phantom entry in state that the next plan will surface as drift.

## VII. Cleanup

### Tear down all managed resources

```powershell
terraform destroy
```

Terraform walks the state in reverse dependency order — EC2 first, then subnet, then VPC — issuing the corresponding AWS DeleteX API calls. The state file is emptied to `{}` on success.

### Verify nothing remains

```powershell
terraform state list   # should print nothing
```

In the AWS Console (region selector = **Singapore**):

- **EC2 → Instances** — no `TerraformEC2InVPC` in `Running` state. `Terminated` rows are harmless; they auto-clear within an hour.
- **VPC → Your VPCs** — no `TerraformVPC`. The account's default VPC and any unrelated VPCs (e.g. `lamina-vpc`) are not touched.
- **VPC → Subnets** — no `TerraformSubnet1`.

Resources created outside Terraform remain untouched by `destroy`. Anything created by Terraform but not removed by `destroy` is an orphan and must be deleted manually in the Console.
