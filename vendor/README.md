# vendor/

`dashkit-<version>.tgz` is the packed [dashkit](../../../dashkit) package (`npm pack`), committed so
fresh clones and deploys install it without the dashkit repo next to this one.
`package.json` depends on it as `"dashkit": "file:vendor/dashkit-<version>.tgz"` (0.4.0 at the time of writing).
To update it after a dashkit change, run `scripts/refresh-dashkit.sh` (set `DASHKIT_DIR` if dashkit
is not at `../../dashkit`). On a version bump the script installs the new tarball (which repoints
`package.json`); delete the old `dashkit-*.tgz`, then commit the tarball, `package.json` and `package-lock.json`.
