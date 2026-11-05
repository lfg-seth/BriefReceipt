# Find a compatible receipt printer and physical controls within budget

Type: research
Labels: wayfinder:research
Status: resolved
Assignee: codex-hardware-research
Parent: ../map.md
Blocked by: none

## Question

Which currently obtainable receipt printer and control/display components can form a reliable Pi 4 print station within a $200 additional-hardware target? Compare receipt widths, USB/network interfaces, Linux/Pi compatibility and command support, cutter, power requirements, paper, buttons, small two-line menu display options, wiring/enclosure allowances, and the cost assumptions around an already owned Pi 4. Produce a sourced shortlist and practical bill of materials with availability and price caveats; do not purchase anything.

## Comments

Research context: branch `research/hardware`, worktree `.research-worktrees/hardware`, planned asset `docs/research/hardware.md`. Claimed before investigation; root session records the resolution after reviewing findings.

## Answer

Resolved by manufacturer specifications and current storefront research on 2026-11-05. [Shortlist, bill of materials, and source citations](../../../docs/research/hardware.md).

An 80mm desktop printer with an automatic cutter is a plausible fit; the leading researched candidate is the Rongta RP326. The example station totals $183.29 only if its bundle includes printer power and the existing Pi has usable power/storage. Missing accessories can exceed $200. A 58mm DFRobot module is a cheaper, more assembly-intensive alternative; MUNBYN is another option with unconfirmed stock.

A small graphical OLED can render two text lines, and panel buttons fit the proposed station. Exact seller/SKU, included power, inventory, readability, and physical print/control tests remain purchase-readiness checks. No printer, paper width, or button mapping has been selected.
