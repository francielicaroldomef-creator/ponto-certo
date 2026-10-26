<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the centralized interval engine in `src/lib/calc.ts` and `loadPeriod` for attendance, indicators, reports and exports so coverage and waivers cannot be counted twice.
- Store realized/planned personnel coverage in the existing coverage records and customer waivers/uncovered decisions in audited `absence_treatments`; this preserves personnel history and avoids synthetic coverage for waivers.
- Enforce treatment permissions, interval conflicts and period closing locks in database policies/triggers, not only the interface, to protect direct writes.
- Both absence forms use shared fresh conflict preflight; a shared database write trigger serializes absence coverage/treatment checks by post/date, including legacy unlinked coverages, without repairing historical rows.
- New closings retain detailed calculation snapshots; use saved totals and rows for closed periods to prevent silent financial changes.
