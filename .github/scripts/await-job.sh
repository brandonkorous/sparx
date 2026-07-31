#!/usr/bin/env bash
#
# Wait for a Kubernetes Job, and say something USEFUL when it does not finish.
#
#   ./.github/scripts/await-job.sh <job-name> <namespace> <timeout-seconds>
#
# This exists because the obvious one-liner lies about what went wrong:
#
#     kubectl wait --for=condition=complete job/db-migrate --timeout=900s \
#       || { kubectl logs job/db-migrate --tail=80; exit 1; }
#
# On the first real Azure deploy that printed exactly two lines —
#     error: timed out waiting for the condition on jobs/db-migrate
#     error: error from server (NotFound): jobs.batch "db-migrate" not found
# — and nothing else. Three separate problems hide behind that:
#
#   1. `--for=condition=complete` cannot distinguish "still running" from "the
#      pod was never scheduled". The migration had spent all 900 seconds Pending
#      because the node was at 51 pods against a max of 50, and none of that
#      appears in the Job's conditions.
#   2. `kubectl logs job/...` needs the POD. If no pod ever ran there is nothing
#      to read, and the fallback fails too — which is how a real failure produced
#      a message about a missing Job instead of a missing node slot.
#   3. `wait` does not return on FAILURE either. A Job that fails immediately
#      still burns the entire timeout before anyone is told.
#
# So: poll both conditions, exit the moment either is decided, and on any
# non-success dump the scheduler's own account of it — Job, pods, container
# states and namespace events — while the objects still exist.
set -uo pipefail

JOB="${1:?job name required}"
NS="${2:?namespace required}"
TIMEOUT="${3:-900}"

diagnose() {
  echo "----- job/$JOB -----"
  kubectl describe "job/$JOB" -n "$NS" 2>&1 | tail -40

  echo "----- pods -----"
  # Pending pods have no logs, so their STATUS is the diagnosis. `-o wide`
  # shows the node, which is empty for anything that never scheduled.
  kubectl get pods -n "$NS" -l "job-name=$JOB" -o wide 2>&1

  for pod in $(kubectl get pods -n "$NS" -l "job-name=$JOB" -o name 2>/dev/null); do
    echo "----- $pod (waiting/terminated reasons) -----"
    kubectl get "$pod" -n "$NS" -o jsonpath='{range .status.containerStatuses[*]}{.name}{": "}{.state}{"\n"}{end}' 2>&1
    echo
    echo "----- $pod events -----"
    kubectl describe "$pod" -n "$NS" 2>&1 | sed -n '/^Events:/,$p' | tail -15
    echo "----- $pod logs -----"
    # `|| true`: a pod that never started has no logs, and that is information,
    # not a reason to lose the rest of this report.
    kubectl logs "$pod" -n "$NS" --tail=120 2>&1 || true
  done

  echo "----- recent namespace events -----"
  kubectl get events -n "$NS" --sort-by=.lastTimestamp 2>&1 | tail -25
}

echo "Waiting up to ${TIMEOUT}s for job/$JOB in $NS ..."
deadline=$(( SECONDS + TIMEOUT ))

while [ "$SECONDS" -lt "$deadline" ]; do
  succeeded=$(kubectl get "job/$JOB" -n "$NS" -o jsonpath='{.status.succeeded}' 2>/dev/null || echo '')
  failed=$(kubectl get "job/$JOB" -n "$NS" -o jsonpath='{.status.failed}' 2>/dev/null || echo '')

  if [ "${succeeded:-0}" -ge 1 ] 2>/dev/null; then
    echo "job/$JOB completed."
    # The successful log matters too: `prisma migrate deploy` reports which
    # migrations it applied, and "No pending migrations" is a different
    # outcome from "applied 164" when a deploy is being debugged.
    kubectl logs "job/$JOB" -n "$NS" --tail=40 2>&1 || true
    exit 0
  fi

  if [ "${failed:-0}" -ge 1 ] 2>/dev/null; then
    echo "::error::job/$JOB failed."
    diagnose
    exit 1
  fi

  sleep 10
done

echo "::error::job/$JOB did not complete within ${TIMEOUT}s."
diagnose
exit 1
