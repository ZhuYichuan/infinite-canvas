// Ambient declarations for globals that Bun provides natively but tsc doesn't know about.
// Keep this minimal — only what we use.

declare const Bun: {
    file(path: string): {
        text(): Promise<string>;
        arrayBuffer(): Promise<ArrayBuffer>;
    };
    stdin: {
        text(): Promise<string>;
    };
    write(path: string, data: Blob | ArrayBuffer | Uint8Array | string): Promise<number>;
};

declare const process: {
    env: { [key: string]: string | undefined };
    argv: string[];
    exit(code?: number): never;
};