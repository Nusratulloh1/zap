<script setup lang="ts">
// Экраны приложения внутри «телефона» на лендинге.
//
// Почему не скриншоты: в макете экран собирается на глазах — блоки выезжают
// сверху вниз, крупная сумма набегает счётчиком. Картинке такое не сделать,
// поэтому экраны живут разметкой. ПРЯМЫЕ ДЕТИ корня — это те самые «блоки»,
// которые анимирует LandingPage (см. [data-screen] там).
//
// Тексты интерфейса идут через t(): на узбекском лендинге в телефоне должен
// быть узбекский интерфейс. Данные (имена, позиции чека, суммы) остаются как
// в демо-сборке — они и в приложении не переводятся.
import { useI18n } from 'vue-i18n'

import avatarMe from '@/assets/brand/avatars/a12.png'
import avatarAli from '@/assets/brand/avatars/a33.png'
import avatarBek from '@/assets/brand/avatars/a68.png'
import avatarAziz from '@/assets/brand/avatars/a11.png'
import avatarTimur from '@/assets/brand/avatars/a15.png'
import avatarMadina from '@/assets/brand/avatars/a47.png'
import bellissimo from '@/assets/brand/partners/bellissimo-logo.png'
import mysoliq from '@/assets/brand/partners/mysoliq.svg'
import rahmat from '@/assets/brand/partners/rahmat.svg'

defineProps<{ kind: string }>()

const { t } = useI18n()
const people = (n: number) => t('common.people', n, { named: { n } })
</script>

