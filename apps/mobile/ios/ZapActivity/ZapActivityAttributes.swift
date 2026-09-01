// Описание Live Activity счёта (vision §C18).
//
// Файл входит В ОБА таргета — приложение запускает и обновляет активность,
// расширение её рисует. ActivityAttributes должен быть один и тот же тип,
// иначе система не свяжет запуск с виджетом.
import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct ZapSplitAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// сколько участников уже закрыли долю
    public var paid: Int
    /// сколько всего участников
    public var total: Int
    /// кого ждём; пустая строка — не ждём никого
    public var pending: String

    public init(paid: Int, total: Int, pending: String) {
      self.paid = paid
      self.total = total
      self.pending = pending
    }
  }

  /// заведение — «Bellissimo 🍕»
  public var merchant: String
  /// сумма счёта строкой: форматирование денег живёт в JS, дублировать его
  /// в Swift значило бы получить два разных формата в одном продукте
  public var amount: String

  public init(merchant: String, amount: String) {
    self.merchant = merchant
    self.amount = amount
  }
}

/// App Group — единственный способ передать данные в виджет домашнего экрана.
public let ZapAppGroup = "group.uz.zapapp.app"
public let ZapWidgetTitleKey = "widget.title"
public let ZapWidgetSubtitleKey = "widget.subtitle"
