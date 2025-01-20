import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from 'constructs';
import * as path from 'path';

export class ReplicateProxyApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for storing images
    const imagesBucket = new s3.Bucket(this, 'ReplicateImagesBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // enforceSSL: true,
      lifecycleRules: [
        {
          // expiration: cdk.Duration.days(7),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    // Create DynamoDB table
    const replicateProxyTable = new dynamodb.Table(this, 'ReplicateProxyTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Create Lambda layer
    const layer = new lambda.LayerVersion(this, 'ReplicateLayer', {
      code: lambda.Code.fromAsset('./scripts/lambda-layer.zip'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Dependencies for Replicate API proxy',
    });

    // Create Download Images Lambda function
    const downloadImagesHandler = new lambda.Function(this, 'DownloadImagesHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'stream-processor.handler',
      layers: [layer],
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda')),
      environment: {
        REPLICATE_PROXY_TABLE: replicateProxyTable.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
        DEPLOY_TIME: `${Date.now()}`
      },
      timeout: cdk.Duration.seconds(900),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    // Grant permissions to download images handler
    imagesBucket.grantWrite(downloadImagesHandler);
    replicateProxyTable.grantReadWriteData(downloadImagesHandler);

    downloadImagesHandler.addEventSource(new lambdaEventSources.DynamoEventSource(replicateProxyTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1, // Optional: Customize the batch size for processing
    }));

    // Add CloudWatch Logs permissions
    downloadImagesHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));

    // Get Replicate API token from SSM Parameter Store
    const replicateApiToken = ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        'ReplicateApiToken',
        {
          parameterName: '/replicate/api-token',
          version: 1,
        }
    );

    // Create Lambda function
    const handler = new lambda.Function(this, 'ReplicateHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      layers:[
        layer
      ],
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda')),
      environment: {
        REPLICATE_API_TOKEN: replicateApiToken.parameterName,
        REPLICATE_PROXY_TABLE: replicateProxyTable.tableName,
        DEPLOY_TIME: `${Date.now()}`,
        DOWNLOAD_IMAGES_FUNCTION: downloadImagesHandler.functionName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    // Add explicit SSM parameter read permissions
    handler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters'
      ],
      resources: [replicateApiToken.parameterArn],
    }));

    // Grant Lambda permission to read SSM parameter
    replicateApiToken.grantRead(handler);
    replicateProxyTable.grantReadWriteData(handler)

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ReplicateApi', {
      restApiName: 'Replicate Proxy API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Request-ID',
          'X-Proxy-Timestamp',
        ],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Create API Gateway integration
    const integration = new apigateway.LambdaIntegration(handler, {
      proxy: true,
    });

    // Add POST method to root resource
    api.root.addMethod('POST', integration);
    api.root.addMethod('GET', integration);

    // Add useful stack outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'ReplicateApiEndpoint',
    });

    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: imagesBucket.bucketName,
      description: 'S3 bucket name for storing images',
      exportName: 'ReplicateImagesBucketName',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: replicateProxyTable.tableName,
      description: 'DynamoDB table name for storing job records',
      exportName: 'ReplicateProxyTableName',
    });

    new cdk.CfnOutput(this, 'DownloadImagesLambdaArn', {
      value: downloadImagesHandler.functionArn,
      description: 'ARN of the download images Lambda function',
      exportName: 'DownloadImagesLambdaArn',
    });

    new cdk.CfnOutput(this, 'MainLambdaArn', {
      value: handler.functionArn,
      description: 'ARN of the main API Lambda function',
      exportName: 'MainLambdaArn',
    });
  }
}