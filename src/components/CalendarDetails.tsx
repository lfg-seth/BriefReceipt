import { ArrowRight, BriefcaseBusiness, Check, ClipboardList, Clock3, CircleHelp, House, MapPin, UserRound, X } from "lucide-react";
import { calendarDescription } from "../calendar-description";
import { calendarLocation, sampleDeparture, uniqueInvitees } from "../calendar-presentation";
import type { CalendarItem, Config } from "../types";

const responses = {
  ACCEPTED: { Icon: Check, label: "Accepted" },
  DECLINED: { Icon: X, label: "Declined" },
  TENTATIVE: { Icon: Clock3, label: "Tentative" },
  "NEEDS-ACTION": { Icon: CircleHelp, label: "Awaiting response" },
  DELEGATED: { Icon: ArrowRight, label: "Delegated" },
};

export function CalendarDetails({ item, travel }: { item: CalendarItem; travel: Config["sources"]["calendarTravel"] }) {
  const notes = calendarDescription(item.description);
  const summary = notes?.needsSummary ? item.descriptionSummary : undefined;
  const invitees = uniqueInvitees(item.invitees);
  const location = item.location ? calendarLocation(item.location, travel.localCity, travel.localState) : undefined;
  return <>
    {notes && <div className="receipt-detail receipt-calendar-description receipt-icon-row">
      <ClipboardList size={12} role="img" aria-label={summary ? "AI summary" : notes.needsSummary ? "Full notes" : "Notes"} />
      {summary ? <p className="receipt-ai-summary">{summary.text}</p> : <div><p>{notes.text}</p>{notes.needsSummary && item.summaryUnavailable && <p className="receipt-ai-unavailable">{item.summaryUnavailable}</p>}</div>}
    </div>}
    {!!invitees.length && <ul className="receipt-detail receipt-calendar-invitees" aria-label="Invitees">
      {invitees.map(person => <li className="receipt-icon-row" key={person.name}>
        <UserRound size={12} role="img" aria-label="Invitee" />
        <span>{person.name}</span>
        {person.statuses.map(status => {
          const response = responses[status as keyof typeof responses];
          const Icon = response?.Icon ?? CircleHelp;
          return <Icon key={status} size={11} role="img" aria-label={response?.label ?? `Response: ${status}`} />;
        })}
      </li>)}
    </ul>}
    {location?.text && <div className="receipt-detail receipt-calendar-location receipt-icon-row">
      <MapPin size={12} strokeWidth={1.7} role="img" aria-label="Location" />
      <span>{location.text}</span>
    </div>}
    {location?.isAddress && <div className="receipt-calendar-travel">
      {([
        { key: "home", Icon: House, label: "From home", minutes: travel.homeMinutes },
        { key: "work", Icon: BriefcaseBusiness, label: "From work", minutes: travel.workMinutes },
      ]).map(({ key, Icon, label, minutes }) => <div className="receipt-detail receipt-travel-row receipt-icon-row" key={key}>
        <Icon size={12} role="img" aria-label={label} />
        <span>{minutes} min</span><span>·</span>
        <span>leave {sampleDeparture(item, minutes) ?? "—"}</span>
      </div>)}
    </div>}
  </>;
}
