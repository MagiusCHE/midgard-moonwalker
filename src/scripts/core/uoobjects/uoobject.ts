import Client from "../../../server/client";
import { PolObject, SerializeMethod } from "../scripting/polobject";

export abstract class UOObject extends PolObject {
    constructor(public readonly serial: number) {
        super()
    }
    abstract get_seralize_signature(): string;
    serialize(method: SerializeMethod): string {
        if (method == SerializeMethod.StringIncludeSignature)
            return this.get_seralize_signature() + this.serial
        else 
            return this.serial.toString()
    }

    abstract name(): Promise<string>
}

