import React from "react";
import { recordContext } from "./drawing-revision.js";
import { DrawingReference } from "./drawing-reference.jsx";
import { InspectionReference } from "./inspection-reference.jsx";
import { Button, Evidence, Status } from "./ui/components.jsx";
import { ProjectActionBar, ProjectDetails } from "./ui/project-frame.jsx";
import { pendingClarification, changeIsResolved } from "./seller-domain.js";
import "./project-conversation-presentation.css";

const amount = value => value == null ? "Pending review" : new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(value);
const date = value => new Date(value).toLocaleString("en-US", {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const topicNames = {quantity:"Quantity",timing:"Requested timing",notes:"Requested details"};
const resultNames = {accepted:"Accepted",alternative:"Alternative proposed","needs-info":"More information needed"};

/** Shared project history. Seller drafts never enter the buyer projection. */
export function ProjectConversation({ project, onQuote, onReply, onExplore, outcomeFirst = false }) {
  const question = pendingClarification(project);
  const events = [
    {kind:"inquiry",...project.inquiry,value:project.inquiry},
    ...(project.drawingRevisions || []).map(value=>({kind:"drawing-revision",...value,value})),
    ...project.quotes.map(value=>({kind:"quote",...value,value})),
    ...project.changes.map(value=>({kind:"change",...value,value})),
    ...project.replies.map(value=>({kind:"legacy-reply",...value,value})),
    ...project.nextSteps.map(value=>({kind:"next",...value,value})),
    ...(project.messages || []).map(value=>({...value,kind:"message",value})),
  ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const renderEvent = event => {
        const value=event.value;
        const isSeller = event.kind === "drawing-revision" || event.kind === "quote" || event.kind === "legacy-reply" || value.authorRole === "seller";
        const legacy = value.source === "sample" || event.kind === "legacy-reply";
        const referenceQuote = project.quotes.find(q=>q.id===value.quoteId);
        const referenceChange = project.changes.find(c=>c.id===value.changeId);
        const nextStep = project.nextSteps.find(s=>s.id===value.nextStepId);
        const replyTo = project.messages?.find(m=>m.id===value.replyTo);
        const isOutcome = outcomeFirst && event === events[0] && value.kind === "next-step-confirmation";
        const eventMeta = <div className="pw-event-head">
            <Evidence kind={isSeller ? (legacy ? "sample" : "review") : "customer"}>
              {isSeller ? legacy ? "Legacy sample · Seller" : "Seller · Demo" : "You · Customer"}
            </Evidence>
            <time dateTime={value.createdAt}>{date(value.createdAt)}</time>
          </div>;
        return <li key={`${event.kind}-${value.id}`} className={isOutcome ? "pw-confirmed-outcome" : undefined}>
          {!isOutcome && eventMeta}
          {event.kind === "drawing-revision" && <>
            <h2>Drawing {value.fromContext.drawing.revisionLabel || value.fromContext.drawing.revision} → {value.context.drawing.revisionLabel || value.context.drawing.revision} reviewed.</h2>
            <p>{value.note}</p><Status tone="complete">Human reviewed for this project</Status>
          </>}
          {event.kind === "inquiry" && <>
            <h2>Inquiry confirmed.</h2><p>{value.values.application}</p><small>{value.id}</small>
          </>}
          {event.kind === "quote" && <>
            <h2>Quotation v{value.version} {legacy ? "added" : "issued"}.</h2>
            <p>{value.quantity} units · {amount(value.subtotal)} priced subtotal. Final total pending.</p>
            <Button variant="secondary" onClick={()=>onQuote(value.id)}>View quotation v{value.version} <span aria-hidden="true">→</span></Button>
          </>}
          {event.kind === "change" && <>
            <h2>Changes requested to v{value.quoteVersion}.</h2>
            <p>{value.values.quantity} units · {value.values.targetWeeks ? `${value.values.targetWeeks} weeks requested` : "Timing to discuss"}</p>
            <p className="pw-preserve">{value.values.notes}</p>
            <Status tone={changeIsResolved(project,value.id) ? "complete" : "pending"}>{changeIsResolved(project,value.id) ? "Addressed in the project" : "Review in progress"}</Status>
          </>}
          {event.kind === "legacy-reply" && <>
            <h2>Sample response to v{value.quoteVersion}.</h2>
            <div className="pw-reply-topics">{value.topics.map((topic,index)=><section key={index}>
              <h3>{topic.label}</h3><dl><div><dt>You requested</dt><dd>{topic.requested}</dd></div><div><dt>Sample response</dt><dd>{topic.response}</dd></div></dl>
              <Status tone="pending">{topic.status}</Status>
            </section>)}</div>
            {!!value.openItems?.length && <ul className="pw-open-items">{value.openItems.map(item=><li key={item.id}><div><strong>{item.label}</strong><small>{item.status}</small></div><span>{item.owner}</span></li>)}</ul>}
          </>}
          {event.kind === "next" && <>
            <h2>{value.intent === "discussion" ? "Discussion requested" : "Engineering review requested"} for v{value.quoteVersion}.</h2>
            <p className="pw-preserve">{value.message}</p>
            <Status tone={project.messages?.some(m=>m.nextStepId===value.id && m.kind==="next-step-confirmation") ? "complete" : "pending"}>
              {project.messages?.some(m=>m.nextStepId===value.id && m.kind==="next-step-confirmation") ? "Next step confirmed by seller" : "Awaiting seller confirmation"}
            </Status>
          </>}
          {event.kind === "message" && <>
            {!isOutcome && <h2>{value.kind === "clarification" ? "A question from the seller" : value.kind === "customer-reply" ? "Your reply" : value.kind === "change-response" ? "Response to your requested changes" : value.kind === "next-step-confirmation" ? nextStep?.intent === "engineering-review" ? "Engineering review agreed" : "Discussion agreed" : "A reply from the seller"}</h2>}
            {referenceChange && <small>Changes to quotation v{referenceChange.quoteVersion}</small>}
            {referenceQuote && <small>Quotation v{referenceQuote.version}</small>}
            {nextStep && <small>{isOutcome ? "Seller confirmation" : nextStep.intent === "discussion" ? "Discussion" : "Engineering review"} · Quotation v{nextStep.quoteVersion}</small>}
            {replyTo && <blockquote className="pw-message-reference">{replyTo.body}</blockquote>}
            <p className="pw-preserve">{value.body}</p>
            {!!value.resolutions?.length && <div className="pw-reply-topics">{value.resolutions.map(result=><section key={result.topic}>
              <h3>{topicNames[result.topic] || result.topic}</h3>
              <p className="pw-preserve">{result.response}</p>
              <Status tone={result.status === "needs-info" ? "pending" : "complete"}>{resultNames[result.status] || result.status}</Status>
            </section>)}</div>}
            {isOutcome && <>
              {eventMeta}
              {(referenceQuote || nextStep) && <Button variant="secondary" onClick={() => onQuote(referenceQuote?.id || nextStep.quoteId)}>View quotation v{referenceQuote?.version || nextStep.quoteVersion} <span aria-hidden="true">→</span></Button>}
              {(recordContext(project, value)?.inspection || recordContext(project, value)?.viewerReference) && <ProjectDetails title="Saved product reference">
                <InspectionReference context={recordContext(project, value)} onOpen={onExplore} />
              </ProjectDetails>}
            </>}
          </>}
          {recordContext(project, value)?.drawing && <details className="pw-event-reference">
            <summary>Drawing reference · {recordContext(project, value).drawing.revisionLabel || recordContext(project, value).drawing.revision}</summary>
            <DrawingReference context={recordContext(project, value)} onOpen={onExplore} compact />
          </details>}
        </li>;
  };
  return <div className="pw-conversation pw-conversation-records">
    <ol className="pw-timeline pw-latest-receipt" aria-label="Latest project activity">
      {events.slice(0, 1).map(renderEvent)}
    </ol>
    {question && <div className="pw-question-callout">
      <Status tone="active">Your reply needed</Status>
      {events[0]?.id !== question.id && <p>{question.body}</p>}
      <ProjectActionBar primary={<Button onClick={onReply}>Reply to question <span aria-hidden="true">→</span></Button>} />
    </div>}
    {events.length > 1 && <ProjectDetails title="Earlier conversation" meta={`${events.length - 1} ${events.length === 2 ? "record" : "records"}`}>
      <ol className="pw-timeline" aria-label="Earlier project activity">
        {events.slice(1).map(renderEvent)}
      </ol>
    </ProjectDetails>}
  </div>;
}
