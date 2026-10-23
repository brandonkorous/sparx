# Azure bootstrap

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-22

The identities, the Terraform state backend, and every role grant the release
itself is not allowed to make. **The release applies it** (the `bootstrap` job
in `.github/workflows/release.yml`) on every commit to main. A laptop applies it
once per subscription, and never again.

## Why it is separate from `terraform/envs/azure`

`envs/azure` is applied by the release's `infrastructure` job, under an identity
with subscription **Contributor** and nothing more. Contributor cannot grant
roles and cannot create app registrations, which is what stops that pipeline
raising its own rights. Everything that needs those two powers lives here.

This module is applied by a **second** identity (`ci.tf`), which only the
`bootstrap` job can assume:

| Right                                    | Why                                                        |
| ---------------------------------------- | ---------------------------------------------------------- |
| Contributor (subscription)               | resource groups, the state account, the sparx vault        |
| Storage Blob Data Contributor (tfstate)  | its own state                                              |
| RBAC Administrator, **with a condition** | grant and remove only the roles in `local.bootstrap_roles` |
| Graph `Application.ReadWrite.OwnedBy`    | create app registrations, change the ones it owns          |
| Graph `Application.Read.All`             | read the apps and service principals it plans              |

It cannot grant Owner, User Access Administrator or RBAC Administrator, so it
cannot raise its own rights. It cannot change its own Graph permissions either:
a change to them needs a person (below).

## What it creates

| Resource                         | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `rg-sparx-prod-cus-tfstate`      | Holds state, separate from the workload                       |
| `stsparxprodcustfstate`          | Terraform state for both roots, versioned, 30-day recovery    |
| `kv-sparx-prod-cus`              | sparx's own secrets                                           |
| `gha-sparx-prod-cus`             | The release identity (Contributor)                            |
| `gha-sparx-prod-cus-bootstrap`   | The identity that applies this module                         |
| One app registration per product | Each product's deploy identity, with its vault and AKS grants |

State lives at `tfstate/bootstrap-azure.tfstate`, beside `envs/azure.tfstate`.

## No stored credentials

Authentication is **OIDC / workload identity federation**, not a client secret.
GitHub mints a short-lived token per run; Entra trusts it for one repository and
one context. Entra matches the `subject` **exactly**, so a pull request runs
under a different subject and cannot assume either identity's apply path.

The bootstrap identity trusts only `environment:bootstrap`, and that GitHub
Environment is limited to `main` (`terraform output -raw bootstrap_setup`).

## When a person must apply

Only these, and the release fails loudly (a 403) if it meets one:

1. **The first apply in a new subscription** (below).
2. **A change to the bootstrap identity's own rights** in `ci.tf`: its Graph
   permissions or its RBAC condition. Granting those needs Privileged Role
   Administrator, which no pipeline holds.

Apply from a checkout of main:

```bash
cd terraform/bootstrap-azure
terraform init
terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
```

## First apply in a new subscription

The backend points at a storage account this module creates, so the very first
apply runs on local state and then moves it:

```bash
cd terraform/bootstrap-azure
printf 'terraform {\n  backend "local" {}\n}\n' > local_override.tf   # git-ignored
terraform init
terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
rm local_override.tf
terraform init -migrate-state
terraform output -raw gh_cli_commands   # the release identity's variables
terraform output -raw bootstrap_setup   # the bootstrap job's variable and environment
```

Needs **Privileged Role Administrator** (or Global Administrator) in Entra ID,
for the Graph grants, and **Owner** on the subscription, for the RBAC
Administrator grant.

## Note on permissions

`Contributor` is granted at **subscription** scope because `envs/azure` creates
its own resource group and AKS creates a second one for nodes; a group-scoped
assignment could do neither.

`Storage Blob Data Contributor` is separate and easy to miss: Contributor grants
control-plane rights over the storage _account_ but not access to the _data_ in
it. Without it, `terraform init` fails before plan, with an unhelpful error.

`local.bootstrap_roles` must list every role a file here grants. A new grant of
a role not in the list fails the release's apply with a 403; add the role to the
list, and a person applies once (the condition is the bootstrap identity's own
right).
