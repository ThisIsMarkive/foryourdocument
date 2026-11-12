# Third-party notices

hwpx-bridge combines two independent open-source projects. Neither project endorses this package.

| Component | How it is used | License |
| --- | --- | --- |
| [kordoc](https://github.com/chrisryugj/kordoc) by chrisryugj | npm dependency `kordoc`, run unmodified as an MCP server | MIT |
| [Filee](https://github.com/KnifeLemon/Filee) by Myeonggu Kim (KnifeLemon) and contributors | Command-line converter from the official release archive, unmodified, in `hwpx-bridge-filee-<platform>` | MIT (`filee/LICENSE-Filee.txt` in each platform package) |
| [rhwp](https://github.com/edwardkim/rhwp) | Bundled by Filee for HWP/HWPX rendering (`filee/engines/rhwp`) | MIT |
| [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) | npm dependency | MIT |

The Filee platform packages also contain the .NET runtime and libraries listed in Filee's own
`THIRD-PARTY-NOTICES.md` (shipped in the Linux package; the same components are used on Windows).

Full upstream MIT notices are also kept under `plugins/hwpx-bridge/notices/`. kordoc downloads its OCR and formula
models itself on first use; their licenses are listed in kordoc's `NOTICE` and `THIRD_PARTY` files (note
`THIRD_PARTY/pix2text.txt` about the formula-detection weights). Copyright: Filee 2026 Myeonggu Kim (KnifeLemon) and
Filee contributors; kordoc 2026 chrisryugj.
