// Сторона приложения: запуск/обновление/остановка Live Activity (§C18)
// и запись состояния для виджета (§C19).
//
// Swift, потому что ActivityKit — Swift-only API. Наружу торчит @objc-класс,
// который дёргает ObjC++ TurboModule (ZapLiveActivity.mm).
//
// Обновляем активность только пока приложение живо (события прилетают по
// вебсокету на SplitLiveScreen). Push-to-start и APNs-токены ActivityKit — это
// отдельная работа на бэкенде, и для «компания сидит за столом с открытым
// приложением» она не нужна.
import ActivityKit
import Foundation
import WidgetKit

@objc(ZapLiveActivityImpl)
public class ZapLiveActivityImpl: NSObject {

  /// Активности по splitId — чтобы update/end находили нужную.
  private static var live: [String: Any] = [:]

  @objc public static func isSupported() -> Bool {
    // Именно 16.2, а не 16.1: в 16.1 ещё нет ActivityContent, а старый
    // contentState-API объявлен устаревшим. Держать две ветки ради одной
    // минорной версии четырёхлетней давности не стоит.
    if #available(iOS 16.2, *) {
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }
    return false
  }

  @objc public static func start(
    _ splitId: String,
    merchant: String,
    amount: String,
    paid: Int,
    total: Int,
    pending: String
  ) {
    guard #available(iOS 16.2, *), isSupported() else { return }
    // повторный старт того же счёта — это обновление, а не вторая плашка
    if live[splitId] != nil {
      update(splitId, paid: paid, total: total, pending: pending)
      return
    }
    let attrs = ZapSplitAttributes(merchant: merchant, amount: amount)
    let state = ZapSplitAttributes.ContentState(paid: paid, total: total, pending: pending)
    do {
      let activity = try Activity.request(
        attributes: attrs,
        content: .init(state: state, staleDate: nil)
      )
      live[splitId] = activity
    } catch {
      // Отказ здесь не должен ронять оплату: Live Activity — украшение,
      // а не часть денежного сценария.
      NSLog("[ZAP] live activity start failed: \(error.localizedDescription)")
    }
  }

  @objc public static func update(_ splitId: String, paid: Int, total: Int, pending: String) {
    guard #available(iOS 16.2, *) else { return }
    guard let activity = live[splitId] as? Activity<ZapSplitAttributes> else { return }
    let state = ZapSplitAttributes.ContentState(paid: paid, total: total, pending: pending)
    Task { await activity.update(.init(state: state, staleDate: nil)) }
  }

  @objc public static func end(_ splitId: String) {
    guard #available(iOS 16.2, *) else { return }
    guard let activity = live[splitId] as? Activity<ZapSplitAttributes> else { return }
    live.removeValue(forKey: splitId)
    // .immediate — счёт закрыт, держать плашку на локскрине незачем
    Task { await activity.end(nil, dismissalPolicy: .immediate) }
  }

  @objc public static func setWidgetState(_ title: String, subtitle: String) {
    let d = UserDefaults(suiteName: ZapAppGroup)
    d?.set(title, forKey: ZapWidgetTitleKey)
    d?.set(subtitle, forKey: ZapWidgetSubtitleKey)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
