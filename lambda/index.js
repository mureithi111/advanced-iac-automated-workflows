const {
    SSMClient,
    GetParameterCommand
} = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({});

exports.handler = async (event) => {

    console.log("Workflow started");
    console.log("Input event:", JSON.stringify(event));

    const parameterName = process.env.PARAMETER_NAME;

    try {

        const command = new GetParameterCommand({
            Name: parameterName,
            WithDecryption: false
        });

        const result = await ssm.send(command);

        const greeting = result.Parameter.Value;

        console.log("Retrieved from SSM:", greeting);

        return {
            status: "Success",
            message: "Configuration retrieved successfully",
            parameterName: parameterName,
            greeting: greeting,
            input: event
        };

    } catch (error) {

        console.error("Failed to retrieve SSM parameter:", error);

        throw error;
    }
};
