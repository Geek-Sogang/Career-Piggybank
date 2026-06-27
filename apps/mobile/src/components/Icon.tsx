import Svg, { Path, Rect, Circle } from 'react-native-svg';

type Props = { name: IconName; size?: number; color?: string; sw?: number };

export type IconName =
  | 'bell' | 'chevronRight' | 'chevronLeft' | 'download' | 'trending' | 'cardPig'
  | 'github' | 'card' | 'building' | 'plus' | 'check' | 'shield' | 'cardLink'
  | 'gear' | 'tabHome' | 'tabPiggy' | 'tabLedger' | 'tabMy' | 'docRow' | 'houseSmall';

/** 디자인 소스의 인라인 SVG를 react-native-svg로 1:1 포팅. */
export function Icon({ name, size = 24, color = '#1A1A1A', sw = 1.9 }: Props) {
  const s = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const V = (children: React.ReactNode, vb = '0 0 24 24') => (
    <Svg width={size} height={size} viewBox={vb}>{children}</Svg>
  );
  switch (name) {
    case 'bell':
      return V(<><Path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.6 5.5 1.6 5.5H4.9s1.6-1.5 1.6-5.5Z" {...s} /><Path d="M10 18.5a2 2 0 0 0 4 0" {...s} /></>);
    case 'chevronRight':
      return V(<Path d="m9 5 7 7-7 7" {...s} strokeWidth={sw || 2.2} />);
    case 'chevronLeft':
      return V(<Path d="m15 5-7 7 7 7" {...s} strokeWidth={sw || 2} />);
    case 'download':
      return V(<><Path d="M12 4v10" {...s} /><Path d="m8 10 4 4 4-4" {...s} /><Path d="M5 19h14" {...s} /></>);
    case 'trending':
      return V(<><Path d="m4 15 5-5 3 3 7-8" {...s} /><Path d="M16 5h4v4" {...s} /></>);
    case 'cardPig':
      return V(<><Rect x={3} y={7} width={18} height={12} rx={3} {...s} /><Path d="M16 12h2" {...s} /><Path d="M3 10h18" {...s} /></>);
    case 'card':
      return V(<><Rect x={3} y={5} width={18} height={14} rx={2.5} {...s} /><Path d="M3 10h18" {...s} /><Path d="M7 15h4" {...s} /></>);
    case 'building':
      return V(<><Path d="M5 21V7l7-4 7 4v14" {...s} /><Path d="M9 21v-6h6v6" {...s} /><Path d="M9 11h.01M15 11h.01" {...s} /></>);
    case 'houseSmall':
      return V(<Path d="M5 21V7l7-4 7 4v14" {...s} strokeWidth={2} />);
    case 'docRow':
      return V(<><Path d="M3 7h18v10H3z" {...s} strokeWidth={2} /><Path d="M3 11h18" {...s} strokeWidth={2} /></>);
    case 'plus':
      return V(<Path d="M12 5v14M5 12h14" {...s} strokeWidth={sw || 2.2} />);
    case 'check':
      return V(<Path d="m5 12.5 4.5 4.5L19 7" {...s} strokeWidth={sw || 2.4} />);
    case 'shield':
      return V(<Path d="M12 3 4 6v6c0 4 3.4 7.5 8 9 4.6-1.5 8-5 8-9V6Z" {...s} strokeWidth={1.8} />);
    case 'cardLink':
      return V(<><Rect x={3} y={6} width={18} height={13} rx={3} {...s} strokeWidth={1.8} /><Path d="M3 10h18" {...s} strokeWidth={1.8} /></>);
    case 'gear':
      return V(<><Circle cx={12} cy={12} r={3} {...s} strokeWidth={1.8} /><Path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z" {...s} strokeWidth={1.8} /></>);
    case 'tabHome':
      return V(<><Path d="M4 11.5 12 5l8 6.5" {...s} /><Path d="M6 10v9.5a.5.5 0 0 0 .5.5H9.5v-5.5h5V20h3a.5.5 0 0 0 .5-.5V10" {...s} /></>);
    case 'tabPiggy':
      return V(<><Rect x={3.5} y={5} width={17} height={14} rx={3} {...s} /><Circle cx={11} cy={12} r={3} {...s} /><Path d="M11 12h2.4" {...s} /><Path d="M6.5 19v1.4M15.5 19v1.4" {...s} /></>);
    case 'tabLedger':
      return V(<><Rect x={5} y={3.5} width={14} height={17} rx={2.5} {...s} /><Path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" {...s} /></>);
    case 'tabMy':
      return V(<><Circle cx={12} cy={8} r={3.4} {...s} /><Path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" {...s} /></>);
    case 'github':
      return V(<Path fill={color} d="M12 2C6.5 2 2 6.6 2 12.3c0 4.5 2.9 8.3 6.8 9.7.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 1.6-.4 3.3-.4 4.9 0 1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.4 6.8-5.2 6.8-9.7C22 6.6 17.5 2 12 2Z" />);
    default:
      return null;
  }
}
