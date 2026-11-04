import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';

import * as pipelines from 'aws-cdk-lib/pipelines';

import { WorkflowStage } from './workflow-stage';


export class PipelineStack extends cdk.Stack {

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {

    super(scope, id, props);


    // =====================================
    // 1. CONNECT TO GITHUB
    // =====================================

    const source = pipelines.CodePipelineSource.connection(

      'mureithi111/advanced-iac-automated-workflows',

      'main',

      {

        connectionArn:
          'arn:aws:codestar-connections:us-east-1:345549356290:connection/6a0cf7f5-3462-43b4-bd7c-dc1ec4aed112'

      }

    );


    // =====================================
    // 2. CREATE CDK PIPELINE
    // =====================================

    const pipeline = new pipelines.CodePipeline(
      this,
      'AdvancedIacPipeline',
      {

        pipelineName:
          'AdvancedIacPipeline',

        selfMutation: true,

        crossAccountKeys: false,

        synth: new pipelines.ShellStep(
          'Synth',
          {

            input: source,

            commands: [

              'npm ci',

              'npm run build',

              'npm test',

              'npx cdk synth'

            ]

          }
        )

      }
    );


    // =====================================
    // 3. ADD WORKFLOW DEPLOYMENT STAGE
    // =====================================

    const deploymentStage = new WorkflowStage(
      this,
      'Production',
      {

        env: {

          account: this.account,

          region: this.region

        }

      }
    );


    pipeline.addStage(deploymentStage);

  }

}
