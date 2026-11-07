# Third-party notices

The plugin's own code and original artwork are copyright © 2026 DtieR, MIT.
Dependencies keep their own licenses; MIT does not relicense them.

**AstraPlugins — a Minice project — https://minice.ai**

The unmodified astra-plugin-sdk 0.7.3 is distributed under MPL-2.0.
Its source is available at https://github.com/mihailinl/AstraPlugins/tree/master/astra-plugin-sdk-ts and as the pinned npm package astra-plugin-sdk@0.7.3.
Its original NOTICE is reproduced in the complete license text below, including historical references to other repository licenses.

| Component | Version | Declared license |
|---|---|---|
| @grpc/grpc-js | 1.14.7 | Apache-2.0 |
| @grpc/proto-loader | 0.7.0 | Apache-2.0 |
| @js-sdsl/ordered-map | 4.4.2 | MIT |
| @protobufjs/aspromise | 1.1.2 | BSD-3-Clause |
| @protobufjs/base64 | 1.1.2 | BSD-3-Clause |
| @protobufjs/codegen | 2.0.5 | BSD-3-Clause |
| @protobufjs/eventemitter | 1.1.1 | BSD-3-Clause |
| @protobufjs/fetch | 1.1.1 | BSD-3-Clause |
| @protobufjs/float | 1.0.2 | BSD-3-Clause |
| @protobufjs/path | 1.1.2 | BSD-3-Clause |
| @protobufjs/pool | 1.1.0 | BSD-3-Clause |
| @protobufjs/utf8 | 1.1.2 | BSD-3-Clause |
| @types/long | 4.0.2 | MIT |
| @types/node | 26.6.6 | MIT |
| ansi-regex | 5.0.1 | MIT |
| ansi-styles | 4.3.0 | MIT |
| astra-plugin-sdk | 0.7.3 | MPL-2.0 |
| cliui | 7.0.4 | ISC |
| color-convert | 2.0.1 | MIT |
| color-name | 1.1.4 | MIT |
| emoji-regex | 8.0.0 | MIT |
| escalade | 3.2.0 | MIT |
| get-caller-file | 2.0.5 | ISC |
| is-fullwidth-code-point | 3.0.0 | MIT |
| lodash.camelcase | 4.3.0 | MIT |
| long | 4.0.0 | Apache-2.0 |
| protobufjs | 7.6.6 | BSD-3-Clause |
| require-directory | 2.1.1 | MIT |
| string-width | 4.2.3 | MIT |
| strip-ansi | 6.0.1 | MIT |
| undici-types | 8.9.0 | MIT |
| wrap-ansi | 7.0.0 | MIT |
| y18n | 5.0.8 | ISC |
| yargs | 16.2.2 | MIT |
| yargs-parser | 20.2.9 | ISC |

Complete license and notice texts: [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).

## Bundled Node.js runtime

Node.js 24.22.2 for Windows x64 is redistributed unmodified from the official Node.js release.
It is licensed under MIT with additional third-party terms for compiled-in components.
The complete upstream notice is included in [NODE-LICENSE.txt](NODE-LICENSE.txt).
Binary source: https://nodejs.org/dist/v24.22.2/win-x64/node.exe
SHA-256: `1c331340fa6cac5e4294725959070a143fa0507195a78ad77eed7943f719aac9`.
Source code: https://github.com/nodejs/node/tree/v24.22.2
The pinned download metadata is also included in `dist/runtime/runtime.json`.
Nothing is downloaded or installed at plugin startup, and no system Node.js installation is changed.

Build-only tools (.NET SDK and reference assemblies, esbuild, Playwright, Bun) are not redistributed as plugin runtimes. The native helper is built from this repository's C# source and uses the Windows .NET Framework 4.8 runtime.

Wallpaper Engine, Steam, Astra and Minice are names of their respective owners. This independent integration is not an official product or endorsement. No wallpaper files or proprietary Astra source are bundled.
