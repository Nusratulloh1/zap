import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    /*
      Лаймовая подложка окна и корневого вида RN.

      Между исчезновением launch screen и первым кадром JS окно успевает
      показать свой фон — по умолчанию белый. На записи экрана это видно как
      вспышку «лайм → белый → лайм»: та самая склейка, ради устранения которой
      логотип и перенесён в storyboard. Красим окно в тот же лайм (#DDFF33),
      и зазор перестаёт быть заметным.
    */
    window?.backgroundColor = UIColor(red: 0.867, green: 1.0, blue: 0.2, alpha: 1)

    factory.startReactNative(
      withModuleName: "ZapMobile",
      in: window,
      launchOptions: launchOptions
    )
    window?.rootViewController?.view.backgroundColor = UIColor(
      red: 0.867, green: 1.0, blue: 0.2, alpha: 1
    )

    return true
  }

  // zap:// — открытие по кастомной схеме
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    RCTLinkingManager.application(app, open: url, options: options)
  }

  // https://zapapp.uz/s/... — универсальные ссылки
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
