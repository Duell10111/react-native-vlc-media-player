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
  # 13.4 is React Native 0.74's minimum, which is the floor this package declares
  # in peerDependencies. Phase 2b raises it to 15.1 together with Swift.
  s.ios.deployment_target = "13.4"
  s.tvos.deployment_target = "13.4"
  s.static_framework = true

  # Defines RCT_NEW_ARCH_ENABLED and wires up the React dependencies for both
  # architectures. Replaces the bare `s.dependency 'React'`.
  install_modules_dependencies(s)
  s.ios.dependency 'MobileVLCKit', vlc_version
  s.tvos.dependency 'TVVLCKit', vlc_version
end
