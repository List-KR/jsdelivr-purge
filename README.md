## jsDelivr-Purge

This GitHub actions is automatic jsDelivr purging process for GitHub public repositories.

If you want to purge jsDelivr cache automatically, please customize the following GitHub workflow file and add it:

```yaml
name: 'Run jsDelivr-Purge'

jobs:
  jsdelivrpurge:
    permissions:
      actions: read
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Set up NodeJS LTS
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run jsDelivr-Purge
        uses: List-KR/jsdelivr-purge@5.3.0
```

The jsDelivr-Purge supports `workflow_dispatch`, `schedule` and `push` event.

It always purges `latest` and the default branch of your repo.

> [!WARNING]
> jsDelivr will add authentication data into a request header.
> You need to pay attention to this change!
