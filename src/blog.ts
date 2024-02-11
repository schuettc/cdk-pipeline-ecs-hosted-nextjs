import { randomBytes } from 'crypto';
import { StackProps, Stage, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ECSResources, VPCResources, DistributionResources } from '.';

export interface BlogProps extends StackProps {
  logLevel: string;
  domainName: string;
}

export class BlogStage extends Stage {
  constructor(scope: Construct, id: string, props: BlogProps) {
    super(scope, id, props);
    new BlogStack(this, 'Resources', props);
  }
}

class BlogStack extends Stack {
  constructor(scope: Construct, id: string, props: BlogProps) {
    super(scope, id, props);
    const randomString = generateRandomString(12);
    const customHeader = 'X-From-CloudFront';

    const vpcResources = new VPCResources(this, 'VPCResources');
    const ecsResources = new ECSResources(this, 'ECSResources', {
      vpc: vpcResources.vpc,
      logLevel: props.logLevel,
      applicationLoadBalancerSecurityGroup:
        vpcResources.applicationLoadBalancerSecurityGroup,
      customHeader: customHeader,
      randomString: randomString,
    });

    new DistributionResources(this, 'DistributionResources', {
      applicationLoadBalancer: ecsResources.applicationLoadBalancer,
      customHeader: customHeader,
      randomString: randomString,
      domainName: props.domainName,
    });
  }
}

function generateRandomString(length: number): string {
  const randomBytesArray = randomBytes(length);
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytesArray[i] % charset.length;
    result += charset.charAt(randomIndex);
  }

  return result;
}
