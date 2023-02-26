import Client from "../../../server/client";
import { PolObject, SerializeMethod } from "../scripting/polobject";
import { UOObject } from "./uoobject";

export class Character extends UOObject {

    get_seralize_signature(): string {
        return Character.serialize_signature;
    }
    static readonly serialize_signature = "mr"

    async sys_message(text: string) {
        return await Client.last.send_command("SendSysMessageUC", this, text, "ENU", 3, 0x3B2)
    }
    async name(): Promise<string> {
        return Client.last.query_obj_info(this, 'name')
    }
}

PolObject.register_object(Character.serialize_signature, (serialized_data: string) => {
    return new Character(parseInt(serialized_data.substring(2), 10))
})
