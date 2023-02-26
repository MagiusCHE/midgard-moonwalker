import net from 'net';
import { PolResponseCommand, PolResponse, PolResponseState } from './pol_response';
import path from 'path';
import fs from 'fs';
import { Package } from './package';
import { Script } from '../scripts/core/scripting/script';
import { PolObject, SerializeMethod } from '../scripts/core/scripting/polobject';

import '../scripts/core/uoobjects/character';
import { Character } from '../scripts/core/uoobjects/character';

enum State {
    WaitForResponse
}

export default class Client {

    private state: State = State.WaitForResponse
    private responses: PolResponse[] = [];
    private uncomplete_response?: PolResponse;
    private last_received_data_ts: Date;
    private readonly scripts_extensions: string;
    private query_id = 0

    static last: Client;
    //private ping_timer: NodeJS.Timer
    constructor(private readonly scripts_root: string, private readonly server: net.Server, private readonly socket: net.Socket, private readonly packages: { [key: string]: Package }) {
        this.last_received_data_ts = new Date()
        this.scripts_extensions = path.extname(process.argv[1])
        Client.last = this;
        socket.on('data', data => {
            //console.log("Received data " + data)
            this.last_received_data_ts = new Date()
            this.handle_received_data(data)
            //socket.destroy(); // kill client after server's response
        });

        socket.on('close', () => {
            console.log('Connection closed');
        });

        /*this.ping_timer = setInterval(() => {
            if ((new Date().getTime() - this.last_received_data_ts.getTime()) > 50000) {                
                this.send_ping();
            }
        }, 1000)*/
    }

    private handle_received_data(data: Buffer) {
        if (this.state == State.WaitForResponse) {
            this.add_response_data(data.toString())
            //console.log('Received: ' + data);
        }
        //socket.write("OK\n")
    }
    private add_response_data(data: string) {
        if (!this.uncomplete_response) {
            this.uncomplete_response = new PolResponse()
        }
        //console.log("[%o/%o] add_response_data %o", this.uncomplete_response.command_name, this.uncomplete_response.state_name, data)
        const datarest = this.uncomplete_response.append_data(data)
        if (this.uncomplete_response.state == PolResponseState.CommandReceived && this.uncomplete_response.command == PolResponseCommand.Ping) {

            this.send_pong()
            this.uncomplete_response = undefined
        } else if (this.uncomplete_response.state == PolResponseState.ArgsReceived) {
            console.log("Complete command received %o", this.uncomplete_response.command_name, this.uncomplete_response.arguments)
            if (this.uncomplete_response.command != PolResponseCommand.Unset) {
                this.responses.push(this.uncomplete_response)
                this.resolve_responses()
            }
            this.uncomplete_response = undefined
        } else if (this.uncomplete_response.state == PolResponseState.Error) {
            throw new Error(`Invalid command received "${data}".`)
        }
        if (datarest) {
            if (datarest.length > 0)
                this.add_response_data(datarest)
        }
    }
    private resolve_responses() {
        if (this.responses.length == 0)
            return
        const response = this.responses.shift()!
        const name = response.command_name;
        console.log("Invoke method: %o(%o)", "handle_" + name, response.arguments || []);
        try {
            (this as any)["handle_" + name]?.(...(response.arguments || []));
        } catch (err) {
            console.log(err)
            this.send_error(`Error while handle \"${name}\".`)
        }

    }
    private async handle_DoRet(doretid: number, _arguments: any) {

        console.log("Handle doret %o with args %o", doretid, _arguments)
        this.dorets[doretid] = {
            result: _arguments
        }

    }
    private async handle_Exec(script_pid: number, scriptpath: string, _arguments: any) {
        //this.socket.write("Welcome\n")
        console.log("Handle script %o execution %o (%o)", script_pid, scriptpath, _arguments)

        try {
            if (scriptpath.startsWith(':')) {
                const parts = scriptpath.split(':')
                const pkgname = parts[1]
                if (!this.packages[pkgname])
                    throw new Error(`Missing package "${pkgname}"`)

                scriptpath = path.resolve(path.join(this.packages[pkgname].path, parts[2]))
            } else {
                scriptpath = path.resolve(path.join(this.scripts_root, scriptpath))
            }
            if (scriptpath.endsWith('.ecl'))
                scriptpath = scriptpath.substring(0, scriptpath.length - 4)
            //scriptpath += ".ts"
            if (scriptpath.length <= this.scripts_root.length || !scriptpath.startsWith(this.scripts_root)) {
                console.error(" - To execute script path:    %o", scriptpath)
                console.error(" - Domanin scripts execution: %o", this.scripts_root)
                throw new Error(`Cannot access at invalid script path "${scriptpath}".`)
            }
            scriptpath += this.scripts_extensions
            if (!fs.existsSync(scriptpath))
                throw new Error(`Missing script file "${scriptpath}"`)
            const scriptclass = (await import(scriptpath)).default.default
            const script = new scriptclass(this) as Script;

            let ret
            let handled = true
            try {
                ret = await script.program(this.deserialize_polobjects(_arguments));
            } catch (err: any) {
                handled = !UnhandledScriptError.is(err)
            }
            this.send_result(script_pid, ret, handled)
        }
        catch (err) {
            console.log(err)
            this.send_error(`Error while executing script \"${scriptpath}\".`)
        }
    }
    private send_result(script_pid: number, result: any, handled: boolean = true) {
        //console.log("Send result: %o", result)
        try {
            const finalresult = [
                script_pid,
                handled ? 1 : 0, //Handled                
                this.serialize_polobjects(result, SerializeMethod.StringIncludeSignature)
            ]
            this.socket?.write("ret\n")
            console.log("Returning args:", finalresult)
            this.socket?.write(JSON.stringify(finalresult))
            this.socket?.write('\n')
            this.last_received_data_ts = new Date()
        } catch (err: any) {
            console.error(err)
            try {
                this.send_error(err.message)
            } catch (e2) {

            }

            this.socket.end()
            this.socket.destroy()
        }
    }

