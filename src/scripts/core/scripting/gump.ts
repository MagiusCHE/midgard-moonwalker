/*
 * Copyright (c) 2023, Magius(CHE)
 *
 * This software is provided "as-is", without any express or implied warranty. In no event
 * will the authors be held liable for any damages arising from the use of this software.
 * Read the LICENSE file for more details.
 *
 * @author: Magius(CHE) - magiusche@magius.it
 */

import Client from "../../../server/client"
import { Character } from "../uoobjects/character"
import { PolObject, SerializeMethod } from "./polobject"

namespace ui {
    abstract class GumpElement {
        public z_index = 0
        public left: number = 0
        public top: number = 0
        public page: number = 0
        public parent?: GumpElement
        public root?: ui.Gump
        public readonly children: {
            [key: string]: GumpElement
        } = {}
        constructor(public readonly name: string) {

        }

        /**
         * Adds a background to the gump.
         * If the gump was sent using a custom gumpid, then the same gumpid must be used here.
         * If the gump was sent without specifying a gumpid, then use the sender script's pid.
         * 
         * @param {number} gump_id - Graphical id decimal number representing the gump
         * @param {number} left - Position of the left-top corner relative to gump position 
         * @param {number} top - Position of the left-top corner relative to gump position
         * @param {number} width - The width (pixels) of the gump from position left.
         * @param {number} height - The height (pixels) of how far to scale the gump downwards from position top.
         * @param {string} name - A unique name for this element. If not passed a default unique one is created
         * @returns {GumpElement} the added element if success or undefined on error
         */
        add_resize_pic(gump_id: number, left: number, top: number, width: number, height: number, name?: string): GumpElement | undefined {
            if (!name)
                name = `${this.name}/resizepic[${Object.keys(this.children).length}](${gump_id})` 
            if (this.children[name])
                return

            const elem = new ui.ResizePic(name, gump_id, left, top, width, height)
            elem.page = this.root?.get_current_page() || 0
            this.add_element(elem)

            return elem
        }
        add_checker_trans(left: number, top: number, width: number, height: number, name?: string): GumpElement | undefined {
            if (!name)
                name = `${this.name}/checkertrans[${Object.keys(this.children).length}](${left},${top})` 
            if (this.children[name])
                return

            const elem = new ui.CheckerTrans(name, left, top, width, height)
            elem.page = this.root?.get_current_page() || 0
            this.add_element(elem)

            return elem
        }
        add_gump_pic(gump_id: number, left: number, top: number, name?: string): GumpElement | undefined {
            if (!name)
                name = `${this.name}/gumppic[${Object.keys(this.children).length}](${gump_id},${left},${top})` 
            if (this.children[name])
                return

            const elem = new ui.GumpPic(name, gump_id, left, top)
            elem.page = this.root?.get_current_page() || 0
            this.add_element(elem)

            return elem
        }
        add_text(text: string, left: number, top: number, color: number, name?: string): GumpElement | undefined {
            if (!name)
                name = `${this.name}/text[${Object.keys(this.children).length}](${text},${left},${top})` 

            if (this.children[name])
                return

            const elem = new ui.Text(name, text, left, top, color)
            elem.page = this.root?.get_current_page() || 0
            this.add_element(elem)

            return elem
        }
        public add_element(elem: GumpElement) {
            if (this.children[elem.name])
                return
            elem.z_index = this.z_index
            this.children[elem.name] = elem
            elem.parent = this
        }

        public abstract layout_to(buffer: string[], context: GumpContext): void
        public abstract data_to(buffer: string[], context: GumpContext): void

        public abs_x(relativex: number): number {
            let parent = this.parent;
            while (parent) {
                relativex += parent.left;
                parent = parent.parent
            }
            return relativex
        }
        public abs_y(relativey: number): number {
            let parent = this.parent;
            while (parent) {
                relativey += parent.top;
                parent = parent.parent
            }
            return relativey
        }
    }


    export class Gump extends PolObject {

        public readonly root: GumpRoot;
        public moveable = true
        public closeable = true
        public disposable = true

        private flags = 0

        private receiver?: Character = undefined

        // Starting points for data values
        private data_id = 1

        // Current page the gump is writing to
        private cur_page = 0
        constructor(public id = 0) {
            super()
            this.root = new GumpRoot();
        }

        public get_current_page() {
            return this.cur_page
        }

        public serialize(method: SerializeMethod): string {
            throw new Error("NotSupported")
        }

        private compiled?: {
            layout: string[],
            data: string[]
        }
        static create_raw(layout: string[], data: string[], gumpid?: number): Gump {
            const gump = new Gump(gumpid)
            gump.compiled = {
                layout,
                data
            }
            return gump
        }

        protected add_element(elem: GumpElement) {
            this.root.add_element(elem)
            this.compiled = undefined
        }

