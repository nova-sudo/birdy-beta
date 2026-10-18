# vendor/

`dashkit-0.1.0.tgz` is the packed [dashkit](../../../dashkit) package (`npm pack`), committed so
fresh clones and deploys install it without the dashkit repo next to this one.
`package.json` depends on it as `"dashkit": "file:vendor/dashkit-0.1.0.tgz"`.
To update it after a dashkit change, run `scripts/refresh-dashkit.sh` (set `DASHKIT_DIR` if dashkit
is not at `../../dashkit`), then commit the tarball and `package-lock.json`.
