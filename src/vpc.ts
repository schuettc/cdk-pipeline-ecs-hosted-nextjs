import {
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VPCResources extends Construct {
  public applicationLoadBalancerSecurityGroup: SecurityGroup;
  public vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'VPC', {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PUBLIC,
        },
      ],
      maxAzs: 2,
      natGateways: 0,
    });

    this.applicationLoadBalancerSecurityGroup = new SecurityGroup(
      this,
      'applicationLoadBalancerSecurityGroup',
      {
        vpc: this.vpc,
        description: 'Security Group for ALB',
      },
    );

    this.applicationLoadBalancerSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
    );
  }
}
