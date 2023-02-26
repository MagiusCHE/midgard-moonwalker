export function enum_name(_enum: any, kind: any) {
    if (!_enum)
        throw new Error(`Invalid Enum type passed. It is null or indefined.`)
    return Object.entries(_enum!).find(e => e?.[1] == kind)?.[0]
}

export function enum_by_uname<T>(_enum: T, name: string): T {
    if (!_enum)
        throw new Error(`Invalid Enum type passed. It is null or indefined.`)
    const entries = Object.entries(_enum!)
    let ret = entries.find(i => i[0].toLowerCase() == name)?.[1] 
    if (ret === undefined) {
        ret = entries[0]?.[1]
    }
    if (ret === undefined) {
        throw new Error(`Invalid Enum type passed. It must have one element.`)
    }
    return <T>ret;
}