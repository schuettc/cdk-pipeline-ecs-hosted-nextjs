import { App, Stack, StackProps } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
} from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import { BlogStage, BlogProps } from '.';

config();

interface PipelineProps extends StackProps {
  logLevel: string;
  domainName?: string;
  connectionArn?: string;
  githubRepo?: string;
  githubBranch?: string;
}

export class Pipeline extends Stack {
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    if (!props.connectionArn) {
      throw new Error('Connection ARN is required');
    }

    if (!props.githubRepo) {
      throw new Error('GitHub repo is required');
    }

    if (!props.githubBranch) {
      throw new Error('GitHub branch is required');
    }

    const pipeline = new CodePipeline(this, 'Pipeline', {
      synth: new CodeBuildStep('Synth', {
        input: CodePipelineSource.connection(
          props.githubRepo,
          props.githubBranch,
          {
            connectionArn: props.connectionArn,
          },
        ),
        commands: [
          'yarn install --frozen-lockfile',
          'yarn build',
          'npx cdk synth',
        ],
        rolePolicyStatements: [
          new PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'iam:ResourceTag/aws-cdk:bootstrap-role': 'lookup',
              },
            },
          }),
        ],
      }),
      selfMutation: true,
      dockerEnabledForSynth: true,
    });

    pipeline.addStage(new BlogStage(this, 'Blog', props as BlogProps));
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  domainName: process.env.DOMAIN_NAME || '',
  connectionArn: process.env.CONNECTION_ARN,
  githubRepo: process.env.GITHUB_REPO,
  githubBranch: process.env.GITHUB_BRANCH,
};

const app = new App();

new Pipeline(app, 'BlogPipeline', {
  ...stackProps,
  env: devEnv,
});

app.synth();