<template>
  <!-- 01 · СКАН -->
  <div v-if="kind === 'scan'" class="scr scr--dark">
    <div class="scr-cam" />
    <div class="scr-scrim-top" />
    <div class="scr-topbar">
      <span class="scr-round"
        ><svg width="17" height="17" viewBox="0 0 18 18" fill="none">
          <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" /></svg
      ></span>
      <span class="scr-seg">
        <span class="is-on">{{ t('scan.tabScan') }}</span>
        <span>{{ t('scan.tabPhoto') }}</span>
      </span>
      <span class="scr-round"
        ><svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L5 13H11L9 22L19 10H12.5L13 2Z" stroke="#FFF" stroke-width="1.8" stroke-linejoin="round" /></svg
      ></span>
    </div>
    <div class="scr-frame">
      <svg width="232" height="232" viewBox="0 0 232 232" fill="none">
        <path d="M6 54V22C6 13.2 13.2 6 22 6H54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
        <path d="M178 6H210C218.8 6 226 13.2 226 22V54" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
        <path d="M226 178V210C226 218.8 218.8 226 210 226H178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
        <path d="M54 226H22C13.2 226 6 218.8 6 210V178" stroke="#DDFF33" stroke-width="5" stroke-linecap="round" />
      </svg>
      <span class="scr-laser" />
    </div>
    <div class="scr-bottom">
      <div class="scr-cap">{{ t('scan.aimAtQr') }}</div>
      <div class="scr-sources">
        <span><img :src="mysoliq" alt="" /><b>MySoliq</b></span>
        <span><img :src="rahmat" alt="Rahmat" /></span>
      </div>
      <div class="scr-manual">{{ t('scan.manual') }}</div>
    </div>
  </div>

  <!-- 02 · ЧЕК -->
  <div v-else-if="kind === 'bill'" class="scr scr--pad20">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-merchant">
      <img :src="bellissimo" alt="" />
      <div class="scr-h2">Bellissimo Pizza</div>
      <div class="scr-mono-xs">{{ t('bill.orderTable', { order: '481', table: '12', time: '21:42' }) }}</div>
    </div>
    <div class="scr-dashed" />
    <div class="scr-items">
      <div><span>Пицца Пепперони ×2</span><b>380 000</b></div>
      <div><span>Паста Карбонара</span><b>320 000</b></div>
      <div><span>Лимонад ×4</span><b>200 000</b></div>
      <div><span>Тирамису ×3</span><b>300 000</b></div>
    </div>
    <div class="scr-dashed" />
    <div class="scr-total">
      <span>{{ t('bill.totalRow') }}</span>
      <span><b data-count="1200000">1 200 000</b><i>UZS</i></span>
    </div>
    <div class="scr-promo">{{ t('bill.x2Banner') }}</div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--lime">{{ t('bill.split') }}</div>
      <div class="scr-btn scr-btn--sand">{{ t('bill.payWhole') }}</div>
    </div>
  </div>

  <!-- 03 · ДЕЛЕНИЕ -->
  <div v-else-if="kind === 'members'" class="scr">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-h1">{{ t('members.title') }}</div>
    <div class="scr-amount"><b data-count="1200000">1 200 000</b><i>UZS</i></div>
    <div class="scr-field"><span>{{ t('members.forWhat') }}</span><b>Ужин пятница 🍕</b></div>
    <div class="scr-hint">{{ t('members.perPerson', { amount: '400 000' }) }}</div>
    <div class="scr-chips">
      <span class="is-on">{{ t('members.modeEqual') }}</span>
      <span>{{ t('members.modeManual') }}</span>
      <span>{{ t('members.modeItems') }}</span>
    </div>
    <div class="scr-rows">
      <div class="scr-row">
        <img :src="avatarMe" alt="" />
        <div><b>Ислам{{ t('members.youSuffix') }}</b><span>{{ t('members.youPayNow') }}</span></div>
        <b>400 000</b>
      </div>
      <div class="scr-row">
        <img :src="avatarAli" alt="" />
        <div><b>Али</b><span>{{ t('members.viaSmsWithHandle', { handle: '@ali' }) }}</span></div>
        <b>400 000</b>
      </div>
      <div class="scr-row">
        <img :src="avatarBek" alt="" class="is-grey" />
        <div><b>Бек</b><span>{{ t('members.debtNote') }}</span></div>
        <span class="scr-debt">{{ t('members.debtToggle') }}</span>
      </div>
    </div>
    <div class="scr-addhead"><span>{{ t('members.addContacts') }}</span><b>{{ t('members.allContacts') }}</b></div>
    <div class="scr-add">
      <span><img :src="avatarAziz" alt="" /><b>Азиз</b></span>
      <span><img :src="avatarTimur" alt="" /><b>Тимур</b></span>
      <span><img :src="avatarMadina" alt="" /><b>Мадина</b></span>
      <span><i class="scr-plus">+</i><b>{{ t('members.numberLabel') }}</b></span>
    </div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--lime">{{ t('members.ctaSplit', { amount: '800 000' }) }}</div>
      <div class="scr-sub">{{ t('members.ctaSubDebt', { mine: '400 000', name: 'Бек', amount: '400 000' }) }}</div>
    </div>
  </div>

  <!-- 04 · ДОЛИ -->
  <div v-else-if="kind === 'debts'" class="scr">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-h1">{{ t('debts.title') }}</div>
    <div class="scr-amount"><b data-count="633000">633 000</b><i>UZS · {{ people(3) }}</i></div>
    <div class="scr-chips">
      <span class="is-on">{{ t('debts.tabOwedToMe') }}</span>
      <span>{{ t('debts.iOweZero') }}</span>
    </div>
    <div class="scr-rows">
      <div class="scr-row scr-row--tall">
        <img :src="avatarBek" alt="" />
        <div><b>Бек</b><span>Bellissimo · {{ t('debts.remind') }}</span></div>
        <div class="scr-right"><b>400 000</b><span class="scr-remind">{{ t('debts.remind') }}</span></div>
      </div>
      <div class="scr-row scr-row--tall">
        <img :src="avatarAziz" alt="" />
        <div><b>Азиз</b><span>Yandex Go</span></div>
        <div class="scr-right"><b>193 000</b><span class="scr-note">{{ t('debts.promised') }}</span></div>
      </div>
      <div class="scr-row scr-row--tall">
        <img :src="avatarMadina" alt="" />
        <div><b>Мадина</b><span>Кино</span></div>
        <div class="scr-right"><b>40 000</b><span class="scr-remind">{{ t('debts.remind') }}</span></div>
      </div>
    </div>
    <div class="scr-note-long">{{ t('debts.autoNoteLong') }}</div>
    <div class="scr-grow" />
    <div class="scr-cta"><div class="scr-btn scr-btn--lime">{{ t('debts.remindAll') }}</div></div>
  </div>

  <!-- 05 · ССЫЛКА -->
  <div v-else-if="kind === 'share'" class="scr">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-h1 scr-h1--sm">{{ t('share.title') }}</div>
    <div class="scr-hint">{{ t('share.subtitleWithOrder', { merchant: 'Bellissimo Pizza', order: '481', amount: '400 000' }) }}</div>
    <div class="scr-qr">
      <svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 25 25" shape-rendering="crispEdges">
        <path fill="#F7F5F0" d="M0 0h25v25H0z" />
        <path
          stroke="#111110"
          d="M0 0.5h7m2 0h2m1 0h1m2 0h2m1 0h7M0 1.5h1m5 0h1m3 0h1m2 0h3m2 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h1m1 0h6m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h1m6 0h1m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h1m3 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h6m1 0h2m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h3m1 0h1m1 0h1M0 8.5h1m1 0h5m2 0h1m3 0h1m1 0h2m1 0h5M2 9.5h1m2 0h1m1 0h1m1 0h2m2 0h1m2 0h1m2 0h1m3 0h1M0 10.5h3m1 0h4m1 0h1m4 0h3m1 0h1m1 0h2m1 0h2M2 11.5h2m1 0h1m3 0h1m1 0h1m2 0h1m1 0h3m1 0h1m3 0h1M1 12.5h2m3 0h1m1 0h1m1 0h1m2 0h1m3 0h4m1 0h3M0 13.5h5m7 0h3m2 0h1m1 0h1m1 0h1M0 14.5h1m1 0h1m2 0h2m1 0h1m1 0h1m3 0h2m2 0h4m1 0h2M0 15.5h1m1 0h1m1 0h1m2 0h4m1 0h1m1 0h1m3 0h3m3 0h1M0 16.5h1m1 0h2m1 0h2m5 0h1m3 0h5m1 0h1M8 17.5h3m3 0h1m1 0h1m3 0h2M0 18.5h7m2 0h5m2 0h1m1 0h1m1 0h1m1 0h3M0 19.5h1m5 0h1m1 0h1m2 0h1m4 0h1m3 0h2m2 0h1M0 20.5h1m1 0h3m1 0h1m1 0h1m1 0h11m1 0h1m1 0h1M0 21.5h1m1 0h3m1 0h1m1 0h2m2 0h1m5 0h1m1 0h5M0 22.5h1m1 0h3m1 0h1m1 0h3m1 0h3m6 0h2m1 0h1M0 23.5h1m5 0h1m2 0h2m1 0h1m3 0h2m1 0h3m2 0h1M0 24.5h7m1 0h2m2 0h1m6 0h6"
        />
      </svg>
    </div>
    <div class="scr-link">use.zapapp.uz/s/481-FRD</div>
    <div class="scr-status">
      <span class="scr-stack"><img :src="avatarMe" alt="" /><img :src="avatarAli" alt="" /><img :src="avatarBek" alt="" /></span>
      <span>{{ t('share.statusPaidWaiting', { names: 'Али и Бек' }) }}</span>
    </div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--lime">
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="4" width="16" height="12" rx="3" stroke="#111110" stroke-width="1.8" />
          <path d="M2.5 6.5L10 11L17.5 6.5" stroke="#111110" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
        {{ t('share.sendSms') }}
      </div>
      <div class="scr-btn scr-btn--sand">{{ t('common.copy') }}</div>
      <div class="scr-sub">{{ t('share.toStatusArrow') }}</div>
    </div>
  </div>

  <!-- 06 · УЧАСТНИК -->
  <div v-else-if="kind === 'participant'" class="scr">
    <div class="scr-asks">
      <span class="scr-ava-ink">И</span>
      <span>{{ t('participant.asks', { name: 'Ислам' }) }}</span>
    </div>
    <div class="scr-h1 scr-h1--sm">Ужин пятница 🍕</div>
    <div class="scr-hint">{{ t('participant.orderNo', { no: '481' }) }}{{ people(3) }}</div>
    <div class="scr-amount"><b data-count="400000">400 000</b><i>{{ t('participant.yourShare') }}</i></div>
    <div class="scr-mono-label">{{ t('participant.payNowLabel') }}</div>
    <div class="scr-grid">
      <span class="is-on"><b>400 000</b><i>{{ t('participant.chipMine') }}</i></span>
      <span><b>200 000</b><i>{{ t('participant.chipHalf') }}</i></span>
      <span><b>800 000</b><i>{{ t('participant.chipTwo') }}</i></span>
      <span><b>100 000</b></span>
      <span><b>250 000</b></span>
      <span><b>···</b></span>
    </div>
    <div class="scr-status scr-status--dot"><i /><span>{{ t('participant.hint') }}</span></div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--lime">{{ t('participant.pay', { amount: '400 000' }) }}</div>
      <div class="scr-btn scr-btn--sand">{{ t('participant.later') }}</div>
    </div>
  </div>

  <!-- 07 · СТАТУС -->
  <div v-else-if="kind === 'live'" class="scr scr--pad20">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-liveHead">
      <span class="scr-hint">Bellissimo Pizza{{ t('live.orderNo', { no: '481' }) }}</span>
      <b data-count="800000">800 000</b>
      <span class="scr-hint">{{ t('live.paidOfTotal', { total: '1 200 000' }) }}</span>
      <span class="scr-bar"><i /><em /></span>
    </div>
    <div class="scr-rows">
      <div class="scr-row">
        <img :src="avatarMe" alt="" />
        <div><b>Ислам{{ t('live.youSuffix') }}</b><span>400 000</span></div>
        <span class="scr-done">✓ {{ t('live.statusPaid') }}</span>
      </div>
      <div class="scr-row">
        <img :src="avatarAli" alt="" class="is-grey" />
        <div><b>Али</b><span>400 000{{ t('live.openedLink') }}</span></div>
        <span class="scr-wait">{{ t('live.statusWaiting') }}</span>
      </div>
      <div class="scr-row">
        <img :src="avatarBek" alt="" />
        <div><b>Бек</b><span>400 000{{ t('live.debtCovered') }}</span></div>
        <span class="scr-done">✓ {{ t('live.debtBadge') }}</span>
      </div>
    </div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--ink">{{ t('live.remind', { name: 'Али' }) }}</div>
      <div class="scr-btn scr-btn--sand">{{ t('live.coverRest', { amount: '400 000' }) }}</div>
    </div>
  </div>

  <!-- 08 · КЭШБЭК -->
  <div v-else class="scr">
    <div class="scr-back">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="scr-awardHead">
      <img :src="bellissimo" alt="" />
      <div class="scr-h1 scr-h1--sm">{{ t('cashbackAward.title') }}</div>
      <div class="scr-hint">Bellissimo Pizza{{ t('live.orderNo', { no: '481' }) }} · Friday Crew</div>
      <div class="scr-amount"><b data-count="60000" data-prefix="+">+60 000</b><i>UZS</i></div>
      <div class="scr-badge">{{ t('cashbackAward.reasonThree') }}</div>
    </div>
    <div class="scr-rows scr-rows--top">
      <div class="scr-row">
        <img :src="avatarMe" alt="" />
        <div><b>Ислам{{ t('live.youSuffix') }}</b></div>
        <b>+20 000</b>
      </div>
      <div class="scr-row">
        <img :src="avatarAli" alt="" />
        <div><b>Али</b><span>{{ t('cashbackAward.afterDebt') }}</span></div>
        <b class="is-faint">+20 000</b>
      </div>
      <div class="scr-row">
        <img :src="avatarBek" alt="" />
        <div><b>Бек</b><span>{{ t('cashbackAward.afterDebt') }}</span></div>
        <b class="is-faint">+20 000</b>
      </div>
    </div>
    <div class="scr-groupTotal">
      <span>{{ t('cashbackAward.groupTotalLabel', { name: 'Friday Crew' }) }}</span><b>205 000</b>
    </div>
    <div class="scr-grow" />
    <div class="scr-cta">
      <div class="scr-btn scr-btn--lime">{{ t('cashbackAward.spend') }}</div>
      <div class="scr-btn scr-btn--sand">{{ t('cashbackAward.keep') }}</div>
    </div>
  </div>
