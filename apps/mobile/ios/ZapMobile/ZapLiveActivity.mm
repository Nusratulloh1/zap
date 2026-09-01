// Реализация TurboModule для Live Activity.
//
// Форма ровно как у пропатченного react-native-change-icon: спека-протокол из
// кодогенерации + getTurboModule:. В bridgeless-режиме RN 0.87 легаси-модуль
// сюда не годится — он попадает в интероп-слой и молча не находится из JS.
#import "ZapLiveActivity.h"

// ВАЖЕН ПОРЯДОК. ZapMobile-Swift.h — общий заголовок всего Swift-кода таргета,
// включая ReactNativeDelegate из AppDelegate.swift. Его суперкласс
// RCTDefaultReactNativeFactoryDelegate живёт в React-RCTAppDelegate, и без
// этого импорта компилятор спотыкается на чужом классе, а не на нашем.
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "ZapMobile-Swift.h"

#import <ZapMobileSpec/ZapMobileSpec.h>

@interface ZapLiveActivity () <NativeZapLiveActivitySpec>
@end

@implementation ZapLiveActivity

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSNumber *)isSupported
{
  return @([ZapLiveActivityImpl isSupported]);
}

- (void)start:(NSString *)splitId
     merchant:(NSString *)merchant
       amount:(NSString *)amount
         paid:(double)paid
        total:(double)total
      pending:(NSString *)pending
{
  [ZapLiveActivityImpl start:splitId
                    merchant:merchant
                      amount:amount
                        paid:(NSInteger)paid
                       total:(NSInteger)total
                     pending:pending];
}

- (void)update:(NSString *)splitId paid:(double)paid total:(double)total pending:(NSString *)pending
{
  [ZapLiveActivityImpl update:splitId paid:(NSInteger)paid total:(NSInteger)total pending:pending];
}

- (void)end:(NSString *)splitId
{
  [ZapLiveActivityImpl end:splitId];
}

- (void)setWidgetState:(NSString *)title subtitle:(NSString *)subtitle
{
  [ZapLiveActivityImpl setWidgetState:title subtitle:subtitle];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeZapLiveActivitySpecJSI>(params);
}

@end
