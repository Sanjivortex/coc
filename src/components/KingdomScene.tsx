import { CloudSky } from './CloudSky';

/**
 * The kingdom at night behind the home hero: moon, stars and clouds over an original SVG castle
 * with lit windows, torches at the gate, waving flags and rising embers. No game assets are used.
 */
export function KingdomScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <CloudSky />
      <div className="moon" />
      <svg className="absolute bottom-0 left-1/2 w-[1400px] max-w-none -translate-x-1/2 sm:w-full" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1430" />
            <stop offset="1" stopColor="#06080f" />
          </linearGradient>
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#16204a" />
            <stop offset="1" stopColor="#0a0f26" />
          </linearGradient>
          <radialGradient id="torch" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffb347" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Hill the castle stands on */}
        <path d="M0 360 L0 302 Q 300 238 600 276 T 1200 288 L 1200 360 Z" fill="url(#hill)" />
        {/* Winding path from the gate down the hill */}
        <path d="M600 278 C 590 300 620 318 596 340 L 584 360 L 616 360 L 604 340 C 626 318 610 300 600 278 Z" fill="#0a0e20" opacity="0.8" />

        {/* Back towers with cone roofs */}
        <g fill="url(#stone)" stroke="#22305a" strokeWidth="1.5">
          <rect x="330" y="170" width="56" height="132" />
          <polygon points="322,170 394,170 358,118" />
          <rect x="814" y="170" width="56" height="132" />
          <polygon points="806,170 878,170 842,118" />
        </g>

        {/* Curtain walls between the towers */}
        <g fill="url(#stone)" stroke="#22305a" strokeWidth="1.5">
          <rect x="386" y="215" width="44" height="88" />
          <rect x="770" y="215" width="44" height="88" />
        </g>

        {/* Side towers with battlements */}
        <g fill="url(#stone)" stroke="#22305a" strokeWidth="1.5">
          <rect x="430" y="200" width="64" height="112" />
          <rect x="424" y="188" width="76" height="14" />
          <rect x="424" y="178" width="10" height="10" />
          <rect x="440" y="178" width="10" height="10" />
          <rect x="456" y="178" width="10" height="10" />
          <rect x="472" y="178" width="10" height="10" />
          <rect x="488" y="178" width="10" height="10" />
          <rect x="706" y="200" width="64" height="112" />
          <rect x="700" y="188" width="76" height="14" />
          <rect x="700" y="178" width="10" height="10" />
          <rect x="716" y="178" width="10" height="10" />
          <rect x="732" y="178" width="10" height="10" />
          <rect x="748" y="178" width="10" height="10" />
          <rect x="764" y="178" width="10" height="10" />
        </g>

        {/* Keep with battlements and the gate */}
        <g fill="url(#stone)" stroke="#22305a" strokeWidth="1.5">
          <rect x="520" y="150" width="160" height="162" />
          <rect x="512" y="136" width="176" height="16" />
          <rect x="512" y="126" width="12" height="10" />
          <rect x="536" y="126" width="12" height="10" />
          <rect x="560" y="126" width="12" height="10" />
          <rect x="584" y="126" width="12" height="10" />
          <rect x="608" y="126" width="12" height="10" />
          <rect x="632" y="126" width="12" height="10" />
          <rect x="656" y="126" width="12" height="10" />
          <rect x="680" y="126" width="12" height="10" />
        </g>
        <path d="M586 278 v-32 a14 14 0 0 1 28 0 v32 Z" fill="#05070f" />
        <ellipse cx="600" cy="274" rx="26" ry="15" fill="url(#torch)" className="flicker f1" />
        <circle cx="558" cy="262" r="12" fill="url(#torch)" className="flicker f4" />
        <circle cx="642" cy="262" r="12" fill="url(#torch)" className="flicker f5" />

        {/* Lit windows */}
        <g fill="#ffd76a">
          <rect x="548" y="182" width="10" height="14" rx="2" className="flicker f2" />
          <rect x="642" y="182" width="10" height="14" rx="2" className="flicker f3" />
          <rect x="595" y="222" width="10" height="14" rx="2" className="flicker f4" />
          <rect x="457" y="228" width="9" height="12" rx="2" className="flicker f5" />
          <rect x="734" y="228" width="9" height="12" rx="2" className="flicker f2" />
          <rect x="353" y="205" width="8" height="11" rx="2" className="flicker f3" />
          <rect x="839" y="205" width="8" height="11" rx="2" className="flicker f4" />
        </g>

        {/* Flags on the keep and towers */}
        <g>
          <line x1="600" y1="136" x2="600" y2="96" stroke="#39415c" strokeWidth="3" />
          <polygon points="600,96 600,114 634,105" fill="#f0b429" className="flag" />
          <line x1="462" y1="178" x2="462" y2="146" stroke="#39415c" strokeWidth="2.5" />
          <polygon points="462,146 462,162 492,154" fill="#f0b429" className="flag" />
          <line x1="738" y1="178" x2="738" y2="146" stroke="#39415c" strokeWidth="2.5" />
          <polygon points="738,146 738,162 768,154" fill="#f0b429" className="flag" />
        </g>
      </svg>
      <span className="ember e1" />
      <span className="ember e2" />
      <span className="ember e3" />
      <span className="ember e4" />
      <span className="ember e5" />
    </div>
  );
}
