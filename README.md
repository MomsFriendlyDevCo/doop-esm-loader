@Doop/ESM-Loader
================
Doop single-file component (SFC) loader for Node.


Use with the Doop ESM loader
============================
1. Install the ESM loader into your main project :

```bash
npm i --save @doop/esm-loader
```



2. Modify your package.json file to add the following:

```json
{
  "mocha": {
    "node-option": [
      "loader=@doop/esm-loader",
      "no-warnings=ExperimentalWarning"
    ]
  }
}
```
