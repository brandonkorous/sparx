# Azure bootstrap

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

The one thing applied from a laptop. Everything else runs in GitHub Actions.

## Why this exists

Actions cannot run Terraform against Azure until something has created a remote
state backend (a CI runner is ephemeral — local state cannot be shared between
runs) and an identity for it to authenticate as. Neither can be created by the
pipeline that depends on them, so one manual apply is irreducible.

After this, running `az` or `kubectl` against the platform by hand — for anything
other than **reading** state — is a gap in the automation, not a workflow.

## What it creates

| Resource                             | Purpose                                                                                            | Cost   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ------ |
| `rg-sparx-prod-cus-tfstate`          | Holds state, separate from the workload                                                            | $0     |
| `stsparxprodcustfstate`              | Terraform state, versioned, 30-day soft delete                                                     | <$1/mo |
| App registration + service principal | The identity Actions assumes                                                                       | $0     |
| 3 federated credentials              | OIDC trust for main / pull_request / environment                                                   | $0     |
| 5 role assignments                   | Contributor, Blob Data Contributor, AKS User + RBAC Admin, plus blob access for the human operator | $0     |

The state resource group is deliberately separate from `rg-sparx-prod-cus`, so a
`terraform destroy` of the workload can never take the state describing it.

## No stored credentials

Authentication is **OIDC / workload identity federation**, not a client secret.
GitHub mints a short-lived token per run; Entra trusts it for a specific
repository and ref. Nothing secret is stored in GitHub — the three values the
workflows need are ids, not credentials.

Entra matches the credential `subject` **exactly** — no wildcards. That is the
security property: a fork's pull-request run executes under a different subject
and cannot assume this identity.

## Apply

```bash
cd terraform/bootstrap-azure
terraform init
terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
```

Needs permission to create an App Registration in **Entra ID** — a tenant-level
permission, separate from subscription RBAC. An authorization failure on
`azuread_application` means that is missing.

Then wire up the repository:

```bash
terraform output -raw gh_cli_commands   # copy-paste ready
```

## Then move the workload to remote state

`terraform/envs/azure` currently uses a local backend. Once this exists, add to
its `providers.tf`:

```hcl
backend "azurerm" {
  resource_group_name  = "rg-sparx-prod-cus-tfstate"
  storage_account_name = "stsparxprodcustfstate"
  container_name       = "tfstate"
  key                  = "envs/azure.tfstate"
}
```

then `terraform init -migrate-state`. Get the exact values from
`terraform output backend_config`.

**Do this before any Actions workflow runs Terraform** — a workflow against local
state would see an empty state and try to recreate the cluster and database that
already exist.

## Note on permissions

`Contributor` is granted at **subscription** scope because
`terraform/envs/azure` creates its own resource group and AKS creates a second
one for nodes — a group-scoped assignment could do neither. Contributor cannot
grant roles, so this identity cannot escalate its own privileges.

`Storage Blob Data Contributor` is separate and easy to miss: Contributor grants
control-plane rights over the storage _account_ but not access to the _data_ in
it. Without it, `terraform init` fails — before plan, with an unhelpful error.
