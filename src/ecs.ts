import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
} from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  ListenerCondition,
  Protocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface ECSResourcesProps {
  vpc: Vpc;
  logLevel: string;
  applicationLoadBalancerSecurityGroup: SecurityGroup;
  customHeader: string;
  randomString: string;
}

export class ECSResources extends Construct {
  fargateService: FargateService;
  applicationLoadBalancer: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ECSResourcesProps) {
    super(scope, id);

    const cluster = new Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: 'blog',
    });

    this.applicationLoadBalancer = new ApplicationLoadBalancer(
      this,
      'applicationLoadBalancer',
      {
        vpc: props.vpc,
        vpcSubnets: { subnetType: SubnetType.PUBLIC },
        internetFacing: true,
        securityGroup: props.applicationLoadBalancerSecurityGroup,
      },
    );

    const ecsTask = new FargateTaskDefinition(this, 'ecsTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.X86_64,
      },
    });

    ecsTask.addContainer('BlogContainer', {
      image: ContainerImage.fromAsset('nextjs-docker'),
      containerName: 'blog',
      portMappings: [{ containerPort: 3000, hostPort: 3000 }],
      logging: LogDrivers.awsLogs({
        streamPrefix: 'blog',
      }),
      environment: {},
    });

    const taskSecurityGroup = new SecurityGroup(this, 'taskSecurityGroups', {
      vpc: props.vpc,
    });

    this.fargateService = new FargateService(this, 'blogFargateService', {
      cluster: cluster,
      taskDefinition: ecsTask,
      assignPublicIp: true,
      desiredCount: 1,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [taskSecurityGroup],
    });

    const scaling = this.fargateService.autoScaleTaskCount({ maxCapacity: 10 });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
    });

    const fargateTargetGroup = new ApplicationTargetGroup(
      this,
      'blogTargetGroup',
      {
        vpc: props.vpc,
        port: 3000,
        protocol: ApplicationProtocol.HTTP,
        targets: [this.fargateService],
        healthCheck: {
          path: '/',
          protocol: Protocol.HTTP,
          port: '3000',
        },
      },
    );

    const fargateListener = this.applicationLoadBalancer.addListener(
      'fargateListener',
      {
        port: 80,
        protocol: ApplicationProtocol.HTTP,
        open: true,
        defaultAction: ListenerAction.fixedResponse(403),
      },
    );

    fargateListener.addAction('ForwardFromCloudFront', {
      action: ListenerAction.forward([fargateTargetGroup]),
      conditions: [
        ListenerCondition.httpHeader(props.customHeader, [props.randomString]),
      ],
      priority: 1,
    });
  }
}
