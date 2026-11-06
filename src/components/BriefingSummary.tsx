import { Fragment } from "react";
import type { BriefingData } from "../types";
import { BRIEFING_HIGHLIGHT_SEPARATOR } from "../briefing-summary";

export function BriefingSummary({ summary }: { summary: BriefingData["summary"] }) {
  const citations = (summary.citations ?? []).filter(citation => Number.isInteger(citation.end) && citation.end > 0 && citation.end <= summary.text.length && /^https?:\/\//.test(citation.url)).sort((a, b) => a.end - b.end).map((citation, index) => ({ ...citation, number: index + 1 }));
  let offset = 0;
  return <div className="receipt-briefing-summary">
    {summary.text.split(BRIEFING_HIGHLIGHT_SEPARATOR).map((paragraph, index) => {
      const start = offset;
      const end = start + paragraph.length;
      offset = end + BRIEFING_HIGHLIGHT_SEPARATOR.length;
      let cursor = start;
      return <p key={index}>
        {citations.filter(citation => citation.end > start && citation.end <= end).map(citation => {
          const text = summary.text.slice(cursor, citation.end);
          cursor = citation.end;
          return <Fragment key={`${citation.end}-${citation.url}`}>
            {text}<sup className="receipt-summary-citation"><a href={citation.url} target="_blank" rel="noreferrer" title={citation.title} aria-label={`Source ${citation.number}: ${citation.title}`}>[{citation.number}]</a></sup>
          </Fragment>;
        })}
        {summary.text.slice(cursor, end)}
      </p>;
    })}
  </div>;
}
