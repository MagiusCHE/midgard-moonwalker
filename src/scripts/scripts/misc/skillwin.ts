import { UnhandledScriptError } from "../../../server/client";
import { Character } from "../../core/uoobjects/character";
import { Script } from "../../core/scripting/script";
import { Gump } from "../../core/scripting/gump";

export default class program extends Script {
    async program(args: any) {
        return (this as any).execute(...args)
    }
    private async execute(towhom: Character, forwhom: Character) {
        //console.log("Invoked skillwin with %o , %o", towhom, forwhom)
        //throw new UnhandledScriptError();
        //await towhom.sys_message("Testme " + (await towhom.name()))
        //return this.client.send_command("sendskillwindow", towhom, forwhom)

        //const gump = Gump.create_raw(layout, data)

        const gump = Gump.create(50, 30);
        gump.id = 1000;

        gump.root.add_resize_pic(2620, 0, 0, 609, 412);
        gump.root.add_resize_pic(2620, 0, 0, 609, 412);
        gump.root.add_resize_pic(2620, 0, 0, 609, 412);
        gump.root.add_checker_trans(0, 0, 1, 1)
        gump.root.add_gump_pic(5599, 210, 10)

        let y = 25;
        let size = 75;
        gump.root.add_gump_pic(5578, 20, y); y += size;
        gump.root.add_gump_pic(5570, 20, y); y += size;
        gump.root.add_gump_pic(5564, 20, y); y += size;
        gump.root.add_gump_pic(5552, 20, y); y += size;
        gump.root.add_gump_pic(5546, 20, y); y += size;

        y = 45;
        size = 75;
        gump.root.add_text("Warrior", 90, y, 40); y += size;
        gump.root.add_text("Mage", 90, y, 90); y += size;
        gump.root.add_text("Cleric", 90, y, 5); y += size;
        gump.root.add_text("Archer", 90, y, 45); y += size;
        gump.root.add_text("Other", 90, y, 100); y += size;

        return gump.send_to(towhom)
    }
}