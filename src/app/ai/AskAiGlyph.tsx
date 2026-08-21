/* The Ask AI sparkle, with the Gemini-style sheen.
 *
 * Drawn as a MASKED GRADIENT rather than an SVG with a gradient fill, and the reason is not
 * stylistic. To sweep light across a glyph you have to move the gradient, and an SVG
 * `<linearGradient>`'s x1/x2 are attributes, not CSS properties — you cannot animate them from a
 * stylesheet, only with SMIL, which then cannot be switched off by a media query. Masking the
 * product's own sparkle over a CSS gradient makes the animation an ordinary
 * `background-position`, which means `prefers-reduced-motion` can turn it off in one rule.
 *
 * It also sidesteps a real defect in `AiSparkle`: that component hardcodes its gradient's DOM id
 * (`ai-sparkle-grad`), so two of them on one page emit duplicate ids. There is no id here at all.
 *
 * The path is the product's existing AI sparkle, copied from AiSparkle.tsx so the rail's glyph and
 * the 22 other places that draw it are the same shape.
 */
import { isAskAiEnabled } from './flags';

/** The product's AI sparkle outline. Same `d` as AiSparkle.tsx. */
const SPARKLE_D = 'M15,5h.83v.83c0,.46.37.83.83.83.46,0,.83-.37.83-.83v-.83h.83c.46,0,.83-.37.83-.83,0-.46-.37-.83-.83-.83h-.83v-.83c0-.46-.37-.83-.83-.83-.46,0-.83.37-.83.83v.83h-.83c-.46,0-.83.37-.83.83,0,.46.37.83.83.83ZM18.97,9.33l-.06-.08-.07-.08c-.16-.18-.37-.3-.6-.37h-.01s-5.11-1.32-5.11-1.32c-.14-.04-.28-.11-.38-.22-.11-.11-.18-.24-.22-.38l-1.32-5.11v-.02s-.04-.1-.04-.1c-.08-.22-.23-.42-.42-.56-.22-.16-.48-.25-.76-.25-.24,0-.47.07-.67.2l-.08.06c-.22.16-.37.4-.45.66v.02s-1.32,5.11-1.32,5.11c-.04.14-.11.28-.22.38-.08.08-.17.14-.28.18l-.11.04-5.11,1.32s-.01,0-.02,0c-.23.06-.43.19-.59.37l-.07.08c-.14.19-.23.42-.25.65v.1s0,.1,0,.1c.02.24.1.46.25.65.16.22.39.37.66.45,0,0,.01,0,.02,0l5.11,1.32c.14.04.28.11.38.22.11.11.18.24.22.38l1.32,5.11s0,.01,0,.02c.07.26.23.49.45.66.22.16.48.25.76.25.27,0,.54-.09.75-.25.22-.16.37-.4.45-.66,0,0,0-.01,0-.02l1.32-5.11c.04-.14.11-.28.22-.38.11-.11.24-.18.38-.22l5.11-1.32h.01c.26-.08.5-.23.66-.45.17-.22.25-.48.25-.76,0-.24-.07-.47-.2-.67ZM12.71,10.91c-.43.11-.83.34-1.14.65-.32.32-.54.71-.65,1.14l-.91,3.54-.91-3.54c-.11-.43-.34-.83-.65-1.14-.32-.32-.71-.54-1.14-.65l-3.54-.91,3.54-.91c.43-.11.83-.34,1.14-.65.32-.32.54-.71.65-1.14l.91-3.54.91,3.54.05.16c.12.37.33.71.61.98.32.32.71.54,1.14.65l3.54.91-3.54.91ZM4.25,14.17h-.09c0-.46-.37-.84-.83-.84-.46,0-.83.37-.83.83h-.08c-.42.05-.75.4-.75.83s.33.79.75.83h.08s0,.09,0,.09c.04.42.4.75.83.75.43,0,.79-.33.83-.75v-.08s.09,0,.09,0c.42-.04.75-.4.75-.83s-.33-.79-.75-.83Z';

/* Built once at module scope. `encodeURIComponent` rather than hand-escaping: the path contains
   characters (#, <, ") that break a data URI in ways that fail silently — the mask simply does not
   apply and the glyph renders as a solid square. */
const MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="${SPARKLE_D}"/></svg>`,
)}")`;

export interface AskAiGlyphProps {
  size?: number;
  /** The panel is open. Attention has been got, so the animation stops and the glyph goes to the
   *  rail's selected white — continuing to shimmer would be the button asking for a click it has
   *  already had. */
  active?: boolean;
}

export function AskAiGlyph({ size = 20, active = false }: AskAiGlyphProps) {
  const maskStyle = {
    WebkitMaskImage: MASK,
    maskImage: MASK,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as const;

  if (active) {
    return (
      <span
        aria-hidden="true"
        className="block flex-shrink-0"
        style={{ width: size, height: size, background: '#fff', ...maskStyle }}
      />
    );
  }

  return (
    <span aria-hidden="true" className="relative flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {/* The halo. Behind the glyph, sized past it, and invisible for most of the cycle — it is
          the part that catches the eye at the edge of vision without the icon itself moving much. */}
      <span
        className="askai-halo pointer-events-none absolute rounded-full"
        style={{
          width: size * 1.9,
          height: size * 1.9,
          background: 'radial-gradient(circle, rgba(115,30,251,0.45) 0%, rgba(115,30,251,0) 70%)',
        }}
      />
      {/* The glyph. `background-size: 250%` gives the gradient room to travel; the keyframes move
          it across and then hold, so this reads as an occasional sweep rather than a strobe. */}
      <span
        className="askai-sheen askai-twinkle relative block"
        style={{
          width: size,
          height: size,
          background: 'var(--ai-gradient)',
          backgroundSize: '250% 100%',
          ...maskStyle,
        }}
      />
    </span>
  );
}

/* Kept beside the component so a reader finds it here rather than guessing which stylesheet owns
   the keyframes: they live in src/styles/theme.css under "Ask AI attention". */
export const ASK_AI_GLYPH_ENABLED = isAskAiEnabled;
