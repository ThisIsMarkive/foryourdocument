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
