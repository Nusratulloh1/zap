// Расширение: Live Activity на локскрине и в Dynamic Island (§C18)
// плюс виджет домашнего экрана (§C19).
//
// Фирменные цвета захардкожены, а не тянутся из темы приложения: расширение
// живёт в отдельном процессе и до JS-темы не дотягивается. Это те же значения,
// что в theme/tokens.ts — ink #111110 и lime #DDFF33.
import ActivityKit
import SwiftUI
import WidgetKit

let zapInk = Color(red: 0x11 / 255, green: 0x11 / 255, blue: 0x10 / 255)
let zapLime = Color(red: 0xDD / 255, green: 0xFF / 255, blue: 0x33 / 255)

// MARK: - Live Activity

@available(iOS 16.1, *)
struct ZapSplitActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ZapSplitAttributes.self) { context in
      // экран блокировки
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text("ZAP · \(context.attributes.merchant)")
            .font(.system(size: 13, weight: .heavy))
            .foregroundColor(zapLime)
          Spacer()
          Text(context.attributes.amount)
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(.white.opacity(0.7))
        }
        Text("\(context.state.paid) of \(context.state.total) paid")
          .font(.system(size: 22, weight: .heavy))
          .foregroundColor(.white)
        ZapProgress(paid: context.state.paid, total: context.state.total)
        if !context.state.pending.isEmpty {
          // строка приходит из приложения уже локализованной и «с подколом»
          Text(context.state.pending)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.white.opacity(0.65))
        }
      }
      .padding(16)
      .activityBackgroundTint(zapInk)
      .activitySystemActionForegroundColor(zapLime)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text("⚡").font(.system(size: 22))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text("\(context.state.paid)/\(context.state.total)")
            .font(.system(size: 17, weight: .heavy))
            .foregroundColor(zapLime)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.merchant)
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(.white)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            ZapProgress(paid: context.state.paid, total: context.state.total)
            if !context.state.pending.isEmpty {
              Text(context.state.pending)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white.opacity(0.65))
            }
          }
        }
      } compactLeading: {
        Text("⚡").font(.system(size: 13))
      } compactTrailing: {
        Text("\(context.state.paid)/\(context.state.total)")
          .font(.system(size: 13, weight: .heavy))
          .foregroundColor(zapLime)
      } minimal: {
        Text("⚡").font(.system(size: 12))
      }
      .keylineTint(zapLime)
    }
  }
}

/// Полоска «3 из 4» — тот же язык, что и прогресс в приложении.
@available(iOS 16.1, *)
struct ZapProgress: View {
  let paid: Int
  let total: Int

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.white.opacity(0.22))
        Capsule()
          .fill(zapLime)
          .frame(width: total > 0 ? geo.size.width * CGFloat(paid) / CGFloat(total) : 0)
      }
    }
    .frame(height: 6)
  }
}

// MARK: - Виджет домашнего экрана (§C19)

struct ZapWidgetEntry: TimelineEntry {
  let date: Date
  let title: String
  let subtitle: String
}

/// Читает строки, которые приложение положило в App Group.
struct ZapWidgetProvider: TimelineProvider {
  private func read() -> ZapWidgetEntry {
    let d = UserDefaults(suiteName: ZapAppGroup)
    return ZapWidgetEntry(
      date: Date(),
      title: d?.string(forKey: ZapWidgetTitleKey) ?? "ZAP!",
      subtitle: d?.string(forKey: ZapWidgetSubtitleKey) ?? "Nothing owed ✓"
    )
  }

  func placeholder(in context: Context) -> ZapWidgetEntry {
    ZapWidgetEntry(date: Date(), title: "Friday Crew ⚡", subtitle: "Nothing owed ✓")
  }

  func getSnapshot(in context: Context, completion: @escaping (ZapWidgetEntry) -> Void) {
    completion(read())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ZapWidgetEntry>) -> Void) {
    // Обновляемся не по таймеру, а когда приложение вызовет reloadAllTimelines:
    // виджет отражает состояние счетов, а оно меняется не по расписанию.
    completion(Timeline(entries: [read()], policy: .never))
  }
}

struct ZapWidgetView: View {
  var entry: ZapWidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("⚡")
        .font(.system(size: 20))
      Spacer(minLength: 0)
      Text(entry.title)
        .font(.system(size: 15, weight: .heavy))
        .foregroundColor(.white)
        .lineLimit(2)
      Text(entry.subtitle)
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(zapLime)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(14)
  }
}

struct ZapWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZapWidget", provider: ZapWidgetProvider()) { entry in
      if #available(iOS 17.0, *) {
        ZapWidgetView(entry: entry).containerBackground(zapInk, for: .widget)
      } else {
        ZapWidgetView(entry: entry).background(zapInk)
      }
    }
    .configurationDisplayName("ZAP!")
    .description("Кто ещё не закрыл счёт.")
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - Точка входа

// Минимальная версия самого расширения — 16.1 (см. add_widget_target.rb),
// поэтому проверка доступности здесь не нужна: на iOS 15 расширение просто
// не установится, а приложение продолжит работать.
//
// ZapWidget (§C19) НЕ зарегистрирован намеренно. Виджет домашнего экрана
// читает данные через App Group, а capability «App Groups» не заведена в
// аккаунте Apple — автоподпись из-за неё роняет сборку обоих таргетов.
// Показывать в галерее виджет, который всегда пишет одно и то же, хуже, чем
// не показывать вовсе. Что нужно сделать, чтобы включить, — см. docs/RELEASE.md.
@main
struct ZapActivityBundle: WidgetBundle {
  var body: some Widget {
    ZapSplitActivity()
  }
}