        /**
         * Sends a generic gump window to "who" and waits for the user's input.
         * If no gumpid is given, the script's pid will be sent as gumpid.
         * Notes: "layout" is an array of strings with each string a gump layout directive.
         *  "textlines" is an array of strings with text that is displayed on the gump.
         *  "Layout" references this array in a 0-based manner.
         * Based on clientversion core will send compressed or uncompressed version
         * 
         * @param {Character} who - Character will receive the gump
         * @returns {boolean} true if success
         * @reference https://docs.polserver.com/pol100/fullfunc.php?xmlfile=uoem#SendDialogGump
         */
        async send_to(who: Character): Promise<boolean> {
            if (this.receiver) {
                console.error(`Cannot send gump ${this.id} to ${who.name}. It is already sent to ${this.receiver.name}. Use Gump.close() first.`)
                return false
            }

            if (!this.compiled) {
                //Compile layout and datas!
                this.compiled = {
                    layout: [],
                    data: []
                }
                const context: GumpContext = {
                    data_idx: 0
                }
                for (const elem of Object.values(this.root.children)) {
                    elem.layout_to(this.compiled.layout, context);
                    elem.data_to(this.compiled.data, context)
                }
                /*this.elements.forEach(e => {
                    layout.push(elem.get_layout())
                    data.push(elem.get_data())
                })*/
            }

            const ret = await Client.last.send_command("SendDialogGump", who, this.compiled!.layout, this.compiled!.data, this.root.left, this.root.top, this.flags, this.id)
            console.log("SendDialogGump returns:", ret)
            return true
        }

        /**
         * Closes the gump, returning 'response' to the script that called SendDialogGump().
         * If the gump was sent using a custom gumpid, then the same gumpid must be used here.
         * If the gump was sent without specifying a gumpid, then use the sender script's pid.
         * 
         * @param {UObject} args - what is going to be returned to the gump script
         * @returns {boolean} true if success
         * @reference https://docs.polserver.com/pol100/fullfunc.php?xmlfile=uoem#CloseGump
         */
        async close(args: any = 0): Promise<boolean> {
            /*Transpile default arguments value */
            if (!this.receiver)
                return false
            return Client.last.send_command("CloseGump", this.receiver, this.id, args);
        }

        static create(left: number = 0, top: number = 0): Gump {
            const gump = new Gump()
            gump.root.left = left
            gump.root.top = top
            return gump

        }

        public z_index = 0
    }

    class GumpRoot extends GumpElement {
        constructor() {
            super("root")
        }
        public layout_to(buffer: string[], context: GumpContext) {
            //ResizePic [x] [y] [gump-id] [width] [height]
            //buffer.push(`resizepic ${this.left} ${this.top} ${this.gump_id} ${this.width} ${this.height}`)
        }
        public data_to(_buffer: string[], context: GumpContext) {
            //throw new Error("Method not implemented.");
        }
    }

    // https://docs.polserver.com/pol100/guides.php?guidefile=gumpcmdlist#resizepic
    export class ResizePic extends GumpElement {
        constructor(name: string,
            public readonly gump_id: number = 0,
            left: number = 0,
            top: number = 0,
            public readonly width: number = 0,
            public readonly height: number = 0,
        ) {
            super(name)
            this.left = left
            this.top = top
        }

        public layout_to(buffer: string[], context: GumpContext) {
            //ResizePic [x] [y] [gump-id] [width] [height]
            buffer.push(`resizepic ${this.abs_x(this.left)} ${this.abs_y(this.top)} ${this.gump_id} ${this.width} ${this.height}`)
        }
        public data_to(_buffer: string[], context: GumpContext) {
            //throw new Error("Method not implemented.");
        }
    }

    // https://docs.polserver.com/pol100/guides.php?guidefile=gumpcmdlist#checkertrans
    export class CheckerTrans extends GumpElement {
        constructor(name: string,
            left: number = 0,
            top: number = 0,
            public readonly width: number = 0,
            public readonly height: number = 0,
        ) {
            super(name)
            this.left = left
            this.top = top
        }

        public layout_to(buffer: string[], context: GumpContext) {
            //ResizePic [x] [y] [gump-id] [width] [height]
            buffer.push(`checkertrans ${this.abs_x(this.left)} ${this.abs_y(this.top)} ${this.width} ${this.height}`)
        }
        public data_to(_buffer: string[], context: GumpContext) {
            //throw new Error("Method not implemented.");
        }
    }

    // https://docs.polserver.com/pol100/guides.php?guidefile=gumpcmdlist#gumppic
    export class GumpPic extends GumpElement {
        constructor(name: string,
            public readonly gump_id: number,
            left: number = 0,
            top: number = 0,
        ) {
            super(name)
            this.left = left
            this.top = top
        }

        public layout_to(buffer: string[], context: GumpContext) {
            //ResizePic [x] [y] [gump-id] [width] [height]
            buffer.push(`gumppic ${this.abs_x(this.left)} ${this.abs_y(this.top)} ${this.gump_id}`)
        }
        public data_to(_buffer: string[], context: GumpContext) {
            //throw new Error("Method not implemented.");
        }
    }

    // https://docs.polserver.com/pol100/guides.php?guidefile=gumpcmdlist#text
    export class Text extends GumpElement {
        constructor(name: string,
            public text: string,
            left: number = 0,
            top: number = 0,
            public color: number,
        ) {
            super(name)
            this.left = left
            this.top = top
        }

        public layout_to(buffer: string[], context: GumpContext) {
            buffer.push(`text ${this.abs_x(this.left)} ${this.abs_y(this.top)} ${this.color} ${context.data_idx}`)
        }
        public data_to(buffer: string[], context: GumpContext) {
            buffer.push(`${this.text}`)
            context.data_idx++
        }
    }

    type GumpContext = {
        data_idx: number
    }
}


export = ui