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
}

export const VENUES: Venue[] = [
  { id: 'b_evos', name: 'EVOS', img: require('../../assets/brand/venues/evos.webp'), badgeKind: 'promo', badgeValue: '1+1', type: 'promo' },
  { id: 'b_bellissimo', name: 'Bellissimo Pizza', img: require('../../assets/brand/venues/bellissimo.webp'), badgeKind: 'discount', badgeValue: '10%', type: 'discount' },
  { id: 'b_safia', name: 'Safia café', img: require('../../assets/brand/venues/safia.webp'), badgeKind: 'cashback', badgeValue: '×2', type: 'cashback' },
  { id: 'b_feedup', name: 'Feed Up', img: require('../../assets/brand/venues/feedup.webp'), badgeKind: 'promo', badgeValue: '2+1', type: 'promo' },
  { id: 'b_bon', name: 'Bon!', img: require('../../assets/brand/venues/bon.webp'), badgeKind: 'discount', badgeValue: '20%', type: 'discount' },
];
