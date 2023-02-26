import Client from "../../../server/client";

export type DeserializeHandler = (serialized_data: string) => PolObject

export enum SerializeMethod {
    StringIncludeSignature,
    StringWithoutSignature
}

export abstract class PolObject {
    static is(obj: any): obj is PolObject {
        return (obj instanceof PolObject)
    }
    
    abstract serialize(method: SerializeMethod): string
    private static registerd_types: {
        [key: string]: DeserializeHandler
    } = {}
    
    static register_object(sig: string, deserialize: DeserializeHandler) {
        console.log("Register deserialization method %o", sig)
        if (sig.length != 2) {
            throw new Error("Signature must be 2 characters long")
        }
        this.registerd_types[sig] = deserialize
    } 
    
    static deserialize(serialized_data: string): PolObject | any {
        const deserialize = this.registerd_types[serialized_data.substring(0, 2)]
        if (!deserialize) {
            console.error(this.registerd_types)
            throw new Error(`Unsupported deserialization for data: ${serialized_data}`)
        }
        return deserialize(serialized_data)
    }
}