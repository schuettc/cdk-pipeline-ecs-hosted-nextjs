import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
  SecurityPolicyProtocol,
} from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  ARecord,
  AaaaRecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface DistributionResourcesProps {
  applicationLoadBalancer: ApplicationLoadBalancer;
  customHeader: string;
  randomString: string;
  domainName: string;
}
export class DistributionResources extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: DistributionResourcesProps) {
    super(scope, id);

    let certificate: Certificate | undefined;
    let hostedZone: IHostedZone | undefined;

    if (props.domainName) {
      hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.domainName,
      });

      certificate = new Certificate(this, 'Certificate', {
        domainName: props.domainName,
        validation: CertificateValidation.fromDns(hostedZone),
      });
    }

    this.distribution = new Distribution(this, 'CloudfrontDistribution', {
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(props.applicationLoadBalancer, {
          httpPort: 80,
          protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          originId: 'default-origin',
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      domainNames: props.domainName ? [props.domainName] : undefined,
      certificate: certificate,
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    if (hostedZone && props.domainName) {
      new AaaaRecord(this, 'mainAaaaRecord', {
        zone: hostedZone,
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      });

      new ARecord(this, 'mainARecord', {
        zone: hostedZone,
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      });
    }

    const customHeaderLambdaRole = new Role(this, 'customHeaderLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['cloudFrontPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [
                `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${
                  this.distribution.distributionId
                }`,
              ],
              actions: [
                'cloudfront:GetDistribution',
                'cloudfront:UpdateDistribution',
              ],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const customHeaderCustomResourceLambda = new NodejsFunction(
      this,
      'customHeaderCustomResourceLambda',
      {
        handler: 'index.handler',
        entry: 'src/resources/customHeader/index.ts',
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(1),
        runtime: Runtime.NODEJS_LATEST,
        role: customHeaderLambdaRole,
      },
    );

    const customHeaderCustomResourceProvider = new Provider(
      this,
      'customHeaderCustomResourceProvider',
      {
        onEventHandler: customHeaderCustomResourceLambda,
        logRetention: RetentionDays.ONE_WEEK,
      },
    );

    new CustomResource(this, 'customHeaderCustomResource', {
      serviceToken: customHeaderCustomResourceProvider.serviceToken,
      properties: {
        DistributionId: this.distribution.distributionId,
        Origins: [
          {
            OriginId: 'default-origin',
            CustomHeaders: [
              {
                HeaderName: props.customHeader,
                HeaderValue: props.randomString,
              },
            ],
          },
        ],
      },
    });
  }
}
