const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');
const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.126.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-pipeline-ecs-hosted-nextjs',
  appEntrypoint: 'cdk-pipeline-ecs-hosted-nextjs.ts',
  license: 'MIT-0',
  author: 'Court Schuett',
  copyrightOwner: 'Court Schuett',
  authorAddress: 'https://subaud.io',
  devDeps: ['esbuild'],
  projenrcTs: true,
  jest: false,
  deps: [
    '@aws-sdk/client-cloudfront',
    '@types/aws-lambda',
    'aws-lambda',
    'dotenv',
  ],
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc'],
  },
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
});

project.addTask('launch', {
  exec: 'yarn && yarn projen && yarn build && yarn cdk bootstrap && yarn cdk deploy  --require-approval never',
});

project.tsconfigDev.file.addOverride('include', [
  'src/**/*.ts',
  'site/src/**/*.tsx',
  './.projenrc.ts',
]);

project.eslint.addOverride({
  files: ['src/resources/**/*.ts'],
  rules: {
    'indent': 'off',
    '@typescript-eslint/indent': 'off',
  },
});

project.eslint.addOverride({
  files: ['src/resources/**/*.ts'],
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    'import/no-extraneous-dependencies': 'off',
  },
});

const common_exclude = [
  'docker-compose.yaml',
  'cdk.out',
  'yarn-error.log',
  'dependabot.yml',
  '.DS_Store',
  '**/dist/**',
  '.env',
  'config.json',
];

project.gitignore.exclude(...common_exclude);
project.synth();
