@RTK.md

This application source belongs exclusively to branch `aws/clf_c02` for AWS
Certified Cloud Practitioner CLF-C02. Make application changes and builds on
that branch. `main` is a documentation-only branch containing `readme.md`;
do not merge the application tree into `main`.

Work only inside this repository. Course content, SQLite databases, toolchains,
build outputs and caches must stay ignored. Never bundle files/ into the app.

This repository uses CodeGraph. Before locating or changing code, start with
`rtk proxy codegraph explore '<symbols or question>'`; run `codegraph sync`
after changes. Keep `.codegraph/` local.

Rust domain logic belongs in src/application/, src/domain/, src/infrastructure/ and src/media/. The WebView
host owns process lifecycle and asset scope; it must not move database/video
decoding into the core. UI modules stay in ui/features/ and ui/shared/; avoid framework/runtime
dependencies without measuring the resulting size and memory.

Validation: `cargo fmt --all -- --check`, `cargo test --no-default-features
--locked`, `cargo clippy --all-targets -- -D warnings`, `npm test`. For the
project-local Rust install, source scripts/development/env.sh from the repository root.

Budgets: core backend <=20,000,000 bytes RSS; WebView host plus renderer/GPU
processes <=750,000,000 bytes RSS; complete distributed app <20,000,000 bytes.
Report OS, workload and sampling scope; never call a local measurement a
universal guarantee. The GUI host itself is also Rust/Tauri and is counted in
the WebView group, not in the headless backend budget.

Commit messages use English Conventional Commits, one line, no scope/body.
`npm ci` installs the local commitlint commit-msg hook.
