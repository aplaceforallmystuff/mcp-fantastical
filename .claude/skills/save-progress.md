---
name: save-progress
description: Save session progress before context compaction to preserve working memory
---

# Save Progress Skill

Use this skill before context gets full to preserve session state. This prevents losing important context and avoids repeating mistakes after compaction.

## When to Use

- Context usage exceeds 70%
- Before running `/compact`
- When switching to a complex subtask
- Before ending a long session

## What to Capture

### 1. Task State
```yaml
task:
  description: "{what you're working on}"
  status: "{in_progress|blocked|completed}"
  completed:
    - "{done item 1}"
    - "{done item 2}"
  remaining:
    - "{todo item 1}"
    - "{todo item 2}"
  blockers:
    - "{any blocking issues}"
```

### 2. Key Decisions
```yaml
decisions:
  - question: "{what was decided}"
    choice: "{option selected}"
    reasoning: "{why this choice}"
    alternatives_rejected:
      - "{other option and why not}"
```

### 3. Bug Fixes (Critical for Memory)
```yaml
bug_fixes:
  - title: "{bug name}"
    symptom: "{what was happening}"
    root_cause: "{actual problem}"
    fix: "{what was changed}"
    files_modified:
      - "{file1}"
      - "{file2}"
    prevention: "{how to avoid in future}"
```

### 4. Important File Locations
```yaml
key_files:
  main_logic: "{path/to/main.ts}"
  tests: "{path/to/tests/}"
  config: "{path/to/config}"
  entry_point: "{path/to/index.ts}"
```

### 5. Working Patterns
```yaml
patterns_discovered:
  - pattern: "{useful grep/glob pattern}"
    purpose: "{what it finds}"
  - pattern: "{another pattern}"
    purpose: "{what it finds}"
```

## Output Location

Write to: `.claude/memory/session-{YYYYMMDD}-{HHMM}.md`

## Template

```markdown
# Session Progress: {YYYY-MM-DD HH:MM}

## Current Task
{description of what's being worked on}

## Status: {in_progress|blocked|completed}

## Completed This Session
- [x] {item 1}
- [x] {item 2}

## Still To Do
- [ ] {remaining item 1}
- [ ] {remaining item 2}

## Decisions Made
| Decision | Choice | Why |
|----------|--------|-----|
| {question} | {choice} | {reasoning} |

## Bug Fixes Applied
### {Bug Title}
- **Symptom:** {what was broken}
- **Cause:** {root cause}
- **Fix:** {solution applied}
- **Prevention:** {how to avoid}

## Key Files for This Task
- `{path}` - {purpose}
- `{path}` - {purpose}

## Useful Patterns
- `{pattern}` finds {what}

## Context for Next Session
{Any important context that shouldn't be lost}
```

## After Compaction

When resuming after `/compact`:
1. Read most recent `.claude/memory/session-*.md`
2. Read `.claude/memory/bug-fixes.md` if exists
3. Resume from saved state