</template>

<style scoped>
/* Экран телефона — фиксированные 390×844: внутри лендинга он масштабируется
   целиком, поэтому размеры здесь абсолютные, как в приложении. */
.scr {
  position: absolute;
  inset: 0;
  width: 390px;
  height: 844px;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 40px;
  background: #fff;
  color: #111110;
  font-family: 'Manrope', Helvetica, Arial, sans-serif;
  overflow: hidden;
}
.scr--pad20 {
  padding-left: 20px;
  padding-right: 20px;
}
.scr-grow {
  flex: 1;
}

/* --- общие элементы --- */
.scr-back {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  width: 44px;
  border-radius: 999px;
  background: #f5f3ee;
  flex: 0 0 auto;
}
.scr-h1 {
  margin-top: 24px;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.scr-h1--sm {
  font-size: 25px;
  margin-top: 22px;
}
.scr-h2 {
  font-size: 19px;
  font-weight: 800;
}
.scr-hint {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #8a887e;
}
.scr-amount {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 12px;
}
.scr-amount b {
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
}
.scr-amount i {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
  color: #a3a199;
}
.scr-mono-xs {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #a3a199;
}
.scr-mono-label {
  margin-top: 26px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #a3a199;
}
.scr-chips {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
.scr-chips span {
  display: flex;
  align-items: center;
  height: 38px;
  border-radius: 999px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  background: #f5f3ee;
  color: #5b594f;
}
.scr-chips span.is-on {
  background: #ddff33;
  color: #111110;
  font-weight: 800;
}
.scr-rows {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
}
.scr-rows--top {
  margin-top: 22px;
  border-top: 1px solid #f0eee8;
}
.scr-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  border-bottom: 1px solid #f0eee8;
}
.scr-row--tall {
  min-height: 74px;
}
.scr-row:last-child {
  border-bottom: none;
}
.scr-row img {
  height: 44px;
  width: 44px;
  border-radius: 999px;
  object-fit: cover;
  flex: 0 0 auto;
}
.scr-row img.is-grey {
  filter: grayscale(1);
}
.scr-row > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.scr-row b {
  font-size: 15.5px;
  font-weight: 700;
}
.scr-row span {
  font-size: 12px;
  font-weight: 600;
  color: #b3b1a8;
}
.scr-row > b {
  font-size: 16px;
  font-weight: 800;
  flex: 0 0 auto;
}
.scr-row > b.is-faint {
  color: #b3b1a8;
}
.scr-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex: 0 0 auto;
}
.scr-right b {
  font-size: 16px;
  font-weight: 800;
}
.scr-remind,
.scr-note {
  display: flex;
  align-items: center;
  height: 28px;
  border-radius: 999px;
  padding: 0 11px;
  font-size: 11.5px;
  font-weight: 700;
}
.scr-remind {
  background: #111110;
  color: #ddff33;
}
.scr-note {
  background: #f5f3ee;
  color: #8a887e;
}
.scr-debt {
  display: flex;
  align-items: center;
  height: 30px;
  border-radius: 999px;
  background: #111110;
  padding: 0 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ddff33;
  flex: 0 0 auto;
}
.scr-done,
.scr-wait {
  display: flex;
  align-items: center;
  height: 30px;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  flex: 0 0 auto;
}
.scr-done {
  background: #111110;
  color: #fff;
}
.scr-wait {
  background: #eceae2;
  color: #8a887e;
}
.scr-cta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scr-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 56px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 800;
}
.scr-btn--lime {
  background: #ddff33;
  color: #111110;
}
.scr-btn--sand {
  background: #f5f3ee;
  color: #111110;
  font-weight: 700;
}
.scr-btn--ink {
  background: #111110;
  color: #fff;
}
.scr-sub {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #8a887e;
}

