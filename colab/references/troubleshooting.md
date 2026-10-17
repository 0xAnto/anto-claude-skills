# Colab CLI: what breaks, and the fix

The evidence comes from Claude Code logs of the crux and tells projects and from the upstream repo `googlecolab/google-colab-cli` (commit `006ff96`).

| Symptom | Cause | Fix |
| --- | --- | --- |
| `No such command 'list'. Did you mean 'ls'?` | The command is `sessions`. | Use `colab sessions`. |
| `[colab] Error: No active sessions found. Create one with 'colab new'.` | `ls` or `exec` ran with no session. | Make a session first. |
| `TimeoutError: Timeout waiting for reply` from `exec` | The reply wait ended. Upstream: the default is 30 s, and the setup call waits 10 s. | Pass `--timeout`. Better: run the job detached. The log did not settle which timer fired. |
| `colab exec` hangs. Some calls never reach the VM, and `--timeout` does not stop them. | Unknown. One hypothesis: session-lock contention. | Wrap in `perl -e 'alarm N; exec @ARGV'`. Retry. Find and kill `colab exec` processes with PPID 1. |
| `RuntimeError: Connection was lost.` | The WebSocket dropped (`jupyter-kernel-client`). Laptop sleep is a suspect; not tested. | The job continues. Run `colab status -s NAME`. Run the poll again. A retry loop of up to 4 tries worked. |
| The harness blocks a foreground `sleep` chained to `colab exec`. Long calls move to the background. | The Bash tool limit. Seen at 120 s, 300 s, and 600 s in different sessions. | Wait with `run_in_background` or Monitor. Keep each foreground call short. |
| `Upload failed: 500 Server Error` | The remote parent folder is missing, or the path is a folder. | Make the folder with `os.makedirs` through `exec`. Upload each file to its full path. |
| `400 Bad Request` on a 769 MB upload | File size. | Split into 64 MB parts. Join with `cat`. Check with `shasum -a 256 -c`. |
| `Service Unavailable` from `new` (T4) | Capacity. The cause is not confirmed. | Retry. |
| `new` refused for the third session (T4 and L4) | Two VMs is the limit seen. | Run the sweep on 2 VMs. The driver puts the runs back in the queue. |
| A VM has no session name. `colab stop` fails. | The local session record is gone. | List with `colab sessions`. The log fixed it with the private `state.client.unassign(<id>)`. That call is fragile. |
| `source code string cannot contain null bytes`, `SyntaxError`, `unterminated string literal`, `unexpected character after line continuation character` | Shell quoting of code on stdin. | Write the payload to a file. Use `exec -f` or `< file`. Use a quoted heredoc. |
| `pkill -f` in a payload kills the payload shell. | The pattern matches the payload text. | Write the pattern as `[l]ane.sh`, or kill by `ps` and skip the own and parent PID. |
| `tail -1` prints nothing. | `exec` output ends with a blank line. | Use `tail -4`. |
| `timeout: command not found`. BSD `sed -i` fails. | macOS tools. | Use `perl alarm`. Edit with Python. |
| `OSError: [E050] Can't find model 'en_core_web_sm'` | `UV_SYSTEM_PYTHON=true` on Colab. `uv pip install` goes to the system Python. | `uv pip install -p .venv/bin/python <wheel URL>`. Or upload `pyproject.toml` and `uv.lock`, then `uv sync --group NAME`. |
| `pkg_resources` missing (CosyVoice2 import) | New setuptools. | Install `setuptools<81`. |
| `CUDA OutOfMemoryError` | Two engines on one L4. | Run one lane per GPU. |
| Zenodo transfer stops (`curl` error 18, `IncompleteRead`) | Long transfers drop. | Loop `curl -sSfL -C -`. Treat HTTP 416 as done. Retry on 408 and 429. |
| `drivemount`: `ValueError: mount failed`, or `Press Enter after you have granted access...` | The command needs a browser click. Upstream issue #103: error 400 when the account is not `authuser=0`. | Do not use it from an agent. Use `gdown --folder`, `upload`, or a resumable download. |
| `You are sending unauthenticated requests to the HF Hub` | No token on the VM. | Only a warning. For gated data, upload the token file to `~/.cache/huggingface/token`. |
| Colab took back a running VM (`crux5-s0`). | Unknown. | The driver restarted the runs from the last checkpoint. |
| An NLTK download was refused by a proxy check. | Not settled. | Open. |

Open upstream issues that match the logs: #82 (a timed-out long `exec` keeps a CPU core busy), #89 (`colab console` hangs), #103 (`drivemount` and `authuser`), #116 (partial OAuth consent).
