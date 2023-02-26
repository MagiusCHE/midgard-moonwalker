import { Script } from "../../core/scripting/script";

export default class Start extends Script {
    async program(args: any): Promise<any> {
        console.log("Start invoked!")
        const ret = await this.client.send_command("polcore", "verstr")
        console.log("Start completed with version %o",ret)
        return "OK " + ret
    }
}
