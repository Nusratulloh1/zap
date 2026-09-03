// Заведения-партнёры с действующими предложениями.
//
// Список общий: по нему живёт и промо-карусель классической главной, и ряд
// «Где Zарабатывать» на новой. Условия лежат в локалях (`offers.*`), значок —
// в `badge.*`: скидка, акция или кэшбэк.
export type OfferType = 'cashback' | 'promo' | 'discount';

export interface Venue {
  id: string;
  name: string;
  /** фото зала для баннера */
  img: number;
  badgeKind: OfferType;
  badgeValue: string;
  type: OfferType;
  /*
    Плитка логотипа на витрине: у кого есть картинка — она на белом, у
    остальных фирменный цвет и короткое имя. Серый квадрат с буквой выглядел
    как «логотип не подгрузился».
  */
  logoBg?: string;
  logoFg?: string;
  abbr?: string;
}

/** Фирменная подложка логотипа по имени заведения — для витрины на главной. */
export function venuePlate(name: string): string | undefined {
  const low = name.toLowerCase();
  return VENUES.find((v) => low.includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(low))?.logoBg;
}

export const VENUES: Venue[] = [
  { id: 'b_evos', name: 'EVOS', img: require('../../assets/brand/venues/evos.webp'), badgeKind: 'promo', badgeValue: '1+1', type: 'promo', logoBg: '#2E9E3D', logoFg: '#FFFFFF', abbr: 'EVOS' },
  { id: 'b_bellissimo', name: 'Bellissimo Pizza', img: require('../../assets/brand/venues/bellissimo.webp'), badgeKind: 'discount', badgeValue: '10%', type: 'discount', logoBg: '#D9FF3A' },
  { id: 'b_safia', name: 'Safia café', img: require('../../assets/brand/venues/safia.webp'), badgeKind: 'cashback', badgeValue: '×2', type: 'cashback' },
  { id: 'b_feedup', name: 'Feed Up', img: require('../../assets/brand/venues/feedup.webp'), badgeKind: 'promo', badgeValue: '2+1', type: 'promo', logoBg: '#121212', logoFg: '#D9FF3A', abbr: 'feed up' },
  { id: 'b_bon', name: 'Bon!', img: require('../../assets/brand/venues/bon.webp'), badgeKind: 'discount', badgeValue: '20%', type: 'discount', logoBg: '#F0D24A', logoFg: '#121212', abbr: 'Bon!' },
];
