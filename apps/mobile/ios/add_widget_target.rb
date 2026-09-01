# Добавляет таргет расширения ZapActivity (Live Activity §C18 + виджет §C19).
#
# Руками через Xcode это делается мастером «File → New → Target → Widget
# Extension»; здесь то же самое программно, чтобы проект собирался с чистого
# клона и не зависел от того, кто и как нажимал кнопки.
#
# Скрипт идемпотентный: если таргет уже есть — выходит, ничего не трогая.
require 'xcodeproj'

PROJECT = File.expand_path('ZapMobile.xcodeproj', __dir__)
TARGET_NAME = 'ZapActivity'
APP_NAME = 'ZapMobile'
APP_BUNDLE_ID = 'uz.zapapp.app'
TEAM = '9QCQW78H54'

project = Xcodeproj::Project.open(PROJECT)

if project.targets.any? { |t| t.name == TARGET_NAME }
  puts "#{TARGET_NAME}: таргет уже есть, пропускаю"
  exit 0
end

app = project.targets.find { |t| t.name == APP_NAME } or abort "не нашёл таргет #{APP_NAME}"

target = project.new_target(
  :app_extension,
  TARGET_NAME,
  :ios,
  # ActivityKit появился в 16.1; само приложение остаётся на 15.1, расширение
  # просто не установится на более старые версии — это штатное поведение
  '16.1'
)

group = project.new_group(TARGET_NAME, TARGET_NAME)
%w[ZapActivityAttributes.swift ZapActivityBundle.swift].each do |name|
  file = group.new_reference(name)
  target.add_file_references([file])
  # Attributes нужен обоим: приложение запускает активность, расширение рисует
  app.add_file_references([file]) if name == 'ZapActivityAttributes.swift'
end
group.new_reference('Info.plist')
group.new_reference('ZapActivity.entitlements')

target.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{APP_BUNDLE_ID}.#{TARGET_NAME}"
  s['INFOPLIST_FILE'] = "#{TARGET_NAME}/Info.plist"
  s['CODE_SIGN_ENTITLEMENTS'] = "#{TARGET_NAME}/#{TARGET_NAME}.entitlements"
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['DEVELOPMENT_TEAM'] = TEAM
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['SKIP_INSTALL'] = 'YES'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'ZAP!'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
  # расширение линкуется само по себе, без подов приложения
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

# Приложение должно нести расширение внутри себя
embed = app.build_phases.find { |p| p.respond_to?(:name) && p.name == 'Embed Foundation Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
embed.add_file_reference(target.product_reference, true)
app.add_dependency(target)

# Приложению нужны те же настройки, что и расширению, для общего App Group
app.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = "#{APP_NAME}/#{APP_NAME}.entitlements"
end

project.save
puts "#{TARGET_NAME}: таргет добавлен"
