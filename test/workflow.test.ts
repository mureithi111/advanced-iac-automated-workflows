import * as cdk from 'aws-cdk-lib';

import { Template } from 'aws-cdk-lib/assertions';

import { WorkflowStack } from '../lib/workflow-stack';


test('Workflow infrastructure is created', () => {

  const app = new cdk.App();

  const stack = new WorkflowStack(
    app,
    'TestWorkflowStack'
  );

  const template = Template.fromStack(stack);


  // Verify Lambda exists

  template.resourceCountIs(
    'AWS::Lambda::Function',
    1
  );


  // Verify SSM parameter exists

  template.resourceCountIs(
    'AWS::SSM::Parameter',
    1
  );


  // Verify Step Functions state machine exists

  template.resourceCountIs(
    'AWS::StepFunctions::StateMachine',
    1
  );

});
