import { File } from '../../util/filesystem'
import { Harness, HarnessApiOptions } from '../harness/harness-api-client'
import { StorageType, StorageProviderRef, StorageProvider } from './storage-provider'
import * as glob from 'minimatch'
import { ConfigAsCodeFile } from '../harness/config-as-code'
import * as _ from 'lodash'

export class HarnessStorageProvider implements StorageProvider {
    protected harness!: Harness

    type: StorageType
    initialized: boolean
    options: HarnessApiOptions
    files: ConfigAsCodeFile[]

    constructor(options: HarnessApiOptions) {
        this.options = options
        this.type = StorageType.Harness
        this.initialized = false
        this.files = []
    }

    getType(): StorageType {
        return this.type
    }

    async init(): Promise<boolean> {
        this.harness = new Harness(this.options) 
        await this.harness.init()
        this.files = await this.harness.configAsCode.getTree()
        this.initialized = true
        return true
    }

    getConfig(): unknown {
        return this.options
    }

    test(): Promise<void> {
        throw new Error('Method not implemented.')
    }

    listFiles(pattern?: string | undefined): Promise<[string, number][]> {
        return Promise.resolve(this.files
            .filter(f => glob(f.path, pattern || ''))
            .map(f => [f.path, 0]))
    }

    fileExists(name: string): Promise<boolean> {
        return Promise.resolve(this.files.filter(f => name === f.path).length > 0)
    }

    async getFile(name: string): Promise<File> {
        const file = _.find(this.files, f => f.path === name)
        if (file) {
            const content = await this.harness?.configAsCode.getFileContent(file)
            return content
        } 

        throw new Error('File not found')
    }
    async getFiles(pattern: string): Promise<File[]> {
        const files = this.files.filter(f => glob(f.path, pattern || ''))
        const result: File[] = []
        for (const file of files) {
            result.push(await this.getFile(file.path))
        }
        return result
    }

    async storeFile(file: File): Promise<void> {
        await this.storeFiles([file])
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deleteFile(name: string): Promise<void> {
        throw new Error('Method not implemented.')
    }

    static createRef(opts: HarnessApiOptions): StorageProviderRef {
        return {
            sourceType: StorageType.Harness,
            opts: opts,
        }
    }

    async storeFiles(files: File[]): Promise<void> {
        await this.harness?.configAsCode.uploadConfigAsCode(files)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async deleteFiles(pattern: string): Promise<void> {
        throw new Error('Not implemented')
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async dispose(): Promise<void> {
    }
}