    private send_error(message: string) {
        try {
            const finalresult = [
                message
            ]
            this.socket?.write("err\n")
            this.socket?.write(JSON.stringify(finalresult))
            this.socket?.write('\n')
            this.last_received_data_ts = new Date()
        } catch (err) {
            console.error(err)
            this.socket.end()
            this.socket.destroy()
        }
    }

    private send_pong() {
        try {
            this.socket?.write("pong\n")
            this.last_received_data_ts = new Date()
        } catch (err: any) {
            console.error(err)
            try {
                this.send_error(err.message)
            } catch (e2) {

            }
            this.socket.end()
            this.socket.destroy()
        }
    }

    private dorets: { [kay: number]: any } = {}

    async send_command(name: string, ...args: any[]): Promise<any> {
        try {
            const quid = ++this.query_id
            const pack = [
                quid,
                name,
                this.serialize_polobjects(args, SerializeMethod.StringWithoutSignature)
            ]
            console.log("Send comman %o with args %o", "do", pack)
            this.socket?.write("do\n")
            this.socket?.write(JSON.stringify(pack))
            this.socket?.write('\n')
            this.last_received_data_ts = new Date()

            console.log("Waiting for %o", quid)
            const ret = await this.wait_for(() => {
                const ret = this.dorets[quid]
                if (ret !== undefined) {
                    delete this.dorets[quid]
                    return ret.result
                }
            })



            return this.deserialize_polobjects(ret)
        } catch (err: any) {
            console.error(err)
            try {
                this.send_error(err.message)
            } catch (e2) {
            }
            this.socket.end()
            this.socket.destroy()
        }
    }
    async query_obj_info(obj: any, member: string) : Promise<any> {
        try {
            const quid = ++this.query_id
            const pack = [
                quid,
                this.serialize_polobjects(obj, SerializeMethod.StringIncludeSignature),
                member
            ]
            console.log("Send comman %o with args %o", "qry", pack)
            this.socket?.write("qry\n")
            this.socket?.write(JSON.stringify(pack))
            this.socket?.write('\n')
            this.last_received_data_ts = new Date()

            console.log("Waiting for %o", quid)
            const ret = await this.wait_for(() => {
                const ret = this.dorets[quid]
                if (ret !== undefined) {
                    delete this.dorets[quid]
                    return ret.result
                }
            })

            return this.deserialize_polobjects(ret)
        } catch (err: any) {
            console.error(err)
            try {
                this.send_error(err.message)
            } catch (e2) {
            }
            this.socket.end()
            this.socket.destroy()
        }
    }
    deserialize_polobjects(arg: any): any {
        if (arg === null || arg === undefined)
            return
        if (typeof arg == "string") {
            if (arg.startsWith("@")) { //is pol object
                return PolObject.deserialize(arg.substring(1))
            } else if (arg.startsWith("€")) { //is pol object
                throw new Error(arg.substring(1))
            } else if (arg.startsWith("$")) { //is a string
                return arg.substring(1)
            } else if (arg.startsWith("#")) { //is a number
                if (arg.indexOf(',') > -1) // float?
                    return parseFloat(arg.substring(1))
                else
                    return parseInt(arg.substring(1), 10)
            } else {
                throw new Error(`Cannot deserialize "${arg}". Unsupported string sub-type "${arg.substring(0, 1)}".`)
            }
        } else if (Array.isArray(arg)) {
            return arg.map(a => this.deserialize_polobjects(a))
        } else {
            throw new Error(`Cannot deserialize "${arg}". Unsupported type "${typeof arg}".`)
        }
    }
    serialize_polobjects(args: any, serialize_method: SerializeMethod): any {
        if (args === undefined)
            return
        if (Array.isArray(args)) {
            const new_args = []
            //console.log("Serialize object: %o", args)
            for (const arg of args) {
                new_args.push(this.serialize_polobjects(arg, serialize_method))
            }
            return new_args
        }

        if (PolObject.is(args)) {
            return (serialize_method == SerializeMethod.StringIncludeSignature? "@" : "") + args.serialize(serialize_method)
        } else {
            return args
        }

    }

    async wait(ms: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, ms);
        })
    }
    async wait_for(check: () => boolean): Promise<any> {
        //console.log("Begin waitfor")
        return new Promise<any>(async (resolve, reject) => {
            while (this.socket?.closed === false) {
                const ret = check()
                if (ret !== undefined) {
                    //console.log("Check returns %o",ret)
                    resolve(ret)
                    return
                }
                //console.log("Wait 1s")
                await this.wait(1)
            }
            reject("wait_for exits due to client socket disconnected")
        })
    }
}

export class UnhandledScriptError extends Error {
    public readonly Unhandled = 1
    static is(obj: any): obj is UnhandledScriptError {
        return obj?.Unhandled == 1
    }
}