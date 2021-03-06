import { GraphQLClient } from '../../util/graphql-client'

export interface GitConnectorOptions {
    name: string, 
    url: string, 
    username: string, 
    passwordSecretId: string, 
    branch?: string
}

export class GitConnectors {
    protected client: GraphQLClient;
    private fields = `
    id
    name
    createdAt
    createdBy {
        email
    }
    
    ... on GitConnector {
        URL
        branch
        urlType
        userName
        passwordSecretId
        generateWebhookUrl
        webhookUrl

        customCommitDetails {
            authorEmailId
            authorName
            commitMessage
        }
    }
    `

    constructor(client: GraphQLClient) {
        this.client = client
    }

    async list() {
        const query = `
        query ($limit: Int!, $offset: Int) {
            result: connectors(limit: $limit, offset: $offset, filters: [{connectorType: {operator: EQUALS, values: [GIT]}}]) {
                pageInfo {
                    hasMore
                }
                nodes {
                    ${this.fields}
                }
            }
        }`

        const vars: any = {}

        const limit = 100
        let offset = 0
        let results: any[] = []
        let hasMore = true
        while (hasMore) {
            vars.limit = limit
            vars.offset = offset
            const result = await this.client.execute(query, vars)
            results = results.concat(result.data.result.nodes)
            hasMore = result.data.result.pageInfo.hasMore
            offset += limit
        }

        return results
    }

    async get(idOrName: string) {
        try {
            const byNameResult = await this.getByName(idOrName)
            return byNameResult
        } catch {
            try {
                const byIdResult = await this.getById(idOrName)
                return byIdResult
            } catch {
                throw new Error(`Git Connector not found with name or ID '${idOrName}'`)
            }
        }
    }

    private async getById(id: string) {
        const query = `
        query ($id: String!) {
            result: connector(connectorId: $id) {
                ${this.fields}
            }
        }`

        const vars = { id }

        const result = await this.client.execute(query, vars)
        return result.data.result
    }

    private async getByName(name: string) {
        const all = await this.list()
        const filtered = all.filter(c => c.name === name)
        if (filtered && filtered.length > 0) {
            return filtered[0]
        }
        throw new Error('Not found')
    } 

    async create(options: GitConnectorOptions) {
        const query = `
        mutation ($input: CreateConnectorInput!) {
            result: createConnector(input: $input) {
                resource: connector {
                    ${this.fields}
                }
            }
        }`

        const vars = { 
            input: {
                connectorType: 'GIT',
                gitConnector: {
                    urlType: 'REPO',
                    name: options.name,
                    generateWebhookUrl: true,
                    URL: options.url,
                    userName: options.username,
                    passwordSecretId: options.passwordSecretId,
                    branch: options.branch,
                },
            },
        }

        const result = await this.client.execute(query, vars)
        return result.data.result.resource
    }

    async update(idOrName: string, options: GitConnectorOptions) {
        const connector = await this.get(idOrName)
        const query = `
        mutation ($input: UpdateConnectorInput!) {
            result: updateConnector(input: $input) {
                resource: connector {
                    ${this.fields}
                }
            }
        }`

        const vars = { 
            input: {
                connectorId: connector.id,
                connectorType: 'GIT',
                gitConnector: {
                    urlType: 'REPO',
                    name: options.name,
                    generateWebhookUrl: true,
                    URL: options.url,
                    userName: options.username,
                    passwordSecretId: options.passwordSecretId,
                    branch: options.branch,
                },
            },
        }

        const result = await this.client.execute(query, vars)
        return result.data.result.resource
    }

    async delete(idOrName: string) {
        const connector = await this.get(idOrName)
        const query = `
        mutation ($input: DeleteConnectorInput!) {
            result: deleteConnector(input: $input) {     
                clientMutationId           
            }
        }`

        const vars = { 
            input: {
                connectorId: connector.id,
            },
        }

        await this.client.execute(query, vars)
    }
}
