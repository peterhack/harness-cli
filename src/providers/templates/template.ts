import { Variable } from './variables'
import { Step, StepType, FileSourceStep, RenameFileStep, SetValueStep, CreateApplicationStep } from './steps'
import { File } from '../../util/filesystem'
import * as _ from 'lodash'
import { Harness } from '../harness/harness-api-client'
import { HarnessStorageProvider } from '../storage/harness-api-storage'

export interface TemplateRef {
    source: string
}

export interface TemplateExecutionContext {
    vars: any,
    workspace: File[],
    outputs: any
}

export class Template {
    name: string
    description?: string
    templateVersion?: string
    schemaVersion?: string
    author?: string
    parentTemplate?: TemplateRef
    sourceFiles: File[]
    variables: Variable[]
    steps: Step[]

    public constructor(inputObj: any) {
        this.name = inputObj.name || ''
        this.sourceFiles = inputObj.sourceFiles || []
        this.variables = inputObj.variables || []
        
        this.steps = []
        for (const step of (inputObj.steps || [])) {
            const stepFiles: string[] = step.files || []
            if (step.file) {
                stepFiles.push(step.file)
            }
            if (stepFiles.length === 0) {
                stepFiles.push('**/*.yaml')
            }
            if (step.type === StepType.FileSource) {
                this.steps.push(new FileSourceStep(step.name, step.source, stepFiles))
            } else if (step.type === StepType.RenameFile) {
                this.steps.push(new RenameFileStep(step.name, step.search, step.replace, stepFiles))
            } else if (step.type === StepType.SetValue) {
                this.steps.push(new SetValueStep(step.name, step.path, step.value, stepFiles))
            }  else if (step.type === StepType.CreateApplication) {
                this.steps.push(new CreateApplicationStep(step.name, step.applicationName))
            } else {
                throw new Error('Invalid step type')
            }
        }
    }

    public async execute(inputVars: any, destination: Harness): Promise<TemplateExecutionContext> {
        // Create workspace
        const context: TemplateExecutionContext = {
            vars: {},
            workspace: [],
            outputs: {},
        }

        this.processVariables(inputVars, context)
        await this.executeTemplateSteps(context)

        // Preview changes

        // Upsert yaml results
        if (context.workspace.length > 0) {
            console.log('Pushing changes to destination')
            const destinationStorage = new HarnessStorageProvider(destination)
            await destinationStorage.init()
            await destinationStorage.storeFiles(context.workspace)
            await destinationStorage.dispose()
        }
        // Validate success

        return context
    }

    private processVariables(inputVars: any, context: TemplateExecutionContext): void{
        // Process variables
        context.vars = inputVars || {}

        // Merge user provided variables with template variables with default values
        const defaults: any = {}
        this.variables.filter(v => v.defaultValue !== undefined)
            .forEach(v => {
                defaults[v.name] = v.defaultValue
            })
        _.defaults(context.vars, defaults)

        // eslint-disable-next-line no-warning-comments
        // TODO: Evaluate any templatized variables

        // Perform template variable validation with computed variables values
        const verificationFailures = this.variables.filter(v => v.required && context.vars[v.name] === undefined)
            .map(v => v.name)

        if (verificationFailures.length > 0) {
            throw new Error(`The following required variables were not provided: ${verificationFailures.join(',')}`)
        }
    }

    private async executeTemplateSteps(context: TemplateExecutionContext) : Promise<void> {
        // Execute steps
        for (const step of this.steps) {
            console.log(`Executing step '${step.name}'`)
            await step.run(context)
        }
    }
}