/* --- 01 сканер --- */
.scr--dark {
  background: #151513;
  color: #fff;
  padding: 12px 16px 28px;
}
.scr-cam {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 80% at 50% 42%, #3a3833 0%, #211f1b 55%, #121110 100%);
}
.scr-scrim-top {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 180px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75), transparent);
}
.scr-topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.scr-round {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.3);
  flex: 0 0 auto;
}
.scr-seg {
  display: flex;
  margin: 0 auto;
  height: 40px;
  width: 220px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.35);
  padding: 4px;
}
.scr-seg span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  flex: 1;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
}
.scr-seg span.is-on {
  background: #ddff33;
  color: #111110;
}
.scr-frame {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scr-laser {
  position: absolute;
  left: calc(50% - 94px);
  width: 188px;
  height: 3px;
  border-radius: 999px;
  background: rgba(221, 255, 51, 0.6);
  box-shadow: 0 0 18px rgba(221, 255, 51, 0.5);
}
.scr-bottom {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.scr-cap {
  font-size: 15px;
  font-weight: 600;
}
.scr-sources {
  display: flex;
  gap: 8px;
}
.scr-sources span {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  padding: 0 12px;
}
.scr-sources img {
  height: 16px;
  width: auto;
}
.scr-sources b {
  font-size: 11.5px;
  font-weight: 700;
  color: #364ba8;
}
.scr-manual {
  font-size: 13.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
}

/* --- 02 чек --- */
.scr-merchant {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.scr-merchant img {
  height: 76px;
  width: 76px;
  object-fit: contain;
  margin-left: -8px;
}
.scr-dashed {
  margin-top: 14px;
  border-top: 2px dashed #e8e6de;
}
.scr-items {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
}
.scr-items div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
}
.scr-items span {
  font-size: 14px;
  font-weight: 600;
}
.scr-items b {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  font-weight: 700;
}
.scr-total {
  margin-top: 14px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 800;
}
.scr-total b {
  font-size: 19px;
  letter-spacing: -0.01em;
}
.scr-total i {
  margin-left: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-style: normal;
  color: #a3a199;
}
.scr-promo {
  margin-top: 12px;
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 999px;
  background: #f7f5f0;
  padding: 0 14px;
  font-size: 12.5px;
  font-weight: 700;
}

/* --- 03 участники --- */
.scr-field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  border-bottom: 2px solid #ddff33;
  padding-bottom: 10px;
}
.scr-field span {
  font-size: 15.5px;
  font-weight: 800;
  color: #8a887e;
}
.scr-field b {
  font-size: 16px;
  font-weight: 700;
}
.scr-addhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 20px;
}
.scr-addhead span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #a3a199;
}
.scr-addhead b {
  font-size: 13px;
  font-weight: 700;
  color: #8a887e;
}
.scr-add {
  display: flex;
  gap: 14px;
  margin-top: 14px;
}
.scr-add span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.scr-add img {
  height: 52px;
  width: 52px;
  border-radius: 999px;
  object-fit: cover;
}
.scr-add b {
  font-size: 11.5px;
  font-weight: 700;
}
.scr-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  width: 52px;
  border-radius: 999px;
  background: #f5f3ee;
  font-size: 22px;
  font-style: normal;
  color: #a3a199;
}

