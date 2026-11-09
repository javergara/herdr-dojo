#!/bin/sh
# Herdr Dojo practice agent.
# Reports a status to Herdr (the same OSC 7501 sequence Claude Code's hooks send) and calls no model, no network:
# it only prints text and sleeps. Press Enter to give it a task; it works, asks for permission (blocked), works
# again, and finishes (done). Ctrl+C ends it.

esc=$(printf '\033')

emit() { # emit <state> [kind] [message]
  seq="state=$1:app=dojo-agent"
  [ -n "$2" ] && seq="$seq:kind=$2"
  if [ -n "$3" ]; then
    msg=$(printf '%s' "$3" | base64 | tr -d '\n=')
    seq="$seq:msg=$msg"
  fi
  printf '%s]7501;%s%s\\' "$esc" "$seq" "$esc"
}

trap 'emit clear; exit 0' INT TERM HUP
emit idle

printf '\n  Herdr Dojo - practice agent\n  No model is called here: this script only reports statuses.\n\n'
n=0
while :; do
  printf '  Press Enter to give me a task... '
  read -r _ || break
  n=$((n + 1))
  emit working
  printf '\n  Task %s: working (6 seconds)...\n' "$n"
  sleep 6
  emit blocked permission "Practice agent: may I run the practice task? Press Enter to allow."
  printf '  I need your permission to continue. Press Enter to allow... '
  read -r _ || break
  emit working
  printf '\n  Allowed. Finishing (4 seconds)...\n'
  sleep 4
  emit done
  printf '  Done. That is what "done" looks like.\n\n'
done
emit clear
