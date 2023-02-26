import net from 'net';
import Client from './server/client';

import fs from 'fs';
import path from 'path';

import { Package } from './server/package';

const env = process.env.NODE_ENV || 'production';
process.env.NODE_ENV = env;

console.log("NODE_ENV:", env);

const production = env == "production" && false;
(global as any).production = production;

const this_path = path.dirname(process.argv[1]);

const packages = {
    "moonwalker": { ...JSON.parse(fs.readFileSync(`${this_path}/scripts/pkg/moonwalker/pkg.json`).toString()), ...{ path: path.resolve(`${this_path}/scripts/pkg/moonwalker`) } } as Package,
    "skillsystem": { ...JSON.parse(fs.readFileSync(`${this_path}/scripts/pkg/skillsystem/pkg.json`).toString()), ...{ path: path.resolve(`${this_path}/scripts/pkg/skillsystem`) } } as Package,
    //"moonwalker": JSON.parse(fs.readFileSync(`../scripts/pkg/moonwalker/pkg.json`).toString()) as Package
}
const scripts_root = path.resolve(path.join(this_path, 'scripts'))

import(path.join(scripts_root, 'alive' + path.extname(process.argv[1]))).then(dynamicok => {
    console.log("==> Dynamic import enabled: %o", dynamicok.default.default)
    if (!dynamicok) {
        throw new Error("Unable to load dynamic script.")
    }

    const server = net.createServer(socket => {
        new Client(scripts_root, server, socket, packages);
    });


    server.listen(6060, '127.0.0.1');

    console.log(Object.keys(packages))
})
