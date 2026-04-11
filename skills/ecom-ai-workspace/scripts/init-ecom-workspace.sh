#!/bin/bash
#
# 初始化电商AI工作台技能
# Usage: scripts/init-ecom-workspace.sh <output-directory>

set -e

SKILL_NAME=$1
OUTPUT_DIR=${2:-./skills}

if [ -z "$SKILL_NAME" ]; then
    echo "Usage: $0 <skill-name> [output-directory]"
    exit 1
fi

FULL_PATH="$OUTPUT_DIR/$SKILL_NAME"
mkdir -p "$FULL_PATH"
mkdir -p "$FULL_PATH/references"
mkdir -p "$FULL_PATH/scripts"
mkdir -p "$FULL_PATH/assets"

cat > "$FULL_PATH/SKILL.md" << 'EOF'
---
name: {{skill-name}}
description: [Add description here - when should this skill be used?]
---

# [Add skill name here]

[Add description here]

## When to use

- [X] Use case 1
- [ ] Use case 2

## Workflow

1. Step one
2. Step two
3. Step three

## Configuration

[Add configuration instructions here]
EOF

chmod +x "$FULL_PATH/scripts/init-ecom-workspace.sh" 2>/dev/null || true

echo "Initialized e-commerce skill: $FULL_PATH"
echo "Edit $FULL_PATH/SKILL.md to complete setup"
