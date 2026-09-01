require 'xcodeproj'
project = Xcodeproj::Project.open(File.expand_path('ZapMobile.xcodeproj', __dir__))
t = project.targets.find { |x| x.name == 'ZapActivity' } or abort 'нет таргета'
t.build_configurations.each do |c|
  # без PRODUCT_NAME продукт назывался «.appex» — отсюда duplicate output file
  c.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  c.build_settings.delete('CODE_SIGN_ENTITLEMENTS')
end
project.save
puts 'PRODUCT_NAME + снят entitlements с расширения'
