import React from "react";
import { Button, Evidence, Status } from "./ui/components.jsx";
import { pendingClarification, changeIsResolved } from "./seller-domain.js";

const amount = value => value == null ? "Pending review" : new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(value);
const date = value => new Date(value).toLocaleString("en-US", {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const topicNames = {quantity:"Quantity",timing:"Requested timing",notes:"Requested details"};
const resultNames = {accepted:"Accepted",alternative:"Alternative proposed","needs-info":"More information needed"};

/** Shared project history. Seller drafts never enter the buyer projection. */
export function ProjectConversation({ project, onQuote, onReply }) {
  const question = pendingClarification(project);
  const events = [
    {kind:"inquiry",...project.inquiry,value:project.inquiry},
    ...project.quotes.map(value=>({kind:"quote",...value,value})),
    ...project.changes.map(value=>({kind:"change",...value,value})),
    ...project.replies.map(value=>({kind:"legacy-reply",...value,value})),
    ...project.nextSteps.map(value=>({kind:"next",...value,value})),
    ...(project.messages || []).map(value=>({...value,kind:"message",value})),
  ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return <div className="pw-conversation">
    <div className="pw-conversation-intro">
      <p className="pw-eyebrow">ONE SHARED PROJECT</p>
      <h2>Questions, replies and decisions.</h2>
      <p>Each message keeps its author and context. Issued quotations remain available as fixed versions.</p>
      {question && <div className="pw-question-callout">
        <Status tone="active">Your reply needed</Status>
        <p>{question.body}</p>
        <Button onClick={onReply}>Reply to question <span aria-hidden="true">→</span></Button>
      </div>}
    </div>
    <ol className="pw-timeline">
      {events.map(event=>{
        const value=event.value;
        const isSeller = event.kind === "quote" || event.kind === "legacy-reply" || value.authorRole === "seller";
        const legacy = value.source === "sample" || event.kind === "legacy-reply";
        const referenceQuote = project.quotes.find(q=>q.id===value.quoteId);
        const referenceChange = project.changes.find(c=>c.id===value.changeId);
        const nextStep = project.nextSteps.find(s=>s.id===value.nextStepId);
        const replyTo = project.messages?.find(m=>m.id===value.replyTo);
        return <li key={`${event.kind}-${value.id}`}>
          <div className="pw-event-head">
            <Evidence kind={isSeller ? (legacy ? "sample" : "review") : "customer"}>
              {isSeller ? legacy ? "Legacy sample · Seller" : "Seller · Demo" : "You · Customer"}
            </Evidence>
            <time dateTime={value.createdAt}>{date(value.createdAt)}</time>
          </div>
          {event.kind === "inquiry" && <>
            <h3>Inquiry confirmed.</h3><p>{value.values.application}</p><small>{value.id}</small>
          </>}
          {event.kind === "quote" && <>
            <h3>Quotation v{value.version} {legacy ? "added" : "issued"}.</h3>
            <p>{value.quantity} units · {amount(value.subtotal)} priced subtotal. Final total pending.</p>
            <Button variant="secondary" onClick={()=>onQuote(value.id)}>View quotation v{value.version} <span aria-hidden="true">→</span></Button>
          </>}
          {event.kind === "change" && <>
            <h3>Changes requested to v{value.quoteVersion}.</h3>
            <p>{value.values.quantity} units · {value.values.targetWeeks ? `${value.values.targetWeeks} weeks requested` : "Timing to discuss"}</p>
            <p className="pw-preserve">{value.values.notes}</p>
            <Status tone={changeIsResolved(project,value.id) ? "complete" : "pending"}>{changeIsResolved(project,value.id) ? "Addressed in the project" : "Review in progress"}</Status>
          </>}
          {event.kind === "legacy-reply" && <>
            <h3>Sample response to v{value.quoteVersion}.</h3>
            <div className="pw-reply-topics">{value.topics.map((topic,index)=><section key={index}>
              <h4>{topic.label}</h4><dl><div><dt>You requested</dt><dd>{topic.requested}</dd></div><div><dt>Sample response</dt><dd>{topic.response}</dd></div></dl>
              <Status tone="pending">{topic.status}</Status>
            </section>)}</div>
            {!!value.openItems?.length && <ul className="pw-open-items">{value.openItems.map(item=><li key={item.id}><div><strong>{item.label}</strong><small>{item.status}</small></div><span>{item.owner}</span></li>)}</ul>}
          </>}
          {event.kind === "next" && <>
            <h3>{value.intent === "discussion" ? "Discussion requested" : "Engineering review requested"} for v{value.quoteVersion}.</h3>
            <p className="pw-preserve">{value.message}</p>
            <Status tone={project.messages?.some(m=>m.nextStepId===value.id && m.kind==="next-step-confirmation") ? "complete" : "pending"}>
              {project.messages?.some(m=>m.nextStepId===value.id && m.kind==="next-step-confirmation") ? "Next step confirmed by seller" : "Awaiting seller confirmation"}
            </Status>
          </>}
          {event.kind === "message" && <>
            <h3>{value.kind === "clarification" ? "A question from the seller." : value.kind === "customer-reply" ? "Your reply." : value.kind === "change-response" ? "Response to your requested changes." : value.kind === "next-step-confirmation" ? "Next step confirmed." : "A reply from the seller."}</h3>
            {referenceChange && <small>Changes to quotation v{referenceChange.quoteVersion}</small>}
            {referenceQuote && <small>Quotation v{referenceQuote.version}</small>}
            {nextStep && <small>{nextStep.intent === "discussion" ? "Discussion" : "Engineering review"} · quotation v{nextStep.quoteVersion}</small>}
            {replyTo && <blockquote className="pw-message-reference">{replyTo.body}</blockquote>}
            <p className="pw-preserve">{value.body}</p>
            {!!value.resolutions?.length && <div className="pw-reply-topics">{value.resolutions.map(result=><section key={result.topic}>
              <h4>{topicNames[result.topic] || result.topic}</h4>
              <p className="pw-preserve">{result.response}</p>
              <Status tone={result.status === "needs-info" ? "pending" : "complete"}>{resultNames[result.status] || result.status}</Status>
            </section>)}</div>}
            {question?.id === value.id && <Button variant="secondary" onClick={onReply}>Reply to question</Button>}
          </>}
        </li>;
      })}
    </ol>
  </div>;
}
