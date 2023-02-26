import { enum_by_uname, enum_name } from "./utils"

export enum PolResponseCommand {
    Unset = 0,
    Exec,
    Ping,
    DoRet,
}

export enum PolResponseState {
    Uninitialized,
    CommandReceived,
    ArgsReceived,
    Error,
}

export class PolResponse {
    private _command = PolResponseCommand.Unset
    private lastcmd = ""
    private lastargs = ""
    private _state = PolResponseState.Uninitialized
    private _args?: any[];
    public append_data(data: string) {
        let remains
        if (this._state == PolResponseState.Uninitialized) {
            remains = this.add_to_command(data)
        } else if (this._state == PolResponseState.CommandReceived) {
            remains = this.add_to_args(data)
        }
        return remains
    }
    private add_to_args(data: string): any {
        const parts = data.replace(/\r/gm, '').split('\n')
        this.lastargs += parts.shift()
        if (parts.length == 0)
            return undefined
        
        if (this.lastargs?.length > 0) {
            try {
                this._args = JSON.parse(this.lastargs)
            } catch (err) {
                this._state = PolResponseState.Error
                throw new Error(`Unable to parse JSON data: ${this.lastargs}`)
            }
        } else {
            this._args = []
        }
        
        this._state = PolResponseState.ArgsReceived
        //console.log("Filled %o with args %o ", this.command_name, this._args)
        
        return parts.join('\n')
    }
    private add_to_command(data: string): string | undefined {
        const parts = data.replace(/\r/gm, '').split('\n')
        this.lastcmd += parts.shift()
        if (parts.length == 0)
            return undefined

        this._state = PolResponseState.CommandReceived
        let cmd_num = undefined
        const ucase_cmd = this.lastcmd.toLowerCase()
        for (const cmdname in PolResponseCommand) {
            if (cmdname.toLowerCase() == ucase_cmd)
                cmd_num = PolResponseCommand[cmdname]
        }
        //console.log("Fill command %o received => %o", this.lastcmd, enum_name(PolResponseCommand, cmd_num))
        if (cmd_num !== undefined && (cmd_num as unknown as PolResponseCommand) != PolResponseCommand.Unset) {
            //all ok!
            this._command = cmd_num as unknown as PolResponseCommand
            //console.log("Command %o received.", this.command_name)
        } else {
            this._state = PolResponseState.Error
            throw new Error(`Unsupported command: ${this.lastcmd}`)
        }
        return parts.join('\n')

    }
    public get command_name() {
        return enum_name(PolResponseCommand, this._command)
    }
    public get state_name() {
        return enum_name(PolResponseState, this._state)
    }
    public get command() {
        return this._command
    }
    public get state() {
        return this._state
    }
    public get arguments() {
        return this._args
    }
}

