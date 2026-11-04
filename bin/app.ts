#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';

import { PipelineStack } from '../lib/pipeline-stack';


const app = new cdk.App();


const account =
  process.env.CDK_DEFAULT_ACCOUNT;

const region =
  process.env.CDK_DEFAULT_REGION || 'us-east-1';


if (!account) {

  throw new Error(
    'AWS account not found. Configure AWS credentials first.'
  );

}


new PipelineStack(
  app,
  'AdvancedIacPipelineStack',
  {

    env: {

      account: account,

      region: region

    }

  }
);
