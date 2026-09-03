import { useMemo, useRef } from 'react';
import { AskAiOrb } from '../AskAiOrb';
import {
  TEC8_ACK, TEC8_CHECKS, TEC8_FOLLOW_UPS, TEC8_PROMPT, planSteps,
} from './tec8Model';
import type { Tec8Api } from './useTec8';
import { Tec8UserMessage } from './Tec8UserMessage';
import { Tec8NovaMessage } from './Tec8NovaMessage';
import { Tec8Investigation } from './Tec8Investigation';
import { Tec8TicketContext } from './Tec8TicketContext';
import { Tec8Plan } from './Tec8Plan';
import { Tec8PlanEditor } from './Tec8PlanEditor';
import { Tec8ExecutionProgress } from './Tec8ExecutionProgress';
import { Tec8Completion } from './Tec8Completion';
import { Tec8Failure } from './Tec8Failure';
import { Tec8SuggestedQuestions } from './Tec8SuggestedQuestions';

/* THE WHOLE TEC-8 JOURNEY, INSIDE ONE CONVERSATION.
 *
 * ── NOTHING HERE NAVIGATES ───────────────────────────────────────────────
 * Proposing, editing, approving, executing and confirming all happen as messages in this thread.
 * The ONE exception is "View ticket", which is the reader explicitly asking to go somewhere. An
 * agentic flow that bounces someone to a settings screen to change a step has stopped being a
 * conversation and become a wizard with a chat bubble on top.
 *
 * ── IT IS A TRANSCRIPT, SO EARLIER PLANS STAY ──────────────────────────────────
 * Every revision is a new message, and the superseded ones are left in place READ-ONLY — with
 * no buttons, because a stale Approve is a button that authorises something the reader has since
 * changed their mind about. Only the newest plan can be acted on.
 *
 * ── THE ROLE IS NEVER ASKED FOR ──────────────────────────────────────────
 * There is no role selector and no role chip anywhere in this file. A technician has one role and
 * the system already knows it; asking them to pick it would be asking them to configure a fact.
 */
export function Tec8Conversation({ api, onViewTicket }: {
  api: Tec8Api;
  onViewTicket: () => void;
}) {
  const { store } = api;
  const s = store.state;
  /* Stable for the life of the mount, so the identity row's timestamp does not shuffle as the
     machine advances. */
  const startedAt = useRef(Date.now()).current;

  const investigating = s === 'investigating';
  const executing = s === 'executing';
  const finished = s === 'complete' || s === 'partial_failure';
  const past = ['plan_ready', 'modify', 'plan_updated', 'executing', 'complete', 'partial_failure'];
  const planVisible = past.includes(s);
  const rounds = store.rounds;

  /* The newest plan block is the only one that can be acted on. */
  const liveIsOriginal = rounds.length === 0;
  const canAct = s === 'plan_ready' || s === 'plan_updated';
  const canEditSteps = canAct || s === 'modify';

  const approvedSteps = useMemo(
    () => planSteps(store.approved ?? store.plan),
    [store.approved, store.plan],
  );

  if (s === 'empty') {
    return (
      <div className="tec8-empty">
        <AskAiOrb size={92} state="idle" />
        <p className="nova-hello">What can I take off your plate?</p>
        <p className="nova-hello-sub">
          I can investigate and propose a plan. Nothing changes until you approve it.
        </p>
        <button type="button" className="nova-sugg tec8-start" onClick={api.start}>
          <span className="min-w-0 flex-1 text-left">{TEC8_PROMPT}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tec8-thread">
      {/* ── the ask, the investigation, and the first plan ── */}
      <article>
        <Tec8UserMessage text={TEC8_PROMPT} />
        <div style={{ marginTop: 'var(--nova-gap-turn)' }}>
          <Tec8NovaMessage working={investigating} startedAt={startedAt}>
            {s !== 'prompt' && (
              <>
                {TEC8_ACK.map((p, i) => (
                  <p key={p} className="nova-t-body" style={i ? { marginTop: 'var(--nova-gap-para)' } : undefined}>{p}</p>
                ))}
                <Tec8Investigation
                  index={store.checkIndex}
                  done={store.checkIndex >= TEC8_CHECKS.length}
                />
              </>
            )}

            {planVisible && (
              <>
                <Tec8TicketContext />
                <Tec8Plan
                  plan={liveIsOriginal ? store.plan : rounds[0].previous}
                  previous={null}
                  revised={false}
                  editable={liveIsOriginal && canEditSteps}
                  actions={liveIsOriginal && canAct}
                  onPlan={api.setPlan}
                  onModify={api.modify}
                  onApprove={api.approve}
                />
              </>
            )}
          </Tec8NovaMessage>
        </div>
      </article>

      {/* ── every revision, in order ── */}
      {rounds.map((r, i) => {
        const newest = i === rounds.length - 1;
        return (
          <article key={`${i}-${r.text}`}>
            <Tec8UserMessage text={r.text} />
            <div style={{ marginTop: 'var(--nova-gap-turn)' }}>
              <Tec8NovaMessage working={false} startedAt={startedAt}>
                <Tec8Plan
                  plan={newest ? store.plan : r.plan}
                  previous={r.previous}
                  revised
                  editable={newest && canEditSteps}
                  actions={newest && canAct}
                  onPlan={api.setPlan}
                  onModify={api.modify}
                  onApprove={api.approve}
                />
              </Tec8NovaMessage>
            </div>
          </article>
        );
      })}

      {/* ── modifying ── */}
      {s === 'modify' && (
        <article>
          <Tec8NovaMessage working={false} startedAt={startedAt}>
            <p className="nova-t-body">What would you like to change?</p>
            <Tec8PlanEditor
              plan={store.plan}
              rejected={store.rejected}
              onApply={api.applyModification}
              onSettings={api.setSettings}
              onCancel={api.cancelModify}
            />
          </Tec8NovaMessage>
        </article>
      )}

      {/* ── running it, and what happened ── */}
      {(executing || finished) && (
        <article>
          <Tec8NovaMessage working={executing} startedAt={startedAt}>
            <Tec8ExecutionProgress
              steps={approvedSteps}
              index={store.execIndex}
              outcome={store.outcome}
              finished={finished}
            />

            {s === 'complete' && store.approved && (
              <Tec8Completion
                approved={store.approved}
                onViewTicket={onViewTicket}
                onContinue={api.reset}
              />
            )}
            {s === 'partial_failure' && store.approved && (
              <Tec8Failure
                approved={store.approved}
                onRetry={api.retry}
                onViewTicket={onViewTicket}
              />
            )}

            {finished && (
              <Tec8SuggestedQuestions
                questions={TEC8_FOLLOW_UPS}
                /* A prototype: these are the shape of the offer, not wired questions. */
                onAsk={() => {}}
              />
            )}
          </Tec8NovaMessage>
        </article>
      )}
    </div>
  );
}
