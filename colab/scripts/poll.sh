#!/bin/sh
# Usage: poll.sh SESSION FILE [ALARM_SEC] [TAIL_LINES]
# Runs FILE on the VM with an outer time limit. Retries up to 4 times when
# the call hangs or the connection drops. The job on the VM continues.
s=$1 f=$2 a=${3:-100} n=${4:-40}
for try in 1 2 3 4; do
  out=$(perl -e "alarm $a; exec @ARGV" colab exec -s "$s" -f "$f" 2>&1)
  rc=$?
  case $rc:$out in
    142:*|*'Connection was lost'*|*'Timeout waiting for reply'*)
      echo "[poll.sh] try $try failed (rc=$rc), retrying" >&2
      colab status -s "$s" >&2
      sleep 5 ;;
    *) printf '%s\n' "$out" | tail -n "$n"; exit $rc ;;
  esac
done
echo "[poll.sh] 4 tries failed" >&2
exit 1
