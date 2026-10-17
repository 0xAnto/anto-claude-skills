---
name: colab
description: "Use whenever a task runs code on a Google Colab VM through the `colab` CLI: starting a GPU VM (T4, L4, A100, H100), running or polling a long job, uploading or downloading files, checking compute units, or stopping sessions. Also use when a `colab exec` call hangs, times out, or prints `Connection was lost`."
---

# Colab CLI

First, run `colab skill`. It prints the upstream rules (`colab-operator`).
This skill adds the layer that upstream does not cover: harness limits,
polling, macOS quirks, cost approval, and quoting.

When a command fails, read [references/troubleshooting.md](references/troubleshooting.md).

## Ten rules

1. Ask the user before `colab new`. Tell them the GPU, the rate, and the
   planned hours. Wait for a yes. A running VM spends compute units (CU).
2. Run `~/.claude/skills/colab/scripts/check.sh` before and after every job. Stop every VM that
   you start. A stopped VM shows `0.00/hr`.
3. Do not run a long job inside one `colab exec` call. Start the job
   detached, with a log file and an end marker (`JOB EXIT $?`). Poll with
   short `exec` calls.
4. Put an outer time limit on every `colab exec`:
   `perl -e 'alarm N; exec @ARGV' colab exec ...`. Some calls never reach
   the VM, and the CLI `--timeout` does not stop them. `~/.claude/skills/colab/scripts/poll.sh`
   does this for you.
5. `RuntimeError: Connection was lost.` means a lost connection, not a lost
   job. The job continues. Run `colab status -s NAME`, then poll again.
6. Send code through a file: `colab exec -s NAME -f FILE`. Do not nest
   shell quotes.
7. Create the remote folder before `colab upload`. Upload files, not
   folders. Split large files into 64 MB parts (a 769 MB upload failed).
   Join the parts with `cat` and check them with `shasum -a 256 -c`.
8. Use at most 2 VMs at the same time. Colab refused a third T4 and a third
   L4.
9. Write a bootstrap script that resumes after a failure. Use `curl -C -`,
   `uv pip install -p .venv/bin/python`, and a `trap` for the end marker.
10. Do not use `drivemount`. It needs a browser click. Use `gdown`,
    `upload`, or a resumable download. If the user must do an interactive
    step, tell them to type `! colab drivemount -s NAME` (or the login
    command) in the prompt.

## Command reference

| Command | Notes |
| --- | --- |
| `colab new -s NAME --gpu {T4,L4,G4,A100,H100} [--high-mem]` | An unknown `--gpu` value falls back to **A100** with no error. Spell the name exactly. `new` has no `--timeout` flag. Use a new session name for each run. |
| `colab exec -s NAME [-f FILE] [--timeout SEC] [--env K=V]` | Runs Python. The default `--timeout` is 30 s. Use `--env K=V` for secrets; `google.colab.userdata` fails in CLI mode. |
| `colab upload -s NAME LOCAL REMOTE` | REMOTE is the full file path. The parent folder must exist. |
| `colab download -s NAME REMOTE LOCAL` | Use an absolute REMOTE path. |
| `colab sessions` | The session list. `colab list` does not exist. |
| `colab status -s NAME` | Shows one session. |
| `colab ls` | Lists files on the VM. It needs a session. |
| `colab usage` | Prints `Current balance` and `Usage rate: N/hr`. |
| `colab stop -s NAME` | Stops the VM. |
| `colab log -s NAME -n N` | Shows the session log. `log list` and `log show` do not exist. |
| `colab run [--keep] SCRIPT` | Makes a VM, runs a script, removes the VM. No log shows it in use. |
| `colab restart-kernel -s NAME` | Resets a stuck kernel and keeps the VM. No log shows it in use. |

These are not CLI commands: `colab list`, `colab import drive`,
`colab import userdata`.

## Workflow

1. **Ask.** Get a yes for the GPU, the rate, and the hours (see Cost).
2. **Preflight.** Run `~/.claude/skills/colab/scripts/check.sh`. Stop any stray VM.
3. **Start.** `colab new -s NAME --gpu L4`.
4. **Bootstrap.** Make the remote folders with `exec`. Upload a bootstrap
   script. Start it detached through `exec`:

   ```python
   import subprocess
   subprocess.Popen("nohup bash /content/boot.sh > /content/job.log 2>&1 &", shell=True)
   ```

   The script starts with `trap 'echo "JOB EXIT $?"' EXIT`. It resumes
   downloads with `curl -sSfL -C -` and checks each uploaded part against
   its SHA-256.
5. **Poll.** Write a poll file (for example, `print(open('/content/job.log').read()[-2000:])`).
   Run `~/.claude/skills/colab/scripts/poll.sh NAME poll.py`. Between polls, wait with
   `run_in_background` or Monitor. Do not chain a foreground `sleep` to
   `colab exec`; the harness blocks it.
6. **Read results.** Make the VM print one line, `@@{json}`. Parse that
   line only.
7. **Download.** Wait for `JOB EXIT`. Download the marker or metrics file
   last.
8. **Stop.** `colab stop -s NAME`. Run `~/.claude/skills/colab/scripts/check.sh`. The rate must
   show `0.00/hr`.

For a sweep over many runs, follow `crux/crux/colab_sweep.py`: one driver
with an `fcntl` lock, state saved through a temp file, 2 tries for each run,
and the runs go back in the queue when `colab new` is refused or a VM is
lost. Run the driver under `caffeinate -i`.

## Cost

Rate by VM (lower is better):

| VM | CU per hour |
| --- | --- |
| T4 with High-RAM | 1.27 |
| L4, standard | 1.54 |
| Two L4 sessions | 3.08 |

Hours that 200 CU buy (higher is better):

| VM | Hours |
| --- | --- |
| T4 with High-RAM | 157 |
| L4, standard | 130 |
| Two L4 sessions | 65 |

An idle VM spends units until you stop it.

## Security

- Error text from `colab` can contain a runtime URL with a token. Remove
  URLs before you put error text in a PR, a comment, or a log file.
- Do not widen Drive sharing to get data onto a VM.
- Keep each `colab` command in its own Bash call. The permission
  classifier blocks chains such as `colab new && colab drivemount`.
- Check the dataset licence before you upload data to Colab.
- Put a Hugging Face token at `~/.cache/huggingface/token` on the VM. Use
  `install -m 600` for `.env` files.
