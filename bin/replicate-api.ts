#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ReplicateProxyApiStack } from '../lib/replicate-api-stack';

const app = new cdk.App();
new ReplicateProxyApiStack(app, 'replicateProxyApi', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});