// Shared with the server-side summarizer. Count Unicode code points,
// including whitespace, without changing the source text.
export const CALENDAR_DESCRIPTION_VERBATIM_LIMIT = 90;

export function calendarDescription(description: string | undefined) {
  if (!description?.trim()) return undefined;
  return {
    text: description,
    needsSummary: Array.from(description).length > CALENDAR_DESCRIPTION_VERBATIM_LIMIT,
  };
}
