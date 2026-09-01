# Добавляет в таргет приложения исходники нативного модуля Live Activity.
# Отдельным скриптом от add_widget_target.rb, потому что это про другой таргет.
require 'xcodeproj'
project = Xcodeproj::Project.open(File.expand_path('ZapMobile.xcodeproj', __dir__))
app = project.targets.find { |t| t.name == 'ZapMobile' } or abort 'нет таргета ZapMobile'
group = project.main_group.find_subpath('ZapMobile', true)

existing = app.source_build_phase.files.map { |f| f.file_ref&.path }.compact
%w[ZapLiveActivityImpl.swift ZapLiveActivity.mm].each do |name|
  next if existing.include?("ZapMobile/#{name}") || existing.include?(name)
  ref = group.files.find { |f| f.path&.end_with?(name) } || group.new_reference("ZapMobile/#{name}")
  app.add_file_references([ref])
  puts "добавлен #{name}"
end
# заголовок в проект, но не в фазу компиляции
unless group.files.any? { |f| f.path&.end_with?('ZapLiveActivity.h') }
  group.new_reference('ZapMobile/ZapLiveActivity.h')
end
project.save
puts 'ok'