/* --- 04 долги --- */
.scr-note-long {
  margin-top: 18px;
  border-top: 1px solid #f0eee8;
  padding-top: 16px;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.45;
  color: #8a887e;
}

/* --- 05 ссылка --- */
.scr-qr {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
.scr-qr svg {
  border-radius: 26px;
  background: #f7f5f0;
  padding: 16px;
  box-sizing: content-box;
}
.scr-link {
  margin-top: 12px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #a3a199;
}
.scr-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 12.5px;
  font-weight: 600;
  color: #8a887e;
}
.scr-stack {
  display: flex;
}
.scr-stack img {
  height: 34px;
  width: 34px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid #fff;
}
.scr-stack img + img {
  margin-left: -10px;
}
.scr-status--dot i {
  height: 9px;
  width: 9px;
  border-radius: 999px;
  border: 2px solid #111110;
  background: #ddff33;
  flex: 0 0 auto;
}

/* --- 06 участник --- */
.scr-asks {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 26px;
  font-size: 13.5px;
  font-weight: 600;
  color: #8a887e;
}
.scr-ava-ink {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  border-radius: 999px;
  background: #111110;
  font-size: 14px;
  font-weight: 800;
  color: #ddff33;
  flex: 0 0 auto;
}
.scr-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.scr-grid span {
  display: flex;
  height: 62px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 18px;
  background: #f5f3ee;
}
.scr-grid span.is-on {
  background: none;
  border: 2px solid #ddff33;
}
.scr-grid b {
  font-size: 15px;
  font-weight: 800;
}
.scr-grid i {
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
  color: #8a887e;
}

