import Client from "../../../server/client";

export abstract class Script {
    constructor(protected readonly client: Client) {
        
    }
    abstract program(args: any): any
}

