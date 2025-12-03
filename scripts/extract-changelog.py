#!/usr/bin/env python3
"""Extract release notes for a specific version from CHANGELOG.md"""
import re
import sys
import os

if len(sys.argv) < 2:
    print("Usage: extract-changelog.py VERSION")
    sys.exit(1)

version = sys.argv[1]

with open('CHANGELOG.md', 'r') as f:
    content = f.read()

# Find the section for this version
pattern = r'^## \[' + re.escape(version) + r'\].*?\n(.*?)(?=^## \[|\Z)'
match = re.search(pattern, content, re.MULTILINE | re.DOTALL)

if match:
    notes = match.group(1).strip()
    print(notes)
else:
    print(f'ERROR: Release notes for version {version} not found in CHANGELOG.md', file=sys.stderr)
    sys.exit(1)