/* --- 07 статус --- */
.scr-liveHead {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 26px;
}
.scr-liveHead > b {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
}
.scr-bar {
  display: flex;
  align-items: center;
  height: 10px;
  width: 100%;
  border-radius: 999px;
  background: #eceae2;
  margin-top: 12px;
}
.scr-bar i {
  height: 10px;
  width: 66.7%;
  border-radius: 999px;
  background: #ddff33;
}
.scr-bar em {
  height: 10px;
  width: 10px;
  border-radius: 999px;
  background: #111110;
  margin-left: -5px;
}

/* --- 08 кэшбэк --- */
.scr-awardHead {
  margin-top: 26px;
}
.scr-awardHead img {
  height: 68px;
  width: 68px;
  object-fit: contain;
  margin-left: -6px;
}
.scr-badge {
  margin-top: 12px;
  display: flex;
  align-items: center;
  height: 34px;
  width: fit-content;
  border-radius: 999px;
  background: #ddff33;
  padding: 0 14px;
  font-size: 12.5px;
  font-weight: 800;
}
.scr-groupTotal {
  margin-top: 18px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.scr-groupTotal span {
  font-size: 14.5px;
  font-weight: 700;
  color: #8a887e;
}
.scr-groupTotal b {
  font-size: 19px;
  font-weight: 800;
}
</style>
