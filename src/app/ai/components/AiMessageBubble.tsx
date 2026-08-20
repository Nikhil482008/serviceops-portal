/* One message in an Ask AI thread.
 *
 * Markup lifted verbatim from TicketPropertiesPanel (was lines 3373-3408) so the ticket panel
 * renders identically after the extraction. The only change is that the caller now passes what to
 * show instead of the component reaching into a message object — the ticket panel's message shape
 * (`isTyping` / `displayedText` / `fullText`) belongs to its canned-response model, and baking it
 * in here would drag that model into the streaming panel.
 *
 * Kept deliberately: the user bubble's `rounded-bl-sm` and the assistant's `rounded-2xl
 * rounded-tl-sm` on an element with no background. Both look like mistakes and neither is load
 * bearing, but changing them is a visual change, and this commit is not that.
 */
import { Sparkles } from 'lucide-react';
import { renderAiText } from './AiMarkdown';

export interface AiMessageBubbleProps {
  role: 'user' | 'assistant';
  /** What to render right now. While streaming, this is what has arrived so far. */
  text: string;
  /** Pre-formatted for display — the ticket panel stores it that way. */
  timestamp: string;
  /** Draws the caret after the text. */
  streaming?: boolean;
}

export function AiMessageBubble({ role, text, timestamp, streaming }: AiMessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="flex-1 max-w-[80%]">
          <div className="rounded-lg rounded-bl-sm px-4 py-3" style={{ background: 'rgba(223, 229, 237, 0.40)' }}>
            <p className="text-[13px] text-[#364658] leading-relaxed">
              {renderAiText(text)}
            </p>
          </div>
          <p className="text-[10px] text-[#7B8FA5] mt-1 text-right">
            {timestamp}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Product blue, not the AI accent. The accent marks the ENTRY POINT to Ask AI; inside the
          thread every message already belongs to it, so a purple glyph on each one would be the
          same signal repeated down the page. */}
      <Sparkles size={16} className="text-[#3D8BD0] flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-sm">
          <p className="text-[13px] text-[#364658] leading-relaxed whitespace-pre-wrap">
            {renderAiText(text)}
            {streaming && <AiCaret />}
          </p>
        </div>
        <p className="text-[10px] text-[#7B8FA5] mt-1">
          {timestamp}
        </p>
      </div>
    </div>
  );
}

/** The blinking block after streaming text. Split out because the docked panel shows it in its
 *  own empty assistant row before the first token arrives, where there is no bubble yet. */
export function AiCaret() {
  return <span className="inline-block w-1 h-4 bg-[#3D8BD0] ml-0.5 animate-pulse" />;
}
