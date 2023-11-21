## jsDelivr-Purge

This GitHub actions is automatic jsDelivr purging process for GitHub public repositories.

If you want to purge jsDelivr cache automatically, please customize the following GitHub workflow file and add it:

```
name: 'Run jsDelivr-Purge'

permissions:
    actions: read
    contents: read

jobs:
    jsdelivrpurge:
        runs-on: ubuntu-latest
        steps:
            - name: Run jsDelivr-Purge
              uses: List-KR/jsdelivr-purge@5.0.0
```

The jsDelivr-Purge supports `workflow_dispatch`, `schedule` and `push` event.

It always purges `latest` and the default branch of your repo.

> **Warning**: jsDelivr will add authentication data into a request header.
You need to pay attention to this change!
