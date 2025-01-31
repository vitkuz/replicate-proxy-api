import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';
import 'dotenv/config'

export class ReplicateProxyApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Get the actual token value
    const replicateTokenValue = process.env.REPLICATE_TOKEN_VALUE;
    const openaiTokenValue = process.env.OPENAI_API_KEY;
    const elevenlabsTokenValue = process.env.ELEVENLABS_API_KEY;

    if (!replicateTokenValue) {
      throw new Error('REPLICATE_TOKEN_VALUE')
    }

    if (!openaiTokenValue) {
      throw new Error('OPENAI_API_KEY')
    }

    if (!elevenlabsTokenValue) {
      throw new Error('ELEVENLABS_API_KEY')
    }

    // SNS Topic
    const topic = new sns.Topic(this, 'TaskEventsTopic');

    // todo: add sqs to track notifications

    // Create S3 bucket for storing images
    const imagesBucket = new s3.Bucket(this, 'ReplicateImagesBucket', {
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    // DynamoDB Table
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
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
        REPLICATE_API_BASE: 'https://api.replicate.com/v1',
        REPLICATE_API_TOKEN: replicateTokenValue, //!
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

    // Add CloudWatch Logs permissions //todo: probably i dont need all that
    downloadImagesHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));

    // Create Lambda function
    const handler = new lambda.Function(this, 'ReplicateHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      layers:[
        layer
      ],
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda')),
      environment: {
        REPLICATE_API_BASE: 'https://api.replicate.com/v1',
        REPLICATE_API_TOKEN: replicateTokenValue,
        REPLICATE_PROXY_TABLE: replicateProxyTable.tableName,
        DEPLOY_TIME: `${Date.now()}`,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_DAY,
    });

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
    api.root.addMethod('DELETE', integration);
    api.root.addMethod('PUT', integration);


    ///

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      // handler: 'index.handler',
      layers:[
        layer
      ],
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda/handlers')),
      environment: {
        REPLICATE_API_BASE: 'https://api.replicate.com/v1',
        REPLICATE_API_TOKEN: replicateTokenValue,
        REPLICATE_PROXY_TABLE: replicateProxyTable.tableName,
        DEPLOY_TIME: `${Date.now()}`,
        OPENAI_API_KEY: openaiTokenValue,
        ELEVENLABS_API_KEY: elevenlabsTokenValue,
        //
        TABLE_NAME: tasksTable.tableName,
        TOPIC_ARN: topic.topicArn,
        BUCKET_NAME: imagesBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_DAY,
    };

    const createTaskFn = new lambda.Function(this, 'CreateTaskFn', {
      ...commonLambdaProps,
      handler: 'createTask.handler',
    });

    const listTasksFn = new lambda.Function(this, 'ListTaskFn', {
      ...commonLambdaProps,
      handler: 'listTasks.handler',
    });

    const getTaskFn = new lambda.Function(this, 'GetTaskFn', {
      ...commonLambdaProps,
      handler: 'getTask.handler',
    });

    const updateTaskFn = new lambda.Function(this, 'UpdateTaskFn', {
      ...commonLambdaProps,
      handler: 'updateTask.handler',
    });

    const deleteTaskFn = new lambda.Function(this, 'DeleteTaskFn', {
      ...commonLambdaProps,
      handler: 'deleteTask.handler'
    });

    const webhookFn = new lambda.Function(this, 'WebhookFn', {
      ...commonLambdaProps,
      handler: 'webhook.handler'
    });

    const streamProcessorFn = new lambda.Function(this, 'StreamProcessorFn', {
      ...commonLambdaProps,
      timeout: cdk.Duration.seconds(900),
      handler: 'streamProcessor.handler'
    });

    tasksTable.grantReadWriteData(createTaskFn);
    tasksTable.grantReadData(getTaskFn);
    tasksTable.grantReadWriteData(updateTaskFn);
    tasksTable.grantReadData(listTasksFn);
    tasksTable.grantReadWriteData(deleteTaskFn);
    topic.grantPublish(streamProcessorFn);

    streamProcessorFn.addEventSource(new lambdaEventSources.DynamoEventSource(tasksTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1, // Optional: Customize the batch size for processing
    }));

    tasksTable.grantReadWriteData(streamProcessorFn);
    imagesBucket.grantReadWrite(streamProcessorFn);

    const tasks = api.root.addResource('tasks');
    const task = tasks.addResource('{id}');
    const webhook = api.root.addResource('webhook');

    // API Routes
    tasks.addMethod('POST', new apigateway.LambdaIntegration(createTaskFn));
    tasks.addMethod('GET', new apigateway.LambdaIntegration(listTasksFn));
    task.addMethod('GET', new apigateway.LambdaIntegration(getTaskFn));
    task.addMethod('PUT', new apigateway.LambdaIntegration(updateTaskFn));
    task.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTaskFn));
    webhook.addMethod('POST', new apigateway.LambdaIntegration(webhookFn));

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