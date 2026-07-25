set dotenv-load := true

# ── fusion-harness ──────────────────────────────────────
# /fusion · /auto-validate · /opinion — fuse two frontier models (AND, not OR).
# The HOST runs on the BUILDER model: raw (non-slash) input IS the builder agent.
#
# Default launch:
#   just fh              — DeepSeek via opencode-go (pro plans · flash builds + hosts), thinking max
#   just fh ARCH=<m> BUILDER=<m>   — override cast, keep max thinking
#
# Other tiers:
#   just fh-workhorse    cheap pair (sonnet-5 plans · terra builds + hosts) — use for testing
#   just fh-sota         frontier pair (fable-5 plans · sol builds + hosts) — the on-camera run
#   just fh-glm          multi-provider: zai/glm-5.2 plans · zai/glm-5-turbo builds
#   just fh-zen          multi-provider: OpenCode Zen pair (ids confirmed against live catalog)
#
# Configuration flags (all optional, appendable to either recipe):
#   --architect <provider/id>              plans/fuses/validates
#   --builder <provider/id>                builds (also hosts)
#   --architect-thinking <level>           EVERY architect-family execution
#   --builder-thinking <level>             EVERY builder execution
#                                          (levels: off|minimal|low|medium|high|xhigh|max)
#   --architect-system-prompt <text|path>  override architect worker/fusion system prompt
#   --builder-system-prompt <text|path>    override builder system prompt
#   --max-validations <n>                  /auto-validate halt cap            default 5
#   --escalate-to-validator-count <n>      validator triage from Nth failure  default 3
#   --child-timeout <seconds>              kill any child agent after N sec   default 28800 = 8h (max 86400)
#
# e.g. just fh --cast-defaults
#      just fh-workhorse --architect-thinking high --builder-system-prompt ./persona.md
#      just fh-sota --architect-thinking max --builder-thinking max
#
# Default prompts live in extensions/fusion-harness/{SYSTEM,USER}_PROMPT_*.md — edit to tune.
# Sessions persist per project (/tmp/fusion-harness-sessions) — /fh-reset for fresh memories.

# Default cast — DeepSeek via OpenCode Go (pro plans · flash builds + hosts). Requires OPENCODE_API_KEY.
ARCH := "opencode-go/deepseek-v4-pro"
BUILDER := "opencode-go/deepseek-v4-flash"

# WORKHORSE tier — the cheap pair (sonnet-5 plans · terra builds + hosts). Use for testing.
WORKHORSE_ARCHITECT := "anthropic/claude-sonnet-5"
WORKHORSE_BUILDER := "openai/gpt-5.6-terra"

# STATE-OF-THE-ART tier — the frontier, on-camera pair (fable 5 plans · sol builds + hosts).
SOTA_ARCHITECT := "anthropic/claude-fable-5"
SOTA_BUILDER := "openai/gpt-5.6-sol"

# GLM tier — Zhipu GLM models via the zai provider (ENABLES multi-provider runs: ZAI_API_KEY required).
GLM_ARCHITECT := "zai/glm-5.2"
GLM_BUILDER := "zai/glm-5-turbo"

# ZEN tier — OpenCode Zen models (ENABLES multi-provider runs: OPENCODE_API_KEY required).
# Zen's model catalog is dynamic — confirm exact ids against the live catalog before production use.
ZEN_ARCHITECT := "opencode/zen-chat"
ZEN_BUILDER := "opencode/zen-chat-plus"

default:
    @just --list

# WORKHORSE tier — cheap pair at medium thinking. Use this for testing.
fh-workhorse *ARGS:
    pi -e extensions/fusion-harness/fusion-harness.ts \
        --model {{WORKHORSE_BUILDER}} \
        --architect {{WORKHORSE_ARCHITECT}} --builder {{WORKHORSE_BUILDER}} \
        --architect-thinking medium --builder-thinking medium \
        {{ARGS}}

# STATE-OF-THE-ART tier — frontier pair at xhigh thinking. The on-camera run.
fh-sota *ARGS:
    pi -e extensions/fusion-harness/fusion-harness.ts \
        --model {{SOTA_BUILDER}} \
        --architect {{SOTA_ARCHITECT}} --builder {{SOTA_BUILDER}} \
        --architect-thinking xhigh --builder-thinking xhigh \
        {{ARGS}}

# GLM multi-provider run (zai/glm-5.2 · zai/glm-5-turbo). Requires ZAI_API_KEY.
fh-glm *ARGS:
    pi -e extensions/fusion-harness/fusion-harness.ts \
        --model {{GLM_BUILDER}} \
        --architect {{GLM_ARCHITECT}} --builder {{GLM_BUILDER}} \
        --architect-thinking medium --builder-thinking medium \
        {{ARGS}}

# ZEN multi-provider run (OpenCode Zen). Requires OPENCODE_API_KEY.
fh-zen *ARGS:
    pi -e extensions/fusion-harness/fusion-harness.ts \
        --model {{ZEN_BUILDER}} \
        --architect {{ZEN_ARCHITECT}} --builder {{ZEN_BUILDER}} \
        --architect-thinking medium --builder-thinking medium \
        {{ARGS}}

# Default launch — DeepSeek opencode-go pair at max thinking.
# Override: just fh ARCH=zai/glm-5.2 BUILDER=opencode/<model>
fh *ARGS:
    pi -e extensions/fusion-harness/fusion-harness.ts \
        --model "{{BUILDER}}" \
        --architect "{{ARCH}}" --builder "{{BUILDER}}" \
        --architect-thinking max --builder-thinking max \
        {{ARGS}}
