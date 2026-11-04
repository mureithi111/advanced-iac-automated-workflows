import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

import * as path from 'path';

export class WorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Production gets its own parameter to avoid conflicting
    // with the parameter used by the older deployed application.
    const greetingParameter = new ssm.StringParameter(
      this,
      'AppGreetingParameter',
      {
        parameterName: '/app/config/greeting-prod',
        stringValue: 'Hello from CI/CD Automated Infrastructure!',
      }
    );

    // Dedicated Production Lambda log group.
    const workflowLambdaLogGroup = new logs.LogGroup(
      this,
      'AdvancedWorkflowLambdaLogGroup',
      {
        logGroupName: '/aws/lambda/advanced-iac-workflow-lambda-prod',
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }
    );

    // Dedicated Production Lambda function.
    const workflowLambda = new lambda.Function(
      this,
      'AdvancedWorkflowLambda',
      {
        functionName: 'advanced-iac-workflow-lambda-prod',
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda')
        ),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        logGroup: workflowLambdaLogGroup,
        environment: {
          PARAMETER_NAME: greetingParameter.parameterName,
        },
      }
    );

    greetingParameter.grantRead(workflowLambda);

    // Dedicated Production Step Functions log group.
    const stateMachineLogGroup = new logs.LogGroup(
      this,
      'WorkflowStateMachineLogGroup',
      {
        logGroupName: '/aws/stepfunctions/advanced-iac-workflow-prod',
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }
    );

    const prepareWorkflow = new stepfunctions.Pass(
      this,
      'PrepareWorkflow',
      {
        comment: 'Prepare the workflow input',
        parameters: {
          message: 'Preparing automated workflow',
          'originalInput.$': '$',
        },
      }
    );

    const waitState = new stepfunctions.Wait(
      this,
      'WaitBeforeProcessing',
      {
        time: stepfunctions.WaitTime.duration(
          cdk.Duration.seconds(2)
        ),
      }
    );

    const retrieveConfiguration = new tasks.LambdaInvoke(
      this,
      'RetrieveConfiguration',
      {
        lambdaFunction: workflowLambda,
        payloadResponseOnly: true,
        payload: stepfunctions.TaskInput.fromJsonPathAt('$'),
      }
    );

    retrieveConfiguration.addRetry({
      errors: [
        'Lambda.ServiceException',
        'Lambda.AWSLambdaException',
        'Lambda.SdkClientException',
        'Lambda.TooManyRequestsException',
      ],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    const workflowFailure = new stepfunctions.Fail(
      this,
      'WorkflowFailure',
      {
        error: 'ConfigurationRetrievalFailed',
        cause: 'Lambda could not retrieve the SSM configuration.',
      }
    );

    retrieveConfiguration.addCatch(workflowFailure, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    const definition = prepareWorkflow
      .next(waitState)
      .next(retrieveConfiguration);

    const stateMachine = new stepfunctions.StateMachine(
      this,
      'AdvancedWorkflowStateMachine',
      {
        stateMachineName: 'AdvancedWorkflowStateMachine',
        definitionBody:
          stepfunctions.DefinitionBody.fromChainable(definition),
        stateMachineType: stepfunctions.StateMachineType.STANDARD,
        timeout: cdk.Duration.minutes(5),
        logs: {
          destination: stateMachineLogGroup,
          level: stepfunctions.LogLevel.ALL,
          includeExecutionData: true,
        },
      }
    );

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: workflowLambda.functionName,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: workflowLambda.functionArn,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
    });

    new cdk.CfnOutput(this, 'SSMParameterName', {
      value: greetingParameter.parameterName,
    });

    new cdk.CfnOutput(this, 'LambdaLogGroup', {
      value: workflowLambdaLogGroup.logGroupName,
    });

    new cdk.CfnOutput(this, 'StateMachineLogGroup', {
      value: stateMachineLogGroup.logGroupName,
    });
  }
}
