require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
vlc_version = package["vlc"]["ios"]

Pod::Spec.new do |s|
  s.name         = "react-native-vlc-media-player"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.requires_arc = true
  s.author       = { 'roshan.milinda' => 'rmilinda@gmail.com' }
  s.license      = 'MIT'
  s.homepage     = 'https://github.com/razorRun/react-native-vlc-media-player.git'
  s.source       = { :git => "https://github.com/razorRun/react-native-vlc-media-player.git", :tag => "v#{s.version}" }
  s.source_files = 'ios/RCTVLCPlayer/*'
  s.ios.deployment_target = "8.4"
  s.tvos.deployment_target = "10.2"
  s.static_framework = true
  s.dependency 'React'
  s.ios.dependency 'MobileVLCKit', vlc_version
  s.tvos.dependency 'TVVLCKit', vlc_version
end
