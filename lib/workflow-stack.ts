import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';

import * as ssm from 'aws-cdk-lib/aws-ssm';

import * as logs from 'aws-cdk-lib/aws-logs';

import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';

import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

import * as path from 'path';


export class WorkflowStack extends cdk.Stack {

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {

    super(scope, id, props);


    // =====================================
    // 1. CREATE SSM PARAMETER
    // =====================================

    const greetingParameter = new ssm.StringParameter(
      this,
      'AppGreetingParameter',
      {
        parameterName: '/app/config/greeting',

        stringValue:
          'Hello from CI/CD Automated Infrastructure!'
      }
    );


    // =====================================
    // 2. CREATE LAMBDA FUNCTION
    // =====================================

    const workflowLambda = new lambda.Function(
      this,
      'AdvancedWorkflowLambda',
      {

        functionName: 'advanced-iac-workflow-lambda',

        runtime: lambda.Runtime.NODEJS_22_X,

        handler: 'index.handler',

        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda')
        ),

        timeout: cdk.Duration.seconds(30),

        memorySize: 256,

        environment: {

          PARAMETER_NAME: greetingParameter.parameterName

        }

      }
    );


    // =====================================
    // 3. GRANT SSM READ PERMISSION
    // =====================================

    greetingParameter.grantRead(workflowLambda);


    // =====================================
    // 4. CREATE LAMBDA LOG GROUP
    // =====================================

    const lambdaLogGroup = new logs.LogGroup(
      this,
      'WorkflowLambdaLogGroup',
      {

        logGroupName:
          `/aws/lambda/${workflowLambda.functionName}`,

        retention: logs.RetentionDays.ONE_WEEK,

        removalPolicy: cdk.RemovalPolicy.DESTROY

      }
    );


    // =====================================
    // 5. CREATE STEP FUNCTIONS LOG GROUP
    // =====================================

    const stateMachineLogGroup = new logs.LogGroup(
      this,
      'WorkflowStateMachineLogGroup',
      {

        logGroupName:
          '/aws/stepfunctions/advanced-iac-workflow',

        retention: logs.RetentionDays.ONE_WEEK,

        removalPolicy: cdk.RemovalPolicy.DESTROY

      }
    );


    // =====================================
    // 6. CREATE PASS STATE
    // =====================================

    const prepareWorkflow = new stepfunctions.Pass(
      this,
      'PrepareWorkflow',
      {

        comment: 'Prepare the workflow input',

        parameters: {

          message: 'Preparing automated workflow',

          'originalInput.$': '$'

        }

      }
    );


    // =====================================
    // 7. CREATE WAIT STATE
    // =====================================

    const waitState = new stepfunctions.Wait(
      this,
      'WaitBeforeProcessing',
      {

        time: stepfunctions.WaitTime.duration(
          cdk.Duration.seconds(2)
        )

      }
    );


    // =====================================
    // 8. CREATE LAMBDA TASK
    // =====================================

    const retrieveConfiguration =
      new tasks.LambdaInvoke(
        this,
        'RetrieveConfiguration',
        {

          lambdaFunction: workflowLambda,

          payloadResponseOnly: true,

          payload:
            stepfunctions.TaskInput.fromJsonPathAt('$')

        }
      );


    // =====================================
    // 9. CONFIGURE RETRIES
    // =====================================

    retrieveConfiguration.addRetry({

      errors: [

        'Lambda.ServiceException',

        'Lambda.AWSLambdaException',

        'Lambda.SdkClientException',

        'Lambda.TooManyRequestsException'

      ],

      interval: cdk.Duration.seconds(2),

      maxAttempts: 3,

      backoffRate: 2

    });


    // =====================================
    // 10. CONFIGURE ERROR HANDLING
    // =====================================

    const workflowFailure = new stepfunctions.Fail(
      this,
      'WorkflowFailure',
      {

        error: 'ConfigurationRetrievalFailed',

        cause:
          'Lambda could not retrieve the SSM configuration.'

      }
    );


    retrieveConfiguration.addCatch(
      workflowFailure,
      {

        errors: ['States.ALL'],

        resultPath: '$.error'

      }
    );


    // =====================================
    // 11. CONNECT WORKFLOW STATES
    // =====================================

    const definition = prepareWorkflow
      .next(waitState)
      .next(retrieveConfiguration);


    // =====================================
    // 12. CREATE STATE MACHINE
    // =====================================

    const stateMachine = new stepfunctions.StateMachine(
      this,
      'AdvancedWorkflowStateMachine',
      {

        stateMachineName:
          'AdvancedWorkflowStateMachine',

        definitionBody:
          stepfunctions.DefinitionBody.fromChainable(
            definition
          ),

        stateMachineType:
          stepfunctions.StateMachineType.STANDARD,

        timeout: cdk.Duration.minutes(5),

        logs: {

          destination: stateMachineLogGroup,

          level: stepfunctions.LogLevel.ALL,

          includeExecutionData: true

        }

      }
    );


    // =====================================
    // 13. OUTPUT RESOURCE INFORMATION
    // =====================================

    new cdk.CfnOutput(
      this,
      'LambdaFunctionName',
      {

        value: workflowLambda.functionName

      }
    );


    new cdk.CfnOutput(
      this,
      'LambdaFunctionArn',
      {

        value: workflowLambda.functionArn

      }
    );


    new cdk.CfnOutput(
      this,
      'StateMachineArn',
      {

        value: stateMachine.stateMachineArn

      }
    );


    new cdk.CfnOutput(
      this,
      'SSMParameterName',
      {

        value: greetingParameter.parameterName

      }
    );


    new cdk.CfnOutput(
      this,
      'LambdaLogGroup',
      {

        value: lambdaLogGroup.logGroupName

      }
    );

  }

}
